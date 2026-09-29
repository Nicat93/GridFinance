import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { transformSync } from 'esbuild';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filePath) => {
  const { code } = transformSync(readFileSync(filePath, 'utf8'), { loader: 'ts', format: 'cjs' });
  module._compile(code, filePath);
};

const loadTypeScript = (relativePath) => {
  const filePath = path.resolve(relativePath);
  const { code } = transformSync(readFileSync(filePath, 'utf8'), { loader: 'ts', format: 'cjs' });
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
