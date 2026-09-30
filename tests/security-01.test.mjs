import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

Module._extensions['.ts'] = (module, filePath) => {
  const source = readFileSync(filePath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  module._compile(outputText, filePath);
};

const loadTypeScript = (relativePath) => {
  const filePath = path.resolve(relativePath);
  const { outputText: code } = ts.transpileModule(readFileSync(filePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const loaded = new Module(filePath);
  loaded.filename = filePath;
  loaded.paths = Module._nodeModulePaths(path.dirname(filePath));
  loaded._compile(code, filePath);
  return loaded.exports;
};

const { evaluateArithmetic } = loadTypeScript('services/safeArithmetic.ts');
const { validateBackup } = loadTypeScript('services/backupValidation.ts');
const baseTx = { id: 'tx-1', date: '2026-09-29', description: 'Lunch', amount: 12.5, type: 'expense', tags: ['food'], isPaid: false, createdAt: 10 };
const basePlan = { id: 'plan-1', description: 'Rent', amount: 500, type: 'expense', frequency: 'Monthly', startDate: '2026-09-01', occurrencesGenerated: 0, tags: [], createdAt: 10 };
const backup = (transactions = [baseTx], plans = [basePlan]) => ({ transactions, plans, cycleStartDay: 1, deletedIds: {}, categoryDefs: [] });

test('calculator arithmetic supports normal operations and rejects non-arithmetic input', () => {
  assert.equal(evaluateArithmetic('12 + 3'), 15);
  assert.equal(evaluateArithmetic('12 / 4'), 3);
  assert.equal(evaluateArithmetic('2 + 3 * 4'), 14);
  assert.equal(evaluateArithmetic('-2.5 + 4'), 1.5);
  assert.throws(() => evaluateArithmetic('1 / 0'));
  assert.throws(() => evaluateArithmetic('1 + globalThis.__security01 = true'));
});

test('import rejects string amounts without coercion and does not execute payloads', () => {
  globalThis.__security01 = false;
  const payload = 'globalThis.__security01 = true';
  assert.throws(() => validateBackup(backup([{ ...baseTx, amount: payload }])));
  assert.throws(() => validateBackup(backup([baseTx], [{ ...basePlan, amount: payload }])));
  // Text fields are retained as text only; validation and calculator parsing never execute them.
  const acceptedText = validateBackup(backup([{ ...baseTx, description: payload, tags: [payload] }], [{ ...basePlan, description: payload, tags: [payload] }]));
  assert.equal(acceptedText.transactions[0].description, payload);
  assert.equal(acceptedText.plans[0].tags[0], payload);
  assert.equal(globalThis.__security01, false);
  delete globalThis.__security01;
});

test('backup import accepts legacy transactions without a range and preserves valid expense ranges', () => {
  const legacy = validateBackup(backup([baseTx], []));
  assert.equal(Object.hasOwn(legacy.transactions[0], 'approximateUpperAmount'), false);

  const ranged = validateBackup(backup([{ ...baseTx, approximateUpperAmount: 70 }], [{ ...basePlan, approximateUpperAmount: 650 }]));
  assert.equal(ranged.transactions[0].approximateUpperAmount, 70);
  assert.equal(ranged.plans[0].approximateUpperAmount, 650);
  const reloaded = JSON.parse(JSON.stringify(ranged));
  assert.equal(reloaded.transactions[0].approximateUpperAmount, 70);
  assert.equal(reloaded.plans[0].approximateUpperAmount, 650);
});

test('backup import rejects invalid approximate expense bounds and ranges on income', () => {
  assert.throws(() => validateBackup(backup([{ ...baseTx, approximateUpperAmount: 12.49 }], [])));
  assert.throws(() => validateBackup(backup([{ ...baseTx, type: 'income', approximateUpperAmount: 20 }], [])));
  assert.throws(() => validateBackup(backup([baseTx], [{ ...basePlan, approximateUpperAmount: Infinity }])));
});

test('import rejects executable-looking IDs and malformed tags before returning a backup', () => {
  const payloadId = 'globalThis.__security01=true';
  assert.throws(() => validateBackup(backup([{ ...baseTx, id: payloadId }])));
  assert.throws(() => validateBackup(backup([baseTx], [{ ...basePlan, id: payloadId }])));
  assert.throws(() => validateBackup(backup([{ ...baseTx, tags: [42] }])));
  assert.throws(() => validateBackup(backup([baseTx], [{ ...basePlan, tags: [null] }])));
});

test('known older backup fields migrate while financial values remain strictly numeric', () => {
  const { name, ...legacyTx } = baseTx;
  const { name: planName, ...legacyPlan } = basePlan;
  delete legacyTx.description;
  delete legacyTx.tags;
  legacyTx.name = 'Legacy transaction';
  legacyTx.category = 'Food';
  delete legacyTx.createdAt;
  delete legacyTx.isPaid;
  delete legacyPlan.description;
  delete legacyPlan.tags;
  legacyPlan.name = 'Legacy plan';
  legacyPlan.category = 'Home';
  delete legacyPlan.createdAt;
  delete legacyPlan.occurrencesGenerated;
  const migrated = validateBackup({ transactions: [legacyTx], plans: [legacyPlan], savedCategories: ['Food'] }, 99);
  assert.equal(migrated.transactions[0].description, 'Legacy transaction');
  assert.deepEqual(migrated.transactions[0].tags, ['Food']);
  assert.equal(migrated.transactions[0].createdAt, 99);
  assert.equal(migrated.transactions[0].isPaid, false);
  assert.equal(migrated.plans[0].occurrencesGenerated, 0);
  assert.equal(migrated.categoryDefs[0].name, 'Food');
  assert.throws(() => validateBackup(backup([{ ...baseTx, amount: '12.5' }])));
});

test('invalid later records reject the whole imported backup', () => {
  assert.throws(() => validateBackup(backup([baseTx, { ...baseTx, date: '2026-02-30' }])));
  assert.throws(() => validateBackup(backup([baseTx], [{ ...basePlan, occurrencesGenerated: -1 }])));
  assert.throws(() => validateBackup({ ...backup(), deletedIds: { 'gone-id': Infinity } }));
});
