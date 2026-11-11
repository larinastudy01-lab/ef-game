const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classifyPreflight } = require('./preflight.cjs');
const seed = () => ({ snapshotAt: 'synthetic', coverage: 'synthetic_only', schema: { checks: [
  { name: 'behavioral_task_sessions_task_code_check', definition: "CHECK(task_code IN ('CBT','PM','SRT','SSG','LB','DCCS'))" },
  { name: 'behavioral_trial_derivations_task_code_check', definition: "CHECK(task_code IN ('CBT','PM','SRT','SSG','LB','DCCS'))" },
] }, records: [{ main_result_id: 'private-result-id', result_ref: 'redacted-ref', game_id: 'PM', mode: 'test', payload_type: 'object',
  source_trial_count: 1, declared_trial_count: 1, owner_binding_valid: true, payload_patient_matches: true,
  original_trial_ids: [], stored_trial_count: 0, stored_current_derivation_count: 0, sync_status: 'synced',
  pm_projection: [{ isCorrect: true, selectedIds: ['target'], reactionTime: 1000, isTimeout: false }] }] });
test('A classification retains global safety gates and never authorizes application', () => {
  const snapshot = seed(); const original = JSON.stringify(snapshot); const r = classifyPreflight(snapshot);
  assert.equal(r.categories.A.results, 1); assert.equal(r.records[0].applyAuthorized, false);
  assert.equal(r.totals.incorrectlySynced, 1); assert.equal(JSON.stringify(snapshot), original);
  assert.ok(!JSON.stringify(r).includes('private-result-id'));
});
test('ARI requires BOTH real CHECK definitions to be compatible', () => {
  const snapshot = seed(); snapshot.records[0].game_id = 'ARI';
  const r = classifyPreflight(snapshot).records[0]; assert.equal(r.primaryCategory, 'B'); assert.equal(r.missingSchema.length, 2);
});
test('all reasons survive precedence D > C > B; missing raw data is never invented', () => {
  const snapshot = seed(); Object.assign(snapshot.records[0], { game_id: 'ARI', source_trial_count: 0, canonical_duplicate_key_count: 2 });
  const r = classifyPreflight(snapshot).records[0]; assert.equal(r.primaryCategory, 'D');
  assert.deepEqual(r.problemCategories, ['D', 'C', 'B']); assert.equal(r.expectedResearchTrialCount, null);
});
test('counts alone cannot qualify as a complete E hierarchy', () => {
  const snapshot = seed(); Object.assign(snapshot.records[0], { session_id: 's', task_session_id: 't', stored_task_total: 1, stored_trial_count: 1, stored_current_derivation_count: 1 });
  assert.equal(classifyPreflight(snapshot).records[0].primaryCategory, 'C');
  snapshot.records[0].exact_hierarchy_verified = true;
  assert.equal(classifyPreflight(snapshot).records[0].primaryCategory, 'E');
});
test('PM all-unadministered input preserves null rather than fabricating zero', () => {
  const snapshot = seed(); snapshot.records[0].pm_projection = [{ administered: false }];
  const pm = classifyPreflight(snapshot).records[0].pm;
  assert.equal(pm.timeoutRate, null); assert.equal(pm.status, 'not_calculable_no_administered_trials');
});
test('conflicting original identities require manual review', () => {
  const snapshot = seed(); snapshot.records[0].payload_result_id = 'other-result'; snapshot.records[0].original_trial_ids = ['invalid'];
  const r = classifyPreflight(snapshot).records[0]; assert.equal(r.primaryCategory, 'C');
  assert.ok(r.reasons.includes('invalid_or_conflicting_original_research_ids'));
});
