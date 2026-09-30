import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const servicePath = path.resolve('services/supabaseService.ts');
const { outputText: code } = ts.transpileModule(readFileSync(servicePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const serviceModule = new Module(servicePath);
serviceModule.filename = servicePath;
serviceModule.paths = Module._nodeModulePaths(path.dirname(servicePath));
serviceModule._compile(code, servicePath);
const service = serviceModule.exports;

const config = {
  enabled: true,
  supabaseUrl: 'https://sync-test.supabase.co',
  supabaseKey: 'test-anon-key',
  syncId: 'test-sync',
  lastSyncedAt: 0,
};

const currentState = (transactions = [], plans = []) => ({
  transactions,
  plans,
  cycleStartDay: 1,
  deletedIds: {},
  categoryDefs: [],
  lastModified: 0,
});

const authenticatedResponse = (input) => {
  const url = new URL(input instanceof Request ? input.url : input);
  return url.pathname.endsWith('/auth/v1/user')
    ? new Response('{"id":"00000000-0000-4000-8000-000000000001","email":"synthetic@example.test"}', { status: 200, headers: { 'content-type': 'application/json' } })
    : null;
};

test('pull failures are distinguishable from an empty successful pull', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new TypeError('network unavailable'); };
    service.initSupabase(config.supabaseUrl, config.supabaseKey, config.syncId);
    const result = await service.pullChanges(config, 0);
    assert.equal(result.success, false);
    assert.ok(result.error);
  } finally {
    globalThis.fetch = originalFetch;
    service.initSupabase('', '');
  }
});

test('anonymous sync uses the supplied partition header and can upload without an account', async () => {
  const originalFetch = globalThis.fetch;
  let writeCount = 0;
  let partitionHeader = '';
  try {
    globalThis.fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      if (request.method === 'POST') {
        writeCount++;
        partitionHeader = request.headers.get('x-gridfinance-sync-id') || '';
      }
      return new Response('[]', { status: 201, headers: { 'content-type': 'application/json' } });
    };
    service.initSupabase(config.supabaseUrl, config.supabaseKey, config.syncId);
    const result = await service.pushChanges(config, [{ id: 'private', lastModified: 10 }], [], [], {}, 1, 0);
    assert.equal(result.success, true);
    assert.equal(writeCount, 1);
    assert.equal(partitionHeader, config.syncId);
  } finally {
    globalThis.fetch = originalFetch;
    service.initSupabase('', '');
  }
});

for (const entity of ['transactions', 'plans']) {
  test(`newer local ${entity.slice(0, -1)} edit survives an older remote tombstone`, () => {
    const local = { id: 'item-1', lastModified: 200 };
    const merged = service.mergeDeltas(
      currentState(entity === 'transactions' ? [local] : [], entity === 'plans' ? [local] : []),
      {
        transactions: entity === 'transactions' ? [{ id: 'item-1', updated_at: 100, deleted: true }] : [],
        plans: entity === 'plans' ? [{ id: 'item-1', updated_at: 100, deleted: true }] : [],
        categories: [],
        metadata: null,
      },
    );
    assert.deepEqual(merged[entity], [local]);
    assert.equal(merged.deletedIds['item-1'], undefined);
  });

  test(`newer remote tombstone deletes an older local ${entity.slice(0, -1)} edit`, () => {
    const local = { id: 'item-1', lastModified: 100 };
    const merged = service.mergeDeltas(
      currentState(entity === 'transactions' ? [local] : [], entity === 'plans' ? [local] : []),
      {
        transactions: entity === 'transactions' ? [{ id: 'item-1', updated_at: 200, deleted: true }] : [],
        plans: entity === 'plans' ? [{ id: 'item-1', updated_at: 200, deleted: true }] : [],
        categories: [],
        metadata: null,
      },
    );
    assert.deepEqual(merged[entity], []);
    assert.equal(merged[entity === 'transactions' ? 'transactionDeletedIds' : 'planDeletedIds']['item-1'], 200);
  });
}

