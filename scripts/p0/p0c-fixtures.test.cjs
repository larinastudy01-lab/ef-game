const { test } = require('node:test');
const assert = require('node:assert/strict');
const { syntheticResult } = require('./p0c-fixtures.cjs');
const { loadSource } = require('./source-loader.cjs');
const { buildBehavioralHierarchy } = loadSource('src/analytics/trials/buildBehavioralHierarchy.js');
const { buildTaskFeatureRow } = loadSource('src/analytics/features/pipeline.js');
test('synthetic LB has repeated original stepIndex, unique stage-qualified keys and stable given UUIDs', () => {
  const r = syntheticResult('LB'); const before = JSON.stringify(r); const h = buildBehavioralHierarchy(r);
  assert.equal(r.trials[0].stepIndex, r.trials[10].stepIndex); assert.equal(new Set(h.trials.map((t) => t.sourceTrialKey)).size, 20);
  assert.deepEqual(h.trials.map((t) => t.trialId), r.behavioral.trialIds); assert.equal(JSON.stringify(r), before);
});
test('synthetic PM timeout denominator retains excluded timeouts but drops planned slots', () => {
  const r = syntheticResult('PM', { count: 12, timeoutCount: 3, plannedCount: 2 }); const before = JSON.stringify(r);
  const h = buildBehavioralHierarchy(r); const f = buildTaskFeatureRow({ taskSession: h.taskSession, trials: h.trials });
  assert.equal(f.pm_timeout_rate, 0.25); assert.equal(f.pm_administered_trial_count, 12);
  assert.equal(h.trials[3].doubleClickCount, null); assert.equal(h.trials[3].validTrial, true);
  assert.equal(JSON.stringify(r), before);
});
test('synthetic CBT early-stop/unused-slot evidence and ARI code survive normalization', () => {
  const r = syntheticResult('CBT', { count: 2, plannedCount: 1, earlyStop: true }); const h = buildBehavioralHierarchy(r);
  assert.equal(h.trials[2].rawData.administered, false); assert.equal(h.trials[2].validTrial, false);
  assert.equal(r.rawResult.earlyStop, true); assert.equal(buildBehavioralHierarchy(syntheticResult('ARI')).taskSession.taskCode, 'ARI');
});
