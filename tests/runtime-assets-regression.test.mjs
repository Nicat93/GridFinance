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

test('bundled fonts cover Azerbaijani schwa and are precached for offline use', () => {
  const entry = readFileSync('index.tsx', 'utf8');
  const tailwind = readFileSync('tailwind.config.js', 'utf8');
  for (const family of ['inter', 'jetbrains-mono']) {
    for (const weight of [400, 500, 700]) {
      assert.match(entry, new RegExp(`@fontsource/${family}/latin-ext-${weight}\\.css`));
      assert.match(serviceWorker, new RegExp(`'\\./assets/${family}-latin-ext-${weight}-normal\\.woff2'`));
    }
  }
  assert.match(tailwind, /sans: \['Inter'/);
  assert.match(tailwind, /mono: \['JetBrains Mono'/);
});
