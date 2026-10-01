import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filePath) => {
  const { outputText } = ts.transpileModule(readFileSync(filePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  module._compile(outputText, filePath);
};

const loadTypeScript = (relativePath) => {
  const filePath = path.resolve(relativePath);
  const { outputText } = ts.transpileModule(readFileSync(filePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const loaded = new Module(filePath);
  loaded.filename = filePath;
  loaded.paths = Module._nodeModulePaths(path.dirname(filePath));
  loaded._compile(outputText, filePath);
  return loaded.exports;
};

const { Frequency } = loadTypeScript('types.ts');
const { createAppliedTransaction } = loadTypeScript('services/plannedPayments.ts');
const { getPlanOccurrencesInRange } = loadTypeScript('services/recurrence.ts');
const { mergeLocalSnapshots, persistMergedSnapshot, readLocalSnapshot } = loadTypeScript('services/localState.ts');
const { mergeDeltas } = loadTypeScript('services/supabaseService.ts');
const { SyncWorkTracker } = loadTypeScript('services/syncWorkTracker.ts');

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const plan = (id, frequency, overrides = {}) => ({
  id,
  description: id,
  amount: 50,
  type: 'expense',
  frequency,
  startDate: '2026-10-01',
  occurrencesGenerated: 0,
  tags: [],
  createdAt: 100,
  lastModified: 100,
  ...overrides,
});

const initialState = (plans) => ({
  transactions: [],
  plans,
  cycleStartDay: 1,
  cycleStartDayLastModified: 0,
  deletedIds: {},
  transactionDeletedIds: {},
  planDeletedIds: {},
  deletedCategoryIds: {},
  deletedCategoryNames: {},
  categoryDefs: [],
  syncConfig: { enabled: true, syncId: 'isolated-apply-race-test', lastSyncedAt: 200 },
  localResetAt: 0,
  lastModified: 0,
});

const applyPlan = (state, planId, date, now, actualAmount) => {
  const selected = state.plans.find(item => item.id === planId);
  assert.ok(selected, `expected plan ${planId} to exist before Apply`);
  const transaction = createAppliedTransaction(selected, date, true, now, now, actualAmount);
  state.transactions = [transaction, ...state.transactions];
  if (selected.frequency === Frequency.ONE_TIME) {
    state.planDeletedIds = { ...state.planDeletedIds, [selected.id]: now };
    state.plans = state.plans.filter(item => item.id !== selected.id);
  } else {
    state.plans = state.plans.map(item => item.id === selected.id
      ? { ...item, occurrencesGenerated: item.occurrencesGenerated + 1, lastModified: now }
      : item);
  }
  return transaction;
};

const emptyRemote = () => ({ transactions: [], plans: [], categories: [], metadata: null });
const oldRemotePlan = (item, updatedAt = 300) => ({
  transactions: [],
  plans: [{ id: item.id, data: item, updated_at: updatedAt, deleted: false }],
  categories: [],
  metadata: null,
});

const mergeIntoCurrent = (stateRef, remote) => {
  stateRef.current = { ...stateRef.current, ...mergeDeltas(stateRef.current, remote) };
};

const syncAfterPullBarrier = async (stateRef, tracker, pullPromise) => {
  tracker.beginRun();
  const remote = await pullPromise;
  // Mirrors the current triggerSync ordering: resolve the pull, read latest state,
  // then merge remote deltas against that state.
  mergeIntoCurrent(stateRef, remote);
  return tracker.needsFollowUp(true, false, false);
};

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
};

const persistAndReload = async state => {
  const storage = memoryStorage();
  const persisted = await persistMergedSnapshot(storage, state);
  const reloaded = readLocalSnapshot(storage);
  assert.deepEqual(mergeLocalSnapshots(persisted, reloaded), persisted);
  return reloaded;
};

test('Apply while pull is paused survives an older cloud snapshot and the coalesced follow-up', async () => {
  const oneOff = plan('one-off-A', Frequency.ONE_TIME);
  const unrelated = plan('one-off-B', Frequency.ONE_TIME, { lastModified: 110 });
  const recurring = plan('recurring-C', Frequency.WEEKLY, { amount: 20, lastModified: 120 });
  const stateRef = { current: initialState([oneOff, unrelated, recurring]) };
  const tracker = new SyncWorkTracker();
  const barrier = deferred();
  const activeRun = syncAfterPullBarrier(stateRef, tracker, barrier.promise);

  const actual = applyPlan(stateRef.current, oneOff.id, oneOff.startDate, 500);
  tracker.markLocalWork();
  barrier.resolve(oldRemotePlan(oneOff, 300));
  assert.equal(await activeRun, true, 'the Apply during pull requires one follow-up');

  assert.equal(actual.id, createAppliedTransaction(oneOff, oneOff.startDate, true, 500, 500).id);
  assert.equal(stateRef.current.transactions.filter(item => item.id === actual.id).length, 1);
  assert.deepEqual(stateRef.current.plans.map(item => item.id).sort(), ['one-off-B', 'recurring-C']);
  assert.equal(stateRef.current.planDeletedIds[oneOff.id], 500);
  assert.equal(stateRef.current.transactionDeletedIds[oneOff.id], undefined, 'plan ID is not tombstoned in the transaction namespace');
  assert.ok(actual.lastModified > stateRef.current.syncConfig.lastSyncedAt);

  // The first follow-up itself is still active when another Apply happens.
  tracker.beginRun();
  const recurringActual = applyPlan(stateRef.current, recurring.id, recurring.startDate, 600, 60);
  tracker.markLocalWork();
  const staleRows = {
    ...oldRemotePlan(oneOff, 300),
    plans: [...oldRemotePlan(oneOff, 300).plans, ...oldRemotePlan(recurring, 400).plans],
  };
  mergeIntoCurrent(stateRef, staleRows);
  assert.equal(tracker.needsFollowUp(true, false, false), true, 'Apply during the follow-up requires one more pass');

  tracker.beginRun();
  mergeIntoCurrent(stateRef, staleRows);
  assert.equal(tracker.needsFollowUp(true, false, false), false, 'the final follow-up settles the work');
  assert.equal(stateRef.current.transactions.filter(item => item.id === actual.id).length, 1);
  assert.equal(stateRef.current.transactions.filter(item => item.id === recurringActual.id).length, 1);
  assert.deepEqual(stateRef.current.plans.map(item => item.id).sort(), ['one-off-B', 'recurring-C']);

  const reloaded = await persistAndReload(stateRef.current);
  assert.equal(reloaded.transactions.filter(item => item.id === actual.id).length, 1);
  assert.equal(reloaded.transactions.filter(item => item.id === recurringActual.id).length, 1);
  assert.deepEqual(reloaded.plans.map(item => item.id).sort(), ['one-off-B', 'recurring-C']);
  assert.equal(reloaded.planDeletedIds[oneOff.id], 500);
  assert.equal(reloaded.plans.find(item => item.id === recurring.id).occurrencesGenerated, 1);
  assert.deepEqual(getPlanOccurrencesInRange(reloaded.plans.find(item => item.id === recurring.id), '2026-10-01', '2026-10-15'), ['2026-10-08', '2026-10-15']);
});

test('duplicate sync requests during a paused pull coalesce while approximate recurring Apply survives', async () => {
  const recurring = plan('approx-recurring', Frequency.WEEKLY, {
    amount: 50,
    approximateUpperAmount: 70,
    lastModified: 150,
  });
  const unrelatedOneOff = plan('unrelated-one-off', Frequency.ONE_TIME, { lastModified: 160 });
  const stateRef = { current: initialState([recurring, unrelatedOneOff]) };
  const tracker = new SyncWorkTracker();
  const barrier = deferred();
  const activeRun = syncAfterPullBarrier(stateRef, tracker, barrier.promise);

  const appliedDate = '2026-10-01';
  const actual = applyPlan(stateRef.current, recurring.id, appliedDate, 600, 63.4);
  tracker.markLocalWork();
  const app = readFileSync(path.resolve('App.tsx'), 'utf8');
  assert.match(app, /if \(request\.localMutation\) syncWorkTrackerRef\.current\.markLocalWork\(\);/);
  assert.match(app, /if \(isSyncingRef\.current\) return;/);

  let isSyncing = true;
  let startedRuns = 1;
  const requestSync = ({ localMutation = false } = {}) => {
    if (localMutation) tracker.markLocalWork();
    if (isSyncing) return false;
    isSyncing = true;
    startedRuns++;
    tracker.beginRun();
    return true;
  };
  const generationAfterApply = tracker.generation;
  // Startup/focus/visibility/manual-like duplicate triggers are not local work.
  // The active-run guard keeps them from adding work or starting overlapping runs.
  for (let index = 0; index < 5; index++) assert.equal(requestSync(), false);
  assert.equal(startedRuns, 1);
  assert.equal(tracker.generation, generationAfterApply);
  assert.equal(tracker.needsFollowUp(true, false, false), true, 'duplicate requests do not consume Apply work');
  barrier.resolve(oldRemotePlan(recurring, 400));
  assert.equal(await activeRun, true);

  assert.equal(actual.id, createAppliedTransaction(recurring, appliedDate, true, 600, 600, 63.4).id);
  assert.equal(actual.relatedPlanId, recurring.id);
  assert.equal(actual.amount, 63.4);
  assert.equal(Object.hasOwn(actual, 'approximateUpperAmount'), false);
  assert.deepEqual(stateRef.current.transactionDeletedIds, {});
  assert.deepEqual(stateRef.current.planDeletedIds, {});
  assert.equal(stateRef.current.plans.find(item => item.id === recurring.id).occurrencesGenerated, 1);
  assert.equal(stateRef.current.plans.find(item => item.id === recurring.id).approximateUpperAmount, 70);
  assert.ok(getPlanOccurrencesInRange(stateRef.current.plans.find(item => item.id === recurring.id), '2026-10-01', '2026-10-15').length > 0);
  assert.deepEqual(stateRef.current.plans.map(item => item.id).sort(), ['approx-recurring', 'unrelated-one-off']);

  tracker.beginRun();
  mergeIntoCurrent(stateRef, oldRemotePlan(recurring, 400));
  assert.equal(tracker.needsFollowUp(true, false, false), false);
  const reloaded = await persistAndReload(stateRef.current);
  assert.equal(reloaded.transactions.filter(item => item.id === actual.id).length, 1);
  assert.equal(reloaded.plans.find(item => item.id === recurring.id).occurrencesGenerated, 1);
  assert.equal(reloaded.plans.find(item => item.id === recurring.id).approximateUpperAmount, 70);
  assert.deepEqual(reloaded.planDeletedIds, {});
  assert.deepEqual(reloaded.transactionDeletedIds, {});
});

test('idle Apply settles without an unnecessary follow-up and exact/approximate plans reload correctly', async () => {
  for (const isApproximate of [false, true]) {
    const oneOff = plan(`one-off-${isApproximate}`, Frequency.ONE_TIME, isApproximate
      ? { amount: 50, approximateUpperAmount: 70 }
      : { amount: 42, approximateUpperAmount: undefined });
    const state = initialState([oneOff]);
    const tracker = new SyncWorkTracker();
    applyPlan(state, oneOff.id, oneOff.startDate, isApproximate ? 702 : 701, isApproximate ? 63.4 : undefined);
    tracker.markLocalWork();
    tracker.beginRun();
    state.transactions = mergeDeltas(state, emptyRemote()).transactions;
    assert.equal(tracker.needsFollowUp(true, false, false), false);
    const reloaded = await persistAndReload(state);
    assert.equal(reloaded.transactions.length, 1);
    assert.equal(reloaded.transactions[0].amount, isApproximate ? 63.4 : 42);
    assert.equal(Object.hasOwn(reloaded.transactions[0], 'approximateUpperAmount'), false);
    assert.deepEqual(reloaded.plans, []);
    assert.equal(reloaded.planDeletedIds[oneOff.id], isApproximate ? 702 : 701);
  }
});

test('recurring exact and approximate occurrence Apply preserves the definition and future schedule after reload', async () => {
  for (const isApproximate of [false, true]) {
    const recurring = plan(`recurring-${isApproximate}`, Frequency.WEEKLY, isApproximate
      ? { amount: 50, approximateUpperAmount: 70 }
      : { amount: 35, approximateUpperAmount: undefined });
    const state = initialState([recurring]);
    const tracker = new SyncWorkTracker();
    const appliedDate = recurring.startDate;
    const actual = applyPlan(state, recurring.id, appliedDate, isApproximate ? 802 : 801, isApproximate ? 63.4 : undefined);
    tracker.markLocalWork();
    tracker.beginRun();
    state.transactions = mergeDeltas(state, emptyRemote()).transactions;
    assert.equal(tracker.needsFollowUp(true, false, false), false);

    const reloaded = await persistAndReload(state);
    assert.equal(reloaded.transactions.length, 1);
    assert.equal(reloaded.transactions[0].id, actual.id);
    assert.equal(reloaded.transactions[0].date, appliedDate);
    assert.equal(reloaded.transactions[0].amount, isApproximate ? 63.4 : 35);
    assert.equal(Object.hasOwn(reloaded.transactions[0], 'approximateUpperAmount'), false);
    assert.equal(reloaded.plans.length, 1);
    assert.equal(reloaded.plans[0].id, recurring.id);
    assert.equal(reloaded.plans[0].occurrencesGenerated, 1);
    assert.equal(reloaded.plans[0].approximateUpperAmount, isApproximate ? 70 : undefined);
    assert.deepEqual(getPlanOccurrencesInRange(reloaded.plans[0], '2026-10-01', '2026-10-15'), ['2026-10-08', '2026-10-15']);
    assert.deepEqual(reloaded.planDeletedIds, {});
    assert.deepEqual(reloaded.transactionDeletedIds, {});
  }
});

test('current App still awaits pull before reading latest state and separates one-off from recurring tombstones', () => {
  const app = readFileSync(path.resolve('App.tsx'), 'utf8');
  assert.match(app, /await SupabaseService\.pullChanges\(currentConfig, lastSyncedAt\)[\s\S]*const latestLocalState = stateRef\.current;[\s\S]*SupabaseService\.mergeDeltas\(/);
  assert.match(app, /if \(plan\.frequency === Frequency\.ONE_TIME\) \{\s*setPlanDeletedIds\([\s\S]*setPlans\(prev => prev\.filter\(p => p\.id !== planId\)\);\s*\} else \{\s*setPlans\(prev => prev\.map\(p => p\.id === planId \? \{ \.\.\.p, occurrencesGenerated: p\.occurrencesGenerated \+ 1, lastModified: now \} : p\)\);/);
  assert.match(app, /syncWorkTrackerRef\.current\.needsFollowUp\(runSucceeded, syncForcePendingRef\.current, shouldResync\)/);
  assert.match(app, /setTransactions\(prev => \[newTx, \.\.\.prev\]\)/);
});