test('a local edit stamped at sync start remains eligible after the watermark advances', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  try {
    globalThis.fetch = async (input, init) => {
      const auth = authenticatedResponse(input);
      if (auth) return auth;
      const request = input instanceof Request ? input : new Request(input, init);
      requests.push(JSON.parse(await request.clone().text()));
      return new Response('[]', { status: 201, headers: { 'content-type': 'application/json' } });
    };
    service.initSupabase(config.supabaseUrl, config.supabaseKey, config.syncId);
    const syncStartTime = 500;
    const result = await service.pushChanges(
      config,
      [{ id: 'during-sync', lastModified: syncStartTime }],
      [],
      [],
      {},
      1,
      syncStartTime - 1,
    );
    assert.equal(result.success, true);
    assert.ok(requests.flat().some(row => row.id === 'during-sync'));
  } finally {
    globalThis.fetch = originalFetch;
    service.initSupabase('', '');
  }
});

test('Supabase sync preserves optional approximate upper amounts in transaction and plan JSON data', async () => {
  const originalFetch = globalThis.fetch;
  const writes = [];
  try {
    globalThis.fetch = async (input, init) => {
      const auth = authenticatedResponse(input);
      if (auth) return auth;
      const request = input instanceof Request ? input : new Request(input, init);
      if (request.method !== 'GET') writes.push(...JSON.parse(await request.clone().text()));
      return new Response('[]', { status: request.method === 'GET' ? 200 : 201, headers: { 'content-type': 'application/json' } });
    };
    service.initSupabase(config.supabaseUrl, config.supabaseKey, config.syncId);
    const result = await service.pushChanges(config,
      [{ id: 'range-tx', lastModified: 101, amount: 50, approximateUpperAmount: 70 }],
      [{ id: 'range-plan', lastModified: 102, amount: 20, approximateUpperAmount: 35 }],
      [], {}, 1, 0);
    assert.equal(result.success, true);
    assert.equal(writes.find(row => row.id === 'range-tx').data.approximateUpperAmount, 70);
    assert.equal(writes.find(row => row.id === 'range-plan').data.approximateUpperAmount, 35);
  } finally {
    globalThis.fetch = originalFetch;
    service.initSupabase('', '');
  }
});

test('a local edit that beats a tombstone is force-uploaded even below the prior watermark', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  try {
    globalThis.fetch = async (input, init) => {
      const auth = authenticatedResponse(input);
      if (auth) return auth;
      const request = input instanceof Request ? input : new Request(input, init);
      requests.push(JSON.parse(await request.clone().text()));
      return new Response('[]', { status: 201, headers: { 'content-type': 'application/json' } });
    };
    service.initSupabase(config.supabaseUrl, config.supabaseKey, config.syncId);
    const result = await service.pushChanges(
      config,
      [{ id: 'edited-record', lastModified: 200 }],
      [],
      [],
      {},
      1,
      250,
      { transactions: ['edited-record'] },
    );
    assert.equal(result.success, true);
    assert.ok(requests.flat().some(row => row.id === 'edited-record'));
  } finally {
    globalThis.fetch = originalFetch;
    service.initSupabase('', '');
  }
});

