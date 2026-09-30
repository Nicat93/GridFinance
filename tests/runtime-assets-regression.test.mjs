import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync('index.html', 'utf8');
const serviceWorker = readFileSync('public/sw.js', 'utf8');

test('startup uses local GridFinance icons and has no external import map', () => {
  assert.match(html, /<link rel="apple-touch-icon" href="\.\/icon\.svg"\s*\/>/);
  assert.doesNotMatch(html, /<script\s+type="importmap"|https?:\/\//i);
  assert.equal(new URL('./icon.svg', 'https://nicat93.github.io/GridFinance/').pathname, '/GridFinance/icon.svg');
});

test('service worker precaches the local icon used by the app shell', () => {
  assert.match(serviceWorker, /'\.\/icon\.svg'/);
});
