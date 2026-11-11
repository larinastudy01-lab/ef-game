const { test } = require('node:test');
const assert = require('node:assert/strict');
const { auditSnapshot, readOnlyFetch } = require('./audit-history.cjs');
const { loadSource } = require('./source-loader.cjs');
const { buildBehavioralHierarchy } = loadSource('src/analytics/trials/buildBehavioralHierarchy.js');
const { behavioralDerivationRows } = loadSource('src/lib/behavioralSync.js');
const empty = () => ({ game_results: [], research_participants: [], behavioral_sessions: [], behavioral_task_sessions: [], behavioral_trials: [], behavioral_trial_derivations: [] });
const result = (game = 'PM', trials = [{ trialNumber: 1, selectedIds: ['target'], isCorrect: true, reactionTime: 1000 }]) => ({
  id: 'private-result-id', patient_id: 'private-patient-id', game_id: game, mode: 'test', total_trials: trials.length,
  payload: { syncStatus: 'synced', game: { gameId: game }, trials, summary: { totalTrials: trials.length } },
});

test('history audit includes already synced records and leaves the input unchanged', () => {
  const snapshot = empty(); snapshot.game_results.push(result());
  const before = JSON.stringify(snapshot);
  const report = auditSnapshot(snapshot);
  assert.equal(report.issueCounts.claimed_synced_but_incomplete, 1);
  assert.equal(report.sourceTrialCount, 1);
  assert.ok(report.results[0].issues.includes('missing_session'));
  assert.equal(JSON.stringify(snapshot), before);
  assert.ok(!JSON.stringify(report).includes('private-'));
});

test('history audit distinguishes PM unknown denominator, timeout and legal cancellation', () => {
  const snapshot = empty();
  snapshot.game_results.push(result('PM', [{ administered: false, isCorrect: null }]));
  const pm = auditSnapshot(snapshot).results[0].pm;
  assert.equal(pm.timeoutRate, null); assert.equal(pm.status, 'not_calculable_no_administered_trials');
  snapshot.game_results[0] = result('PM', [
    { isTimeout: true, isCorrect: false, reactionTime: 15000 },
    { isCorrect: true, reactionTime: -1, selectedIds: ['target'], deselectCount: 3 },
  ]);
  const updated = auditSnapshot(snapshot).results[0].pm;
  assert.equal(updated.timeoutRate, 0.5); assert.equal(updated.administered, 2);
  assert.equal(updated.deselectionTrialsWithoutDuplicateEvidence, 1);
  assert.equal(updated.storedFalseDoubleClickExclusions, null, 'absence of stored derivations is not proof of zero historical exclusions');
});

test('history audit flags unresolved legacy training collisions for manual review', () => {
  const snapshot = empty(); snapshot.game_results.push(result('LB', [
    { stepIndex: 0, expectedKey: '1' }, { stepIndex: 0, expectedKey: '2' },
  ]));
  const row = auditSnapshot(snapshot).results[0];
  assert.equal(row.canonicalDuplicateKeyCount, 1); assert.equal(row.repairDisposition, 'manual_review');
});

test('history audit verifies raw content and current derivation identities, not just counts', () => {
  const snapshot = empty(); const row = result(); snapshot.game_results.push(row);
  snapshot.research_participants.push({ id: 'p', patient_id: row.patient_id });
  snapshot.behavioral_sessions.push({ id: 's', source_result_id: row.id, participant_id: 'p' });
  snapshot.behavioral_task_sessions.push({ id: 't', session_id: 's', task_order_index: 1, total_trials: 1 });
  snapshot.behavioral_trials.push({ id: 'raw', task_session_id: 't', source_trial_key: '1', raw_data: { wrong: 'content' } });
  snapshot.behavioral_trial_derivations.push({ id: 'd', trial_id: 'raw', participant_id: 'p', task_code: 'PM', is_current: true, processing_version: 'trial-normalizer-1.1.0' });
  const report = auditSnapshot(snapshot);
  assert.equal(report.issueCounts.raw_identity_or_content_conflict, 1);
  assert.equal(report.issueCounts.claimed_synced_but_incomplete, 1);
});

test('read-only transport refuses every write method before network access', async () => {
  let calls = 0; const wrapped = readOnlyFetch(async () => { calls += 1; return 'read'; });
  for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) assert.throws(() => wrapped('https://example.invalid', { method }), /GET\/HEAD/);
  assert.equal(calls, 0);
  assert.equal(await wrapped('https://example.invalid', { method: 'GET' }), 'read');
});

test('matching counts/IDs cannot hide changed derived answers in the current processing version', () => {
  const snapshot = empty(); const row = result(); snapshot.game_results.push(row);
  const hierarchy = buildBehavioralHierarchy({ ...row.payload, resultId: row.id,
    behavioral: { sessionId: 's', taskSessionId: 't', trialIds: ['raw'] } });
  snapshot.research_participants.push({ id: 'p', patient_id: row.patient_id });
  snapshot.behavioral_sessions.push({ id: 's', source_result_id: row.id, participant_id: 'p' });
  snapshot.behavioral_task_sessions.push({ id: 't', session_id: 's', task_order_index: 1, total_trials: 1 });
  snapshot.behavioral_trials.push({ id: 'raw', task_session_id: 't', source_trial_key: '1', raw_data: row.payload.trials[0] });
  snapshot.behavioral_trial_derivations.push(...behavioralDerivationRows(hierarchy, 'p'));
  assert.equal(auditSnapshot(snapshot).results[0].repairDisposition, 'complete');
  snapshot.behavioral_trial_derivations[0].actual_response = ['changed'];
  assert.equal(auditSnapshot(snapshot).issueCounts.current_derivation_content_mismatch, 1);
});