test('legacy records upload only when their ID is absent remotely', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  try {
    globalThis.fetch = async (input, init) => {
      const auth = authenticatedResponse(input);
      if (auth) return auth;
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      requests.push({ method: request.method, table: url.pathname.split('/').pop(), body: request.method === 'GET' ? null : JSON.parse(await request.clone().text()) });
      if (request.method === 'GET') return new Response('[{"id":"cloud-wins"}]', { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response('[]', { status: 201, headers: { 'content-type': 'application/json' } });
    };
    service.initSupabase(config.supabaseUrl, config.supabaseKey, config.syncId);
    const result = await service.pushChanges(config, [
      { id: 'cloud-wins', createdAt: 10 },
      { id: 'new-import', createdAt: 10 },
    ], [], [], {}, 1, 1000);
    assert.equal(result.success, true);
    const rows = requests.filter(request => request.method === 'POST' && request.table === 'grid_transactions').flatMap(request => request.body);
    assert.deepEqual(rows.map(row => row.id), ['new-import']);
    assert.ok(rows[0].updated_at > 1000);
  } finally {
    globalThis.fetch = originalFetch;
    service.initSupabase('', '');
  }
});

test('category tombstones remove one category and remain tombstoned', () => {
  const local = { ...currentState(), categoryDefs: [{ id: 'cat-1', name: 'Food', color: 'red', lastModified: 10 }] };
  const merged = service.mergeDeltas(local, {
    transactions: [], plans: [], categories: [{ id: 'cat-1', data: { name: 'Food' }, updated_at: 20, deleted: true }], metadata: null,
  });
  assert.deepEqual(merged.categoryDefs, []);
  assert.equal(merged.deletedCategoryIds['cat-1'], 20);
  assert.equal(merged.deletedCategoryNames['cat-1'], 'Food');
  const repeat = service.mergeDeltas(merged, {
    transactions: [], plans: [], categories: [{ id: 'cat-1', data: { id: 'cat-1', name: 'Food' }, updated_at: 15, deleted: false }], metadata: null,
  });
  assert.deepEqual(repeat.categoryDefs, []);
});

test('category delete uploads a category-table tombstone; clear-data still tombstones all tables', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  try {
    globalThis.fetch = async (input, init) => {
      const auth = authenticatedResponse(input);
      if (auth) return auth;
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      requests.push({ method: request.method, table: url.pathname.split('/').pop(), body: request.method === 'GET' ? null : JSON.parse(await request.clone().text()) });
      return new Response(request.method === 'GET' ? '[{"id":"one"}]' : '[]', { status: request.method === 'GET' ? 200 : 201, headers: { 'content-type': 'application/json' } });
    };
    service.initSupabase(config.supabaseUrl, config.supabaseKey, config.syncId);
    await service.pushChanges(config, [], [], [], {}, 1, 0, {}, {}, {}, { 'cat-1': 500 }, 0, { 'cat-1': 'Food' });
    const categoryTombstone = requests.flatMap(request => request.body || []).find(row => row.id === 'cat-1');
    assert.equal(categoryTombstone.deleted, true);
    assert.deepEqual(categoryTombstone.data, { name: 'Food' });
    requests.length = 0;
    await service.clearSyncData(config);
    assert.deepEqual(new Set(requests.filter(request => request.method === 'POST').map(request => request.table)), new Set(['grid_transactions', 'grid_plans', 'grid_categories', 'grid_metadata']));
  } finally {
    globalThis.fetch = originalFetch;
    service.initSupabase('', '');
  }
});

test('cycle metadata uploads independently and a newer local cycle value beats older cloud metadata', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  try {
    globalThis.fetch = async (input, init) => {
      const auth = authenticatedResponse(input);
      if (auth) return auth;
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      requests.push({ table: url.pathname.split('/').pop(), body: request.method === 'POST' ? JSON.parse(await request.clone().text()) : null });
      return new Response('[]', { status: 201, headers: { 'content-type': 'application/json' } });
    };
    service.initSupabase(config.supabaseUrl, config.supabaseKey, config.syncId);
    await service.pushChanges(config, [], [], [], {}, 15, 10, {}, {}, {}, {}, 20);
    assert.ok(requests.some(request => request.table === 'grid_metadata' && request.body.cycle_start_day === 15 && request.body.updated_at === 20));
    const merged = service.mergeDeltas({ ...currentState(), cycleStartDay: 15, cycleStartDayLastModified: 300 }, {
      transactions: [], plans: [], categories: [], metadata: { cycle_start_day: 2, updated_at: 200 },
    });
    assert.equal(merged.cycleStartDay, 15);
  } finally {
    globalThis.fetch = originalFetch;
    service.initSupabase('', '');
  }
});

test('same transaction and plan ID remain independent under an entity deletion', () => {
  const merged = service.mergeDeltas(currentState([{ id: 'shared', lastModified: 50 }], [{ id: 'shared', lastModified: 50 }]), {
    transactions: [{ id: 'shared', data: {}, updated_at: 100, deleted: true }],
    plans: [], categories: [], metadata: null,
  });
  assert.deepEqual(merged.transactions, []);
  assert.deepEqual(merged.plans, [{ id: 'shared', lastModified: 50 }]);
  assert.equal(merged.transactionDeletedIds.shared, 100);
  assert.equal(merged.planDeletedIds.shared, undefined);
});

