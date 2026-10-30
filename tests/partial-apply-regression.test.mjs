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
const { validateBackup } = loadTypeScript('services/backupValidation.ts');
const { calculateCurrentBalance } = loadTypeScript('services/financialState.ts');
const { calculateProjectedBalance } = loadTypeScript('services/projectedBalance.ts');
const {
  createAppliedTransaction, createPartialTransaction, createSkippedTransaction,
  getPlanRemaining, getPlanSpent, getProjectedPlanOccurrences,
} = loadTypeScript('services/plannedPayments.ts');
const { getRecurringOccurrenceId } = loadTypeScript('services/recurrence.ts');

const plan = (overrides = {}) => ({
  id: 'plan-a', description: 'Groceries A', amount: 100, type: 'expense', frequency: Frequency.ONE_TIME,
  startDate: '2026-11-01', occurrencesGenerated: 0, tags: ['food'], createdAt: 1, lastModified: 1, ...overrides,
});
const spend = (p, id, amount, date = '2026-10-30') => createPartialTransaction(p, { id, date, amount, now: 10 });
const projected = (p, transactions, start = '2026-10-28', end = '2026-11-27') =>
  calculateProjectedBalance(calculateCurrentBalance(transactions),
    getProjectedPlanOccurrences(p, start, end, getPlanSpent(p, transactions)));

test('spending 20 then 50 of a 100 plan leaves 30 and projects only what is left', () => {
  const p = plan();
  const transactions = [spend(p, 's1', 20), spend(p, 's2', 50, '2026-11-06')];
  assert.equal(getPlanSpent(p, transactions), 70);
  assert.deepEqual(getPlanRemaining(p, 70), { amount: 30 });
  assert.equal(calculateCurrentBalance(transactions), -70, 'each spend is paid and affects Current immediately');
  assert.equal(projected(p, transactions).projectedBalance, -100, 'Projected = Current − remaining, no double count');
  assert.equal(p.occurrencesGenerated, 0, 'spending does not advance the plan');
});

test('a partial spend is a paid transaction linked by partialPlanId, never relatedPlanId', () => {
  const tx = spend(plan(), 's1', 20);
  assert.equal(tx.isPaid, true);
  assert.equal(tx.partialPlanId, 'plan-a');
  assert.equal(tx.partialDueDate, '2026-11-01');
  assert.equal(tx.relatedPlanId, undefined);
  assert.deepEqual(tx.tags, ['food']);
  assert.throws(() => spend(plan(), 'bad', Number.NaN));
});

test('ranged 80–120 with 70 spent leaves 10–50 and the projected range matches', () => {
  const p = plan({ amount: 80, approximateUpperAmount: 120 });
  const transactions = [spend(p, 's1', 70)];
  assert.deepEqual(getPlanRemaining(p, 70), { amount: 10, approximateUpperAmount: 50 });
  const range = projected(p, transactions);
  assert.equal(range.projectedBalanceMax, -80);
  assert.equal(range.projectedBalanceMin, -120);
  assert.deepEqual(getPlanRemaining(p, 100), { amount: 0, approximateUpperAmount: 20 }, 'past min, under max');
});

test('overspending floors what is left at zero', () => {
  const p = plan();
  const transactions = [spend(p, 's1', 120)];
  assert.deepEqual(getPlanRemaining(p, getPlanSpent(p, transactions)), { amount: 0 });
  assert.equal(projected(p, transactions).projectedBalance, -120);
});

test('deleting a partial spend restores what is left without touching the plan', () => {
  const p = plan();
  const transactions = [spend(p, 's1', 20), spend(p, 's2', 50)];
  const afterDelete = transactions.filter(tx => tx.id !== 's2');
  assert.deepEqual(getPlanRemaining(p, getPlanSpent(p, afterDelete)), { amount: 80 });
});

test('editing the plan amount recalculates what is left from the same spends', () => {
  const p = plan();
  const transactions = [spend(p, 's1', 70)];
  assert.deepEqual(getPlanRemaining({ ...p, amount: 120 }, getPlanSpent(p, transactions)), { amount: 50 });
});

test('Apply after partial spends uses the deterministic occurrence ID for the remaining amount', () => {
  const p = plan();
  const spent = getPlanSpent(p, [spend(p, 's1', 70)]);
  const applied = createAppliedTransaction(p, '2026-11-01', true, 20, 20, getPlanRemaining(p, spent).amount);
  assert.equal(applied.id, getRecurringOccurrenceId('plan-a', '2026-11-01'));
  assert.equal(applied.amount, 30);
  assert.equal(applied.relatedPlanId, 'plan-a');
  assert.equal(createSkippedTransaction(p, '2026-11-01', 20).amount, 0, 'Skip still applies zero and drops the rest');
});

test('a recurring plan resets spent when it advances to the next occurrence', () => {
  const p = plan({ frequency: Frequency.MONTHLY });
  const transactions = [spend(p, 's1', 70)];
  assert.equal(getPlanSpent(p, transactions), 70);
  const advanced = { ...p, occurrencesGenerated: 1 };
  assert.equal(getPlanSpent(advanced, transactions), 0, 'old partials do not count against the next occurrence');
  const occurrences = getProjectedPlanOccurrences(p, '2026-10-28', '2026-12-27', 70);
  assert.deepEqual(occurrences.map(o => [o.date, o.amount]), [['2026-11-01', 30], ['2026-12-01', 100]],
    'only the next occurrence is reduced; later ones project in full');
});

test('partial fields survive backup import and are validated', () => {
  const p = plan();
  const tx = spend(p, 's1', 20);
  const backup = validateBackup(JSON.parse(JSON.stringify({ transactions: [tx], plans: [p], cycleStartDay: 1 })));
  assert.equal(backup.transactions[0].partialPlanId, 'plan-a');
  assert.equal(backup.transactions[0].partialDueDate, '2026-11-01');
  assert.throws(() => validateBackup({ transactions: [{ ...tx, partialDueDate: '2026-13-40' }], plans: [], cycleStartDay: 1 }));
  assert.throws(() => validateBackup({ transactions: [{ ...tx, partialDueDate: undefined }], plans: [], cycleStartDay: 1 }));
});
