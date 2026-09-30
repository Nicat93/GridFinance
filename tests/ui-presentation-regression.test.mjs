import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const transpile = (module, filePath) => {
  const { outputText: code } = ts.transpileModule(readFileSync(filePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
  });
  module._compile(code, filePath);
};
require.extensions['.ts'] = transpile;
require.extensions['.tsx'] = transpile;

const loadTypeScript = (relativePath) => {
  const filePath = path.resolve(relativePath);
  const { outputText: code } = ts.transpileModule(readFileSync(filePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
  });
  const loaded = new Module(filePath);
  loaded.filename = filePath;
  loaded.paths = Module._nodeModulePaths(path.dirname(filePath));
  loaded._compile(code, filePath);
  return loaded.exports;
};

const { formatMoney, formatTransactionAmount, getHistoryEmptyState } = loadTypeScript('services/presentation.ts');
const { handleExpandableRowKeyboardActivation } = loadTypeScript('services/keyboardAccessibility.ts');

test('summary formatting preserves exact cents and large digits for normal and large balances', () => {
  const digits = value => value.replace(/\D/g, '');
  assert.match(formatMoney(850), /^850[.,]00$/);
  assert.match(formatMoney(880.25), /^880[.,]25$/);
  assert.equal(digits(formatMoney(1234567890123.45)), '123456789012345');
  const largeRange = `${formatMoney(999999999999.99)} – ${formatMoney(1000000000000)}`.split(' – ');
  assert.equal(digits(largeRange[0]), digits(formatMoney(999999999999.99)));
  assert.equal(digits(largeRange[1]), digits(formatMoney(1000000000000)));
});

test('expense display uses the same signed amount and range convention in History and Planned', () => {
  const money = formatMoney(20);
  assert.equal(formatTransactionAmount('expense', 20), `−${money}`);
  assert.equal(formatTransactionAmount('expense', 20, 25), `−(${money} – ${formatMoney(25)})`);
  assert.equal(formatTransactionAmount('income', 20), `+${money}`);
  assert.equal(formatTransactionAmount('income', 20, 25), `+${money}`);
});

test('history distinguishes a genuinely empty ledger from an active search or date filter', () => {
  assert.equal(getHistoryEmptyState(0, ''), 'empty');
  assert.equal(getHistoryEmptyState(0, '  '), 'empty');
  assert.equal(getHistoryEmptyState(0, 'coffee'), 'noMatches');
  assert.equal(getHistoryEmptyState(0, '', '2026-01-01'), 'noMatches');
  assert.equal(getHistoryEmptyState(2, ''), 'noMatches');
});

test('expandable rows activate on Enter and Space and ignore nested controls', () => {
  for (const key of ['Enter', ' ']) {
    let activated = 0;
    const flags = { prevented: false, stopped: false };
    const row = {};
    const handled = handleExpandableRowKeyboardActivation({
      key,
      target: row,
      currentTarget: row,
      preventDefault: () => { flags.prevented = true; },
      stopPropagation: () => { flags.stopped = true; },
    }, () => { activated += 1; });
    assert.equal(handled, true);
    assert.equal(activated, 1);
    assert.deepEqual(flags, { prevented: true, stopped: true });

    const child = {};
    assert.equal(handleExpandableRowKeyboardActivation({
      key,
      target: child,
      currentTarget: row,
      preventDefault: () => assert.fail('nested controls must keep their keyboard action'),
      stopPropagation: () => assert.fail('nested controls must not be swallowed'),
    }, () => assert.fail('nested controls must not toggle the row')), false);
  }
});

test('calculator triggers render as keyboard-operable buttons with accessible names and values', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: AddTransactionModal } = loadTypeScript('components/AddTransactionModal.tsx');
  const html = renderToStaticMarkup(React.createElement(AddTransactionModal, {
    isOpen: true, onClose: () => {}, onSave: () => {}, categories: [], language: 'en',
  }));
  assert.match(html, /<button type="button" aria-label="Amount: 0\.00" aria-haspopup="dialog"/);
  assert.match(html, /<button type="button" aria-label="Max: not set" aria-haspopup="dialog"/);
  assert.equal((html.match(/max-\[360px\]:min-h-11/g) ?? []).length, 2, 'both narrow-layout type controls must have 44px minimum hit areas');
  assert.match(html, /focus-visible:outline-indigo-500/);
});
