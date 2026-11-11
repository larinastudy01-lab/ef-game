const fs = require('node:fs');
const path = require('node:path');
const { classifyPreflight } = require('./preflight.cjs');
const { loadSource } = require('./source-loader.cjs');
const { buildBehavioralHierarchy } = loadSource('src/analytics/trials/buildBehavioralHierarchy.js');

function buildReports(snapshot) {
  const report = classifyPreflight(snapshot);
  const rank = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  const synced = report.records.filter((r) => r.sync.incorrectlyClaimedSynced)
    .sort((a, b) => rank[a.primaryCategory] - rank[b.primaryCategory] || a.resultRef.localeCompare(b.resultRef));
  const reconciliation = { dryRun: true, snapshotAt: report.snapshotAt, mainResultState: 'saved', productionStatusUpdated: false,
    ordering: 'A candidates after global gates; B after both CHECK migrations; C/D manual hold. Per-result verification before any future final-state update.',
    rows: synced.map((r, index) => ({ reviewOrder: index + 1, ...r,
      nextAction: r.primaryCategory === 'A' ? 'backup_then_review_frozen_plan_then_isolated_rehearsal'
        : r.primaryCategory === 'B' ? 'validate_schema_and_permissions_before_repair' : 'manual_hold_do_not_apply' })) };
  const lb = snapshot.records.filter((r) => r.game_id === 'LB' && r.canonical_duplicate_key_count > 0).map((r) => {
    const groups = (r.lb_key_evidence || []).reduce((map, t) => { (map[t.oldKey] ||= []).push(t); return map; }, {});
    return { resultRef: r.result_ref, sourceRecords: r.source_trial_count, extraRepeatedKeys: r.canonical_duplicate_key_count,
      duplicateGroups: Object.entries(groups).filter(([, value]) => value.length > 1).map(([key, value]) => ({
        originalSourceKey: key, ordinals: value.map((t) => t.ordinal), levelIds: [...new Set(value.map((t) => t.levelId))],
        steps: value.map((t) => t.stepInLevel), statuses: value.map((t) => t.recordedStatus), correctness: value.map((t) => t.isCorrect),
        distinctRawContentHashes: new Set(value.map((t) => r.source_trial_sha256[t.ordinal - 1])).size,
      })),
      conclusion: 'distinct operations on the same planned step; phase+step remains nonunique; no automatic renaming/deletion/trial inflation',
      manualDecisions: ['confirm original order and individual research UUID mapping', 'define operation event versus attempt versus planned trial',
        'review event linkage without modifying original trialId/step/level/raw content', 'approve a versioned conversion and rollback before any apply'], applyAuthorized: false };
  });
  const pm = snapshot.records.filter((r) => r.game_id === 'PM').map((r) => {
    const h = buildBehavioralHierarchy({ game: { gameId: 'PM' }, session: { mode: r.mode, status: r.completion_status || 'completed' }, trials: r.pm_projection });
    return { resultRef: r.result_ref, ...report.records.find((row) => row.resultRef === r.result_ref).pm,
      deselectionEvidence: h.trials.filter((t) => Number(t.taskSpecificMetadata.deselectCount) > 0).map((t) => ({
        doubleClickCount: t.doubleClickCount, validTrial: t.validTrial, exclusionReasons: t.exclusionReasons,
      })), rawModified: false };
  });
  return { history: report, synced: reconciliation, review: { snapshotAt: report.snapshotAt, lb, pm,
    zeroDenominator: { expectedRate: null, reason: 'not_calculable_no_administered_trials', verification: 'covered_by_local_unit_tests_not_observed_in_historical_PM' } },
  schema: { observedAt: report.snapshotAt, readOnly: true, ...snapshot.schema } };
}
if (require.main === module) {
  const [, , input, directory] = process.argv;
  if (!input || !directory) throw new Error('Usage: build-p0b-reports.cjs PRIVATE_SNAPSHOT.json NEW_OUTPUT_DIRECTORY');
  const reports = buildReports(JSON.parse(fs.readFileSync(input, 'utf8')));
  fs.mkdirSync(directory, { recursive: true });
  for (const [name, value] of Object.entries(reports)) fs.writeFileSync(path.join(directory, `${name}.json`), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ totals: reports.history.totals, categories: reports.history.categories, synced: reports.synced.rows.length, lb: reports.review.lb.length, pm: reports.review.pm.length }));
}
module.exports = { buildReports };
