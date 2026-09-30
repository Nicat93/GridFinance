import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

test('repeated service initialization reuses one client and updates the sync partition header', () => {
  const servicePath = path.resolve('services/supabaseService.ts');
  const { outputText: code } = ts.transpileModule(readFileSync(servicePath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const constructions = [];
  const originalLoad = Module._load;
  let service;
  try {
    Module._load = function (request, parent, isMain) {
      if (request === '@supabase/supabase-js') {
        return {
          createClient: (url, key, options) => {
            const client = {};
            constructions.push({ url, key, options, client });
            return client;
          },
        };
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    const serviceModule = new Module(servicePath);
    serviceModule.filename = servicePath;
    serviceModule.paths = Module._nodeModulePaths(path.dirname(servicePath));
    serviceModule._compile(code, servicePath);
    service = serviceModule.exports;
  } finally {
    Module._load = originalLoad;
  }

  service.initSupabase('https://singleton-test.supabase.co', 'anon-key', 'sync-one');
  service.initSupabase('https://singleton-test.supabase.co', 'anon-key', 'sync-one');
  service.initSupabase('https://singleton-test.supabase.co', 'anon-key', 'sync-two');

  assert.equal(constructions.length, 1);
  assert.deepEqual(constructions[0].options.global.headers, { 'x-gridfinance-sync-id': 'sync-two' });
  assert.deepEqual(constructions[0].options.auth, {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  });

  service.initSupabase('', '');
});
