import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const trackerPath = path.resolve('services/syncWorkTracker.ts');
const { outputText } = ts.transpileModule(readFileSync(trackerPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const trackerModule = new Module(trackerPath);
trackerModule.filename = trackerPath;
trackerModule.paths = Module._nodeModulePaths(path.dirname(trackerPath));
trackerModule._compile(outputText, trackerPath);
const { SyncWorkTracker } = trackerModule.exports;

test('ordinary local work before a run is covered by that one run', () => {
  const work = new SyncWorkTracker();
  work.markLocalWork();
  work.markLocalWork();
  work.beginRun();
  assert.equal(work.needsFollowUp(true, false, false), false);
});

test('duplicate startup, focus, visibility, and network wakeups do not create pending work', () => {
  const work = new SyncWorkTracker();
  work.beginRun();
  assert.equal(work.needsFollowUp(true, false, false), false);
});

test('a real local mutation during an active run requires exactly one follow-up', () => {
  const work = new SyncWorkTracker();
  work.beginRun();
  work.markLocalWork();
  assert.equal(work.needsFollowUp(true, false, false), true);
  work.beginRun();
  assert.equal(work.needsFollowUp(true, false, false), false);
});

test('several local mutations during a run coalesce into one follow-up', () => {
  const work = new SyncWorkTracker();
  work.beginRun();
  work.markLocalWork();
  work.markLocalWork();
  work.markLocalWork();
  assert.equal(work.needsFollowUp(true, false, false), true);
  work.beginRun();
  assert.equal(work.needsFollowUp(true, false, false), false);
});

test('a mutation during the follow-up remains pending for one more run', () => {
  const work = new SyncWorkTracker();
  work.beginRun();
  work.markLocalWork();
  assert.equal(work.needsFollowUp(true, false, false), true);
  work.beginRun();
  work.markLocalWork();
  assert.equal(work.needsFollowUp(true, false, false), true);
});

test('failed sync does not spin, and the dirty generation remains for a later retry', () => {
  const work = new SyncWorkTracker();
  work.beginRun();
  work.markLocalWork();
  assert.equal(work.needsFollowUp(false, false, false), false);
  work.beginRun();
  assert.equal(work.needsFollowUp(true, false, false), false);
});

test('target changes still force a pass, while sync merges are fingerprint-suppressed', () => {
  const work = new SyncWorkTracker();
  work.beginRun();
  assert.equal(work.needsFollowUp(false, false, true), true);
  const app = readFileSync(path.resolve('App.tsx'), 'utf8');
  assert.match(app, /syncGeneratedFingerprintRef\.current = JSON\.stringify\(/);
  assert.match(app, /if \(syncGeneratedFingerprintRef\.current === fingerprint\)/);
});

test('startup is a single forced sync trigger and collection updates do not use an artificial timer', () => {
  const app = readFileSync(path.resolve('App.tsx'), 'utf8');
  assert.match(app, /if \(syncConfig\.enabled\) triggerSync\(\{ force: true \}\)/);
  assert.match(app, /triggerSync\(\{ localMutation: true \}\)/);
  assert.doesNotMatch(app, /syncTimeoutRef|setTimeout\(attemptSync, 3000\)/);
});
