import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync('App.tsx', 'utf8');

test('online and offline sync listeners are removed with their registered callbacks', () => {
  assert.match(app, /const handleOnline = \(\) => triggerSync\(\);/);
  assert.match(app, /const handleOffline = \(\) => setSyncStatus\('offline'\);/);
  assert.match(app, /addEventListener\('online', handleOnline\);[\s\S]*addEventListener\('offline', handleOffline\);/);
  assert.match(app, /removeEventListener\('online', handleOnline\);[\s\S]*removeEventListener\('offline', handleOffline\);/);
});
