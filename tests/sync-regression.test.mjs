import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { transformSync } from 'esbuild';

const servicePath = path.resolve('services/supabaseService.ts');
const { code } = transformSync(readFileSync(servicePath, 'utf8'), {
  loader: 'ts',
  format: 'cjs',
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
