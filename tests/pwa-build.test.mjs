import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const dist = path.resolve('dist');

test('production PWA resources resolve from the GitHub Pages application root', () => {
  const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
  const manifest = JSON.parse(readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
  const serviceWorker = readFileSync(path.join(dist, 'sw.js'), 'utf8');

  assert.match(html, /<link rel="manifest" href="\/GridFinance\/manifest\.json"\s*\/>/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/GridFinance\/icon\.svg"\s*\/>/);
  assert.match(html, /href="\/GridFinance\/assets\/index\.css"/);
  assert.doesNotMatch(html, /cdn\.tailwindcss\.com/);
  assert.doesNotMatch(html, /cdn-icons-png\.flaticon\.com|importmap/);
  assert.match(html, /register\('\.\/sw\.js'\)/);
  assert.equal(new URL(manifest.start_url, 'https://nicat93.github.io/GridFinance/manifest.json').pathname, '/GridFinance/');
  assert.equal(new URL(manifest.scope, 'https://nicat93.github.io/GridFinance/manifest.json').pathname, '/GridFinance/');
  assert.equal(new URL(manifest.icons[0].src, 'https://nicat93.github.io/GridFinance/manifest.json').pathname, '/GridFinance/icon.svg');
  assert.equal(existsSync(path.join(dist, 'icon.svg')), true);
  assert.equal(existsSync(path.join(dist, 'assets', 'index.css')), true);
  assert.equal(existsSync(path.join(dist, 'assets', 'manifest.json')), false);
  assert.equal(new URL('./sw.js', 'https://nicat93.github.io/GridFinance/').pathname, '/GridFinance/sw.js');
  assert.match(serviceWorker, /self\.skipWaiting\(\)/);
  assert.match(serviceWorker, /'\.\/assets\/index\.css'/);
  assert.match(serviceWorker, /'\.\/icon\.svg'/);
  assert.doesNotMatch(serviceWorker, /cdn\.tailwindcss\.com/);
  assert.match(serviceWorker, /fetch\(event\.request\)[\s\S]*caches\.match\(event\.request\)/);
  assert.match(serviceWorker, /if \(cache !== CACHE_NAME\)[\s\S]*caches\.delete\(cache\)/);
});
