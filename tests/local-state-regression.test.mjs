import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { transformSync } from 'esbuild';

const file = path.resolve('services/localState.ts');
const { code } = transformSync(readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs' });
const mod = new Module(file); mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file)); mod._compile(code, file);
const { mergeLocalSnapshots, LogicalClock, persistMergedSnapshot } = mod.exports;
const empty = () => ({ transactions: [], plans: [], categoryDefs: [], cycleStartDay: 1, cycleStartDayLastModified: 0, deletedIds: {}, transactionDeletedIds: {}, planDeletedIds: {}, deletedCategoryIds: {}, deletedCategoryNames: {}, syncConfig: { lastSyncedAt: 0 } });
const record = (id, lastModified, more = {}) => ({ id, lastModified, ...more });

test('two independent transaction additions survive serialized cross-tab reconciliation', () => {
  const tabA = { ...empty(), transactions: [record('X', 10)] };
  const tabB = { ...empty(), transactions: [record('Y', 11)] };
  assert.deepEqual(mergeLocalSnapshots(tabA, tabB).transactions.map(x => x.id).sort(), ['X', 'Y']);
});

test('editing X and adding Y in another tab retains both latest records', () => {
  const a = { ...empty(), transactions: [record('X', 20, { description: 'edited' })] };
  const b = { ...empty(), transactions: [record('X', 10), record('Y', 15)] };
  assert.deepEqual(mergeLocalSnapshots(a, b).transactions, [record('X', 20, { description: 'edited' }), record('Y', 15)]);
});

test('a deletion tombstone prevents a stale tab from resurrecting the record', () => {
  const deleted = { ...empty(), transactionDeletedIds: { X: 20 } };
  const stale = { ...empty(), transactions: [record('X', 10)] };
  const merged = mergeLocalSnapshots(deleted, stale);
  assert.deepEqual(merged.transactions, []);
  assert.equal(merged.transactionDeletedIds.X, 20);
});

test('explicit clear or overwrite reset beats snapshots from tabs that have not received its storage event', () => {
  const reset = { ...empty(), localResetAt: 100, transactions: [] };
  const stale = { ...empty(), transactions: [record('X', 200)] };
  assert.deepEqual(mergeLocalSnapshots(reset, stale).transactions, []);
});

test('plans use the same merge and deletion rules as transactions', () => {
  const a = { ...empty(), plans: [record('X', 10)] };
  const b = { ...empty(), plans: [record('Y', 11)] };
  assert.deepEqual(mergeLocalSnapshots(a, b).plans.map(x => x.id).sort(), ['X', 'Y']);
  assert.deepEqual(mergeLocalSnapshots({ ...a, plans: [], planDeletedIds: { X: 20 } }, a).plans, []);
});

test('reconciling already-converged storage causes no write/event loop', async () => {
  const backing = new Map(); let writes = 0;
  const storage = { getItem: key => backing.get(key) ?? null, setItem: (key, value) => { writes++; backing.set(key, value); } };
  const state = { ...empty(), transactions: [record('X', 10)] };
  await persistMergedSnapshot(storage, state);
  const firstWriteCount = writes;
  await persistMergedSnapshot(storage, state);
  assert.equal(writes, firstWriteCount);
});

test('logical clock follows wall time normally and stays above watermark through rollback and repeated edits', () => {
  let wall = 1000;
  const clock = new LogicalClock(900, () => wall);
  assert.equal(clock.next(800), 1000);
  wall = 200;
  assert.equal(clock.next(1200), 1201);
  assert.equal(clock.next(1200), 1202);
});

test('logical clock stamps local edits and deletes above a prior sync watermark when wall clock is behind', () => {
  const clock = new LogicalClock(5000, () => 100);
  const editTime = clock.next(5000);
  const deleteTime = clock.next(5000, editTime);
  assert.ok(editTime > 5000 && deleteTime > editTime);
});