test('sync triggers during an active run coalesce to one non-overlapping follow-up', () => {
  const appSource = readFileSync(path.resolve('App.tsx'), 'utf8');
  assert.match(appSource, /if \(isSyncingRef\.current\) \{ syncPendingRef\.current = true; return; \}/);
  assert.match(appSource, /const rerun = shouldResync \|\| syncPendingRef\.current;\s*syncPendingRef\.current = false;\s*if \(rerun\) window\.setTimeout\(\(\) => triggerSync\(\), 0\);/);
  assert.equal((appSource.match(/syncPendingRef\.current = true/g) || []).length, 1);
});

test('clearSyncData tombstones only rows in the configured sync partition and resets metadata', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  try {
    globalThis.fetch = async (input, init) => {
      const auth = authenticatedResponse(input);
      if (auth) return auth;
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      const table = url.pathname.split('/').pop();
      requests.push({ method: request.method, url, body: request.method === 'GET' ? null : JSON.parse(await request.clone().text()) });
      if (request.method === 'GET') {
        return new Response(JSON.stringify([{ id: `${table}-one` }]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('[]', { status: 201, headers: { 'content-type': 'application/json' } });
    };
    service.initSupabase(config.supabaseUrl, config.supabaseKey, config.syncId);
    const result = await service.clearSyncData(config);
    assert.equal(result.success, true);
    for (const request of requests.filter(item => item.method === 'GET')) {
      assert.equal(request.url.searchParams.get('sync_id'), 'eq.test-sync');
    }
    const tombstones = requests.filter(request => request.method === 'POST').flatMap(request => request.body);
    assert.equal(tombstones.filter(row => row.deleted).length, 3);
    assert.ok(tombstones.every(row => row.sync_id === config.syncId));
    assert.ok(tombstones.filter(row => row.deleted).every(row => row.data && Object.keys(row.data).length === 0));
    assert.ok(tombstones.some(row => row.cycle_start_day === 1));
  } finally {
    globalThis.fetch = originalFetch;
    service.initSupabase('', '');
  }
});

test('clearSyncData reports partial cloud failures', async () => {
  const originalFetch = globalThis.fetch;
  let writes = 0;
  try {
    globalThis.fetch = async (input, init) => {
      const auth = authenticatedResponse(input);
      if (auth) return auth;
      const request = input instanceof Request ? input : new Request(input, init);
      if (request.method === 'GET') return new Response('[{"id":"record"}]', { status: 200, headers: { 'content-type': 'application/json' } });
      writes++;
      return writes === 2
        ? new Response('{"message":"write failed"}', { status: 500, headers: { 'content-type': 'application/json' } })
        : new Response('[]', { status: 201, headers: { 'content-type': 'application/json' } });
    };
    service.initSupabase(config.supabaseUrl, config.supabaseKey, config.syncId);
    const result = await service.clearSyncData(config);
    assert.equal(result.success, false);
    assert.ok(result.error);
  } finally {
    globalThis.fetch = originalFetch;
    service.initSupabase('', '');
  }
});

test('a rollback-stamped local edit still beats an older remote tombstone after logical-clock stamping', () => {
  const local = { id: 'rollback-edit', lastModified: 501 };
  const merged = service.mergeDeltas(currentState([local]), {
    transactions: [{ id: local.id, updated_at: 500, deleted: true }], plans: [], categories: [], metadata: null,
  });
  assert.deepEqual(merged.transactions, [local]);
  assert.equal(merged.transactionDeletedIds[local.id], undefined);
});

test('a local tombstone remains authoritative against an older remote row after clock rollback', () => {
  const local = currentState();
  local.transactionDeletedIds = { 'rollback-delete': 501 };
  const merged = service.mergeDeltas(local, {
    transactions: [{ id: 'rollback-delete', updated_at: 500, deleted: false, data: { id: 'rollback-delete', lastModified: 500 } }],
    plans: [], categories: [], metadata: null,
  });
  assert.deepEqual(merged.transactions, []);
  assert.equal(merged.transactionDeletedIds['rollback-delete'], 501);
});

test('timestamped local operations below the watermark are safely rebased when the cloud has no newer ID', async () => {
  const originalFetch = globalThis.fetch;
  const writes = [];
  try {
    globalThis.fetch = async (input, init) => {
      const auth = authenticatedResponse(input);
      if (auth) return auth;
      const request = input instanceof Request ? input : new Request(input, init);
      if (request.method === 'GET') return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
      writes.push(JSON.parse(await request.clone().text()));
      return new Response('[]', { status: 201, headers: { 'content-type': 'application/json' } });
    };
    service.initSupabase(config.supabaseUrl, config.supabaseKey, config.syncId);
    const result = await service.pushChanges(config,
      [{ id: 'offline-old-edit', lastModified: 50 }], [],
      [{ id: 'old-category', name: 'Food', lastModified: 60 }], {}, 15, 100,
      {}, { 'old-delete': 70 }, {}, {}, 80);
    assert.equal(result.success, true);
    const rows = writes.flat();
    assert.ok(rows.some(row => row.id === 'offline-old-edit' && row.updated_at > 100 && row.data.lastModified === row.updated_at));
    assert.ok(rows.some(row => row.id === 'old-delete' && row.deleted && row.updated_at > 100));
    assert.ok(rows.some(row => row.id === 'old-category' && row.updated_at > 100 && row.data.lastModified === row.updated_at));
    assert.ok(rows.some(row => row.cycle_start_day === 15 && row.updated_at > 100));
  } finally {
    globalThis.fetch = originalFetch;
    service.initSupabase('', '');
  }
});

test('complete backup reconciliation tombstones omitted IDs and installs imported records and billing metadata', async () => {
  const originalFetch = globalThis.fetch;
  const writes = [];
  let cloudCycleStartDay = 1;
  let cloudCycleUpdatedAt = 900;
  const cloud = {
    grid_transactions: [
      { sync_id: config.syncId, id: 'A', data: { id: 'A' }, updated_at: 800, deleted: false },
      { sync_id: config.syncId, id: 'B', data: { id: 'B' }, updated_at: 801, deleted: false },
      { sync_id: 'another-sync', id: 'untouched', data: {}, updated_at: 950, deleted: false },
    ],
    grid_plans: [{ sync_id: config.syncId, id: 'old-plan', data: {}, updated_at: 802, deleted: false }],
    grid_categories: [{ sync_id: config.syncId, id: 'old-category', data: { name: 'Old' }, updated_at: 803, deleted: false }],
  };
  try {
    globalThis.fetch = async (input, init) => {
      const auth = authenticatedResponse(input);
      if (auth) return auth;
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      const table = url.pathname.split('/').at(-1);
      assert.equal(request.headers.get('x-gridfinance-sync-id'), config.syncId);
      if (request.method === 'GET') {
        assert.equal(url.searchParams.get('sync_id'), `eq.${config.syncId}`);
        return new Response(JSON.stringify(table === 'grid_metadata' ? [{ cycle_start_day: cloudCycleStartDay, updated_at: cloudCycleUpdatedAt }] : (cloud[table] || []).filter(row => row.sync_id === config.syncId)), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      const rows = JSON.parse(await request.clone().text());
      writes.push({ table, rows });
      if (Array.isArray(rows) && cloud[table]) {
        rows.forEach(row => {
          const index = cloud[table].findIndex(existing => existing.sync_id === row.sync_id && existing.id === row.id);
          if (index < 0) cloud[table].push(row); else cloud[table][index] = row;
        });
      }
      if (table === 'grid_metadata') { cloudCycleStartDay = rows.cycle_start_day; cloudCycleUpdatedAt = rows.updated_at; }
      return new Response('[]', { status: 201, headers: { 'content-type': 'application/json' } });
    };
    service.initSupabase(config.supabaseUrl, config.supabaseKey, config.syncId);
    const imported = {
      transactions: [{ id: 'A', date: '2026-09-29', description: 'A', amount: 2, type: 'expense', tags: [], isPaid: true, createdAt: 1 }, { id: 'backup-only', date: '2026-09-29', description: 'New', amount: 3, type: 'income', tags: [], isPaid: true, createdAt: 2 }],
      plans: [{ id: 'new-plan', description: 'Plan', amount: 4, type: 'expense', frequency: 'Monthly', startDate: '2026-09-01', occurrencesGenerated: 0, tags: [], createdAt: 3 }],
      categoryDefs: [{ id: 'new-category', name: 'New', color: 'blue' }],
      cycleStartDay: 7,
      deletedIds: {}, transactionDeletedIds: {}, planDeletedIds: {}, deletedCategoryIds: {}, deletedCategoryNames: {},
    };
    const result = await service.reconcileImportedBackup(config, imported);
    assert.equal(result.success, true, JSON.stringify(result.error));
    assert.deepEqual(result.backup.transactions.map(row => row.id), ['A', 'backup-only']);
    assert.equal(result.backup.transactions.find(row => row.id === 'A').isPaid, true);
    assert.ok(result.backup.transactions[0].lastModified > 900);
    assert.ok(result.backup.transactionDeletedIds.B > 900);
    assert.ok(result.backup.planDeletedIds['old-plan'] > 900);
    assert.ok(result.backup.deletedCategoryIds['old-category'] > 900);
    assert.equal(result.backup.cycleStartDayLastModified > 900, true);
    const allWrites = writes.flatMap(write => write.rows);
    assert.ok(allWrites.some(row => row.id === 'B' && row.deleted));
    assert.ok(allWrites.some(row => row.id === 'backup-only' && !row.deleted));
    assert.ok(allWrites.some(row => row.id === 'old-plan' && row.deleted));
    assert.ok(allWrites.some(row => row.id === 'old-category' && row.deleted));
    assert.ok(writes.some(write => write.table === 'grid_metadata' && write.rows.cycle_start_day === 7));
    assert.ok(!allWrites.some(row => row.id === 'untouched'));

    const nextPull = await service.pullChanges(config, 0);
    assert.equal(nextPull.success, true);
    const afterNextSync = service.mergeDeltas({
      ...currentState(result.backup.transactions, result.backup.plans),
      categoryDefs: result.backup.categoryDefs,
      transactionDeletedIds: result.backup.transactionDeletedIds,
      planDeletedIds: result.backup.planDeletedIds,
      deletedCategoryIds: result.backup.deletedCategoryIds,
      deletedCategoryNames: result.backup.deletedCategoryNames,
    }, nextPull.changes);
    assert.deepEqual(afterNextSync.transactions.map(row => row.id).sort(), ['A', 'backup-only']);
    assert.equal(afterNextSync.transactions.find(row => row.id === 'A').isPaid, true);
    assert.equal(afterNextSync.plans.some(row => row.id === 'new-plan'), true);
    assert.deepEqual(afterNextSync.categoryDefs.map(row => row.id), ['new-category']);
    assert.equal(afterNextSync.cycleStartDay, 7);
  } finally {
    globalThis.fetch = originalFetch;
    service.initSupabase('', '');
  }
});

test('failed backup cloud reconciliation is reported as unsuccessful', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input, init) => {
      const auth = authenticatedResponse(input);
      if (auth) return auth;
      const request = input instanceof Request ? input : new Request(input, init);
      const table = new URL(request.url).pathname.split('/').at(-1);
      if (request.method === 'GET') return new Response(table === 'grid_metadata' ? '[]' : '[]', { status: 200, headers: { 'content-type': 'application/json' } });
      if (table === 'grid_plans') return new Response('{"message":"write failed"}', { status: 500, headers: { 'content-type': 'application/json' } });
      return new Response('[]', { status: 201, headers: { 'content-type': 'application/json' } });
    };
    service.initSupabase(config.supabaseUrl, config.supabaseKey, config.syncId);
    const result = await service.reconcileImportedBackup(config, {
      transactions: [], plans: [{ id: 'plan', description: 'Plan', amount: 1, type: 'expense', frequency: 'Monthly', startDate: '2026-09-01', occurrencesGenerated: 0, tags: [], createdAt: 1 }], categoryDefs: [], cycleStartDay: 1,
    });
    assert.equal(result.success, false);
    assert.equal(result.backup, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    service.initSupabase('', '');
  }
});

test('backup import reconciliation stays local when sync is disabled', async () => {
  service.initSupabase('', '');
  const backup = { transactions: [], plans: [], categoryDefs: [], cycleStartDay: 1 };
  const result = await service.reconcileImportedBackup({ ...config, enabled: false, syncId: '' }, backup);
  assert.equal(result.success, true);
  assert.equal(result.backup, backup);
});
