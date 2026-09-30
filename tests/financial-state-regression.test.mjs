import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filePath) => {
  const { outputText: code } = ts.transpileModule(readFileSync(filePath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  module._compile(code, filePath);
};

const loadTypeScript = (relativePath) => {
  const filePath = path.resolve(relativePath);
  const { outputText: code } = ts.transpileModule(readFileSync(filePath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const loaded = new Module(filePath);
  loaded.filename = filePath;
  loaded.paths = Module._nodeModulePaths(path.dirname(filePath));
  loaded._compile(code, filePath);
  return loaded.exports;
};

const { Frequency } = loadTypeScript('types.ts');
const dates = loadTypeScript('services/dateOnly.ts');
const { validateBackup } = loadTypeScript('services/backupValidation.ts');
const { affectsCurrentBalance, getPaidVisualState } = loadTypeScript('services/financialState.ts');
const { getPlanOccurrencesInRange } = loadTypeScript('services/recurrence.ts');
const { calculateProjectedBalance, getApproximateUnpaidExpenseOccurrences } = loadTypeScript('services/projectedBalance.ts');
const { createAppliedTransaction, createExactTransactionFromPlan, createPlannedPlan, getPlannedApproximateAmount } = loadTypeScript('services/plannedPayments.ts');
const transaction = (date, isPaid, type = 'expense', amount = 10) => ({ id: `${date}-${isPaid}`, date, isPaid, type, amount });

test('Current balance eligibility follows payment state for past, today, and future dates', () => {
  const checks = [
    ['2026-09-28', true, true], ['2026-09-29', true, true],
    ['2026-09-28', false, false], ['2026-09-29', false, false],
    ['2026-10-15', false, false], ['2026-10-15', true, true],
  ];
  for (const [date, paid, expected] of checks) assert.equal(affectsCurrentBalance(transaction(date, paid)), expected);
});

test('paid-early visual state changes to normal paid on the scheduled date without changing the date', () => {
  const paidEarly = transaction('2026-10-15', true);
  assert.equal(getPaidVisualState(paidEarly, '2026-09-29'), 'paid-early');
  assert.equal(getPaidVisualState(paidEarly, '2026-10-15'), 'paid');
  assert.equal(getPaidVisualState(paidEarly, '2026-10-16'), 'paid');
  assert.equal(paidEarly.date, '2026-10-15');
  assert.equal(getPaidVisualState(transaction('2026-10-15', false), '2026-09-29'), 'unpaid');
});

test('paid-early payment state and scheduled date survive backup import and JSON reload', () => {
  const backup = validateBackup({ transactions: [{
    id: 'scheduled-paid', date: '2026-10-15', description: 'Scheduled', amount: 8, type: 'expense', tags: [], isPaid: true, createdAt: 1,
  }], plans: [], cycleStartDay: 1 });
  const reloaded = JSON.parse(JSON.stringify(backup.transactions[0]));
  assert.equal(reloaded.isPaid, true);
  assert.equal(reloaded.date, '2026-10-15');
  assert.equal(affectsCurrentBalance(reloaded), true);
  assert.equal(getPaidVisualState(reloaded, '2026-09-29'), 'paid-early');
});

test('projected balance keeps existing single value when expenses have no uncertainty', () => {
  const result = calculateProjectedBalance(100, [{ amount: 25, type: 'expense' }]);
  assert.deepEqual(result, { projectedBalance: 75, projectedBalanceMin: 75, projectedBalanceMax: 75 });
});

test('projected range uses the larger expense for the lower balance and supports multiple expenses and income', () => {
  const result = calculateProjectedBalance(1000, [
    { amount: 50, approximateUpperAmount: 70, type: 'expense' },
    { amount: 20, approximateUpperAmount: 30, type: 'expense' },
    { amount: 100, type: 'income' },
  ]);
  assert.deepEqual(result, { projectedBalance: 1030, projectedBalanceMin: 1000, projectedBalanceMax: 1030 });
});

test('only unpaid ranged expenses in the selected period add one-off projection uncertainty', () => {
  const transactions = [
    { amount: 50, approximateUpperAmount: 70, date: '2026-09-15', isPaid: false, type: 'expense' },
    { amount: 40, date: '2026-09-16', isPaid: false, type: 'expense' },
    { amount: 30, approximateUpperAmount: 50, date: '2026-09-17', isPaid: true, type: 'expense' },
    { amount: 10, approximateUpperAmount: 20, date: '2026-10-01', isPaid: false, type: 'expense' },
  ];
  const occurrences = getApproximateUnpaidExpenseOccurrences(transactions, '2026-09-01', '2026-09-30');
  assert.deepEqual(occurrences, [{ amount: 50, type: 'expense', approximateUpperAmount: 70 }]);
  assert.deepEqual(calculateProjectedBalance(100, occurrences), {
    projectedBalance: 50, projectedBalanceMin: 30, projectedBalanceMax: 50,
  });
});

test('recurring projected occurrences apply the approximate range to every occurrence', () => {
  const occurrences = getPlanOccurrencesInRange(plan(Frequency.WEEKLY, '2026-09-01', {
    amount: 40, approximateUpperAmount: 50, type: 'expense',
  }), '2026-09-01', '2026-09-15');
  const result = calculateProjectedBalance(1000, occurrences.map(() => ({ amount: 40, approximateUpperAmount: 50, type: 'expense' })));
  assert.equal(occurrences.length, 3);
  assert.deepEqual(result, { projectedBalance: 880, projectedBalanceMin: 850, projectedBalanceMax: 880 });
});

const rangedPlan = overrides => ({
  id: 'ranged-plan', description: 'Recurring expense', amount: 40, approximateUpperAmount: 50,
  type: 'expense', frequency: Frequency.WEEKLY, startDate: '2026-09-29', occurrencesGenerated: 0,
  tags: [], createdAt: 1, ...overrides,
});

test('new and edited Planned entries dated today remain plans, while neighboring dates stay date-only', () => {
  const today = createPlannedPlan({
    id: 'today-plan', description: 'Today', amount: 10, type: 'expense', tags: [], date: '2026-09-30',
    frequency: Frequency.ONE_TIME, createdAt: 1, lastModified: 2,
  });
  const editedActual = createPlannedPlan({
    id: 'edited-plan', description: 'Edited actual', amount: 10, type: 'expense', tags: [], date: '2026-09-30',
    frequency: Frequency.ONE_TIME, createdAt: 1, lastModified: 2,
  });
  assert.equal(today.startDate, '2026-09-30');
  assert.equal(editedActual.startDate, '2026-09-30');
  assert.deepEqual(getPlanOccurrencesInRange(today, '2026-09-29', '2026-10-01'), ['2026-09-30']);
  for (const date of ['2026-09-29', '2026-10-01']) {
    const boundaryPlan = createPlannedPlan({ id: date, description: 'Boundary', amount: 1, type: 'expense', tags: [], date, frequency: Frequency.ONE_TIME, createdAt: 1, lastModified: 2 });
    assert.deepEqual(getPlanOccurrencesInRange(boundaryPlan, date, date), [date]);
  }
});

test('approximate Max belongs only to planned expenses and is removed when Planned is disabled', () => {
  assert.equal(getPlannedApproximateAmount(false, 'expense', 70), undefined, 'actual expense drops legacy Max');
  assert.equal(getPlannedApproximateAmount(true, 'expense', 70), 70, 'planned expense retains Max');
  assert.equal(getPlannedApproximateAmount(true, 'income', 70), undefined, 'planned income does not receive an expense range');
  const actual = createExactTransactionFromPlan({ id: 'actual', date: '2026-09-30', description: 'Actual', amount: 63.4, type: 'expense', tags: [], createdAt: 1, lastModified: 2 });
  assert.equal(actual.amount, 63.4);
  assert.equal(Object.hasOwn(actual, 'approximateUpperAmount'), false);
});

test('planned approximate ranges remain editable and actual-to-planned conversion preserves the date and range', () => {
  const edited = createPlannedPlan({
    id: 'edited', description: 'Edited', amount: 50, approximateUpperAmount: 70, type: 'expense', tags: [],
    date: '2026-09-30', frequency: Frequency.ONE_TIME, createdAt: 1, lastModified: 2,
  });
  assert.equal(edited.amount, 50);
  assert.equal(edited.approximateUpperAmount, 70);
  assert.equal(edited.startDate, '2026-09-30');
});

test('applying an exact plan keeps its direct amount and applying an approximate plan requires one exact amount', () => {
  const exact = createAppliedTransaction(rangedPlan({ approximateUpperAmount: undefined }), '2026-09-30', false, 3);
  assert.equal(exact.amount, 40);
  const approximate = createAppliedTransaction(rangedPlan(), '2026-09-30', false, 3, 3, 63.4);
  assert.equal(approximate.amount, 63.4);
  assert.equal(Object.hasOwn(approximate, 'approximateUpperAmount'), false);
  assert.equal(approximate.isPaid, false, 'application preserves the existing unpaid/materialized transaction behavior');
  const exactProjection = getApproximateUnpaidExpenseOccurrences([{ ...approximate, relatedPlanId: 'ranged-plan' }], '2026-09-01', '2026-09-30');
  assert.deepEqual(exactProjection, [{ amount: 63.4, type: 'expense', approximateUpperAmount: undefined }]);
  assert.deepEqual(calculateProjectedBalance(100, exactProjection), {
    projectedBalance: 36.6, projectedBalanceMin: 36.6, projectedBalanceMax: 36.6,
  });
  assert.equal(createAppliedTransaction(rangedPlan(), '2026-09-30', true, 3, 3, 74.25).amount, 74.25, 'actual may fall outside its estimate');
  assert.throws(() => createAppliedTransaction(rangedPlan(), '2026-09-30', false, 3, 3, -1));
});

test('applying a recurring approximate occurrence leaves the plan and future occurrence ranges intact', () => {
  const originalPlan = rangedPlan();
  const firstDate = getPlanOccurrencesInRange(originalPlan, '2026-09-29', '2026-09-29')[0];
  const actual = createAppliedTransaction(originalPlan, firstDate, false, 3, 3, 47.3);
  const nextPlan = { ...originalPlan, occurrencesGenerated: originalPlan.occurrencesGenerated + 1 };
  assert.equal(actual.amount, 47.3);
  assert.equal(Object.hasOwn(actual, 'approximateUpperAmount'), false);
  assert.equal(originalPlan.approximateUpperAmount, 50);
  assert.equal(nextPlan.approximateUpperAmount, 50);
  assert.deepEqual(getPlanOccurrencesInRange(nextPlan, '2026-09-29', '2026-10-06'), ['2026-10-06']);
});

test('unapplied approximate recurring occurrences keep their projected expense range', () => {
  const plan = rangedPlan();
  const occurrences = getPlanOccurrencesInRange(plan, '2026-09-29', '2026-10-13')
    .map(() => ({ amount: plan.amount, approximateUpperAmount: plan.approximateUpperAmount, type: plan.type }));
  assert.equal(occurrences.length, 3);
  assert.deepEqual(calculateProjectedBalance(1000, occurrences), {
    projectedBalance: 880, projectedBalanceMin: 850, projectedBalanceMax: 880,
  });
});

const plan = (frequency, startDate, overrides = {}) => ({
  id: 'p', description: 'Plan', amount: 1, type: 'expense', frequency, startDate,
  occurrencesGenerated: 0, tags: [], createdAt: 0, ...overrides,
});

test('old weekly, monthly, and yearly anchors jump directly to the requested period', () => {
  assert.deepEqual(getPlanOccurrencesInRange(plan(Frequency.WEEKLY, '1900-01-01'), '2026-09-01', '2026-09-30'), [
    '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28',
  ]);
  assert.deepEqual(getPlanOccurrencesInRange(plan(Frequency.MONTHLY, '1900-01-31'), '2026-02-01', '2026-02-28'), ['2026-02-28']);
  assert.deepEqual(getPlanOccurrencesInRange(plan(Frequency.YEARLY, '1900-02-28'), '2026-01-01', '2026-12-31'), ['2026-02-28']);
});

test('occurrence projection preserves leap-day anchors, generated counts, limits, and inclusive end dates', () => {
  const leap = plan(Frequency.YEARLY, '2024-02-29');
  assert.deepEqual(getPlanOccurrencesInRange(leap, '2025-01-01', '2028-12-31'), ['2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  const monthly = plan(Frequency.MONTHLY, '1900-01-31', { occurrencesGenerated: 1512, maxOccurrences: 1515, endDate: '2026-03-31' });
  assert.deepEqual(getPlanOccurrencesInRange(monthly, '2026-02-01', '2026-04-30'), ['2026-02-28', '2026-03-31']);
  assert.equal(dates.isDateOnlyAfter('2026-03-31', '2026-03-31'), false);
});
