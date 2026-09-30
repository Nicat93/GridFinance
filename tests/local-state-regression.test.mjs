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

const file = path.resolve('services/localState.ts');
const { outputText: code } = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const mod = new Module(file); mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file)); mod._compile(code, file);
const { mergeLocalSnapshots, LogicalClock, persistMergedSnapshot, readLocalSnapshot } = mod.exports;
const validationFile = path.resolve('services/backupValidation.ts');
const { outputText: validationCode } = ts.transpileModule(readFileSync(validationFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const validationModule = new Module(validationFile); validationModule.filename = validationFile;
validationModule.paths = Module._nodeModulePaths(path.dirname(validationFile)); validationModule._compile(validationCode, validationFile);
const { validateBackup } = validationModule.exports;
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

const memoryStorage = () => {
  const backing = new Map();
  return { getItem: key => backing.get(key) ?? null, setItem: (key, value) => backing.set(key, value) };
};

test('legacy transaction without lastModified survives persistence and reload without a tombstone', async () => {
  const storage = memoryStorage();
  const state = { ...empty(), transactions: [{ id: 'legacy-tx', description: 'Legacy' }] };
  await persistMergedSnapshot(storage, state);
  assert.deepEqual(readLocalSnapshot(storage).transactions, state.transactions);
});

test('approximate upper amounts survive cross-tab merge and local persistence', async () => {
  const state = {
    ...empty(),
    transactions: [{ id: 'range-tx', lastModified: 10, amount: 50, approximateUpperAmount: 70 }],
    plans: [{ id: 'range-plan', lastModified: 11, amount: 20, approximateUpperAmount: 35 }],
  };
  const merged = mergeLocalSnapshots(empty(), state);
  const storage = memoryStorage();
  await persistMergedSnapshot(storage, merged);
  const reloaded = readLocalSnapshot(storage);
  assert.equal(reloaded.transactions[0].approximateUpperAmount, 70);
  assert.equal(reloaded.plans[0].approximateUpperAmount, 35);
});

test('legacy plan without lastModified survives persistence and reload without a tombstone', async () => {
  const storage = memoryStorage();
  const state = { ...empty(), plans: [{ id: 'legacy-plan', description: 'Legacy plan' }] };
  await persistMergedSnapshot(storage, state);
  assert.deepEqual(readLocalSnapshot(storage).plans, state.plans);
});

test('legacy category without lastModified survives persistence and reload without a tombstone', async () => {
  const storage = memoryStorage();
  const state = { ...empty(), categoryDefs: [{ id: 'legacy-category', name: 'Food', color: 'red' }] };
  await persistMergedSnapshot(storage, state);
  assert.deepEqual(readLocalSnapshot(storage).categoryDefs, state.categoryDefs);
});

test('missing timestamps still lose to actual tombstones and timestamped records keep conflict ordering', () => {
  const legacy = { ...empty(), transactions: [{ id: 'legacy' }], plans: [{ id: 'legacy-plan' }], categoryDefs: [{ id: 'legacy-cat' }] };
  const deleted = { ...empty(), transactionDeletedIds: { legacy: 10 }, planDeletedIds: { 'legacy-plan': 10 }, deletedCategoryIds: { 'legacy-cat': 10 } };
  const mergedLegacy = mergeLocalSnapshots(legacy, deleted);
  assert.deepEqual(mergedLegacy.transactions, []);
  assert.deepEqual(mergedLegacy.plans, []);
  assert.deepEqual(mergedLegacy.categoryDefs, []);

  const timestamped = { ...empty(), transactions: [record('old', 9), record('new', 11), record('live', 10)] };
  const timestampTombstones = { ...empty(), transactionDeletedIds: { old: 10, new: 10 } };
  assert.deepEqual(mergeLocalSnapshots(timestamped, timestampTombstones).transactions, [record('new', 11), record('live', 10)]);
});

test('full legacy backup import with sync disabled persists transactions, plans, and categories through reload', async () => {
  const imported = validateBackup({
    transactions: [{ id: 'legacy-import-tx', date: '2026-09-01', description: 'Old transaction', amount: 4, type: 'expense', tags: [], createdAt: 1 }],
    plans: [{ id: 'legacy-import-plan', description: 'Old plan', amount: 5, type: 'expense', frequency: 'Monthly', startDate: '2026-09-01', occurrencesGenerated: 0, tags: [], createdAt: 1 }],
    categoryDefs: [{ id: 'legacy-import-cat', name: 'Food', color: 'red' }], cycleStartDay: 1,
  }, 99);
  const storage = memoryStorage();
  const importedState = { ...empty(), ...imported, syncConfig: { enabled: false, lastSyncedAt: 0 }, localResetAt: 100 };
  const persisted = await persistMergedSnapshot(storage, importedState);
  await persistMergedSnapshot(storage, persisted);
  const reloaded = readLocalSnapshot(storage);
  assert.deepEqual(reloaded.transactions.map(({ id }) => id), ['legacy-import-tx']);
  assert.deepEqual(reloaded.plans.map(({ id }) => id), ['legacy-import-plan']);
  assert.deepEqual(reloaded.categoryDefs.map(({ id }) => id), ['legacy-import-cat']);
  assert.equal('lastModified' in reloaded.transactions[0], false);
  assert.equal('lastModified' in reloaded.plans[0], false);
  assert.equal('lastModified' in reloaded.categoryDefs[0], false);
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
