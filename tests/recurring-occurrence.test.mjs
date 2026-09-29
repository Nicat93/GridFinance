import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { transformSync } from 'esbuild';

const loadTypeScript = (relativePath) => {
  const filePath = path.resolve(relativePath);
  const { code } = transformSync(readFileSync(filePath, 'utf8'), { loader: 'ts', format: 'cjs' });
  const loaded = new Module(filePath);
  loaded.filename = filePath;
  loaded.paths = Module._nodeModulePaths(path.dirname(filePath));
  loaded._compile(code, filePath);
  return loaded.exports;
};

const { getRecurringOccurrenceId } = loadTypeScript('services/recurrence.ts');
const service = loadTypeScript('services/supabaseService.ts');
const currentState = (transactions = []) => ({
  transactions,
  plans: [],
  cycleStartDay: 1,
  deletedIds: {},
  categoryDefs: [],
  lastModified: 0,
});

test('two devices applying the same occurrence converge to one transaction', () => {
  const idA = getRecurringOccurrenceId('plan/A', '2026-09-29');
  const idB = getRecurringOccurrenceId('plan/A', '2026-09-29');
  assert.equal(idA, idB);

  const deviceA = { id: idA, date: '2026-09-29', relatedPlanId: 'plan/A', lastModified: 100, createdAt: 100 };
  const deviceB = { ...deviceA, lastModified: 101, createdAt: 101 };
  const merged = service.mergeDeltas(currentState([deviceA]), {
    transactions: [{ sync_id: 'test-sync', id: idB, data: deviceB, updated_at: 101, deleted: false }],
    plans: [], categories: [], metadata: null,
  });
  assert.equal(merged.transactions.length, 1);
  assert.equal(merged.transactions[0].id, idA);
});

test('different dates and different plans have separate occurrence identities', () => {
  const ids = new Set([
    getRecurringOccurrenceId('plan/A', '2026-09-29'),
    getRecurringOccurrenceId('plan/A', '2026-10-29'),
    getRecurringOccurrenceId('plan/B', '2026-09-29'),
  ]);
  assert.equal(ids.size, 3);
});
