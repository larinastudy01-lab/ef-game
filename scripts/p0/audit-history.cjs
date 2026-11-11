const { createHash } = require('node:crypto');
const fs = require('node:fs');
const { loadSource } = require('./source-loader.cjs');
const { normalizedStoredResult, reconcileBehavioralTrials, sameBehavioralData, readBehavioralRows, behavioralDerivationRows } = loadSource('src/lib/behavioralSync.js');
const { buildBehavioralHierarchy } = loadSource('src/analytics/trials/buildBehavioralHierarchy.js');
const { buildTaskFeatureRow } = loadSource('src/analytics/features/pipeline.js');
const { TASK_CODES, TRIAL_PROCESSING_VERSION } = loadSource('src/analytics/trials/constants.js');

const resultRef = (id) => createHash('sha256').update(String(id)).digest('hex').slice(0, 20);
const issues = (rows) => rows.reduce((counts, row) => {
  row.issues.forEach((issue) => { counts[issue] = (counts[issue] || 0) + 1; });
  return counts;
}, {});

// No network, mutation, repair, or persistence. Include ALL main rows, even synced.
function auditSnapshot(snapshot) {
  const rows = snapshot.game_results.map((row) => {
    const report = { resultRef: resultRef(row.id), gameId: row.game_id, mode: row.mode, issues: [] };
    try {
      const result = normalizedStoredResult(row);
      const session = snapshot.behavioral_sessions.find((s) => s.source_result_id === row.id);
      const tasks = snapshot.behavioral_task_sessions.filter((t) => t.session_id === session?.id);
      const task = tasks.find((t) => t.task_order_index === 1);
      const raw = snapshot.behavioral_trials.filter((t) => t.task_session_id === task?.id);
      const current = snapshot.behavioral_trial_derivations.filter((d) => d.is_current && raw.some((t) => t.id === d.trial_id));
      const hierarchy = buildBehavioralHierarchy({ ...result, behavioral: { ...result.behavioral,
        ...(session ? { sessionId: session.id } : {}), ...(task ? { taskSessionId: task.id } : {}) } });
      report.expectedTrialCount = result.trials.length;
      report.storedTrialCount = raw.length;
      report.storedCurrentDerivationCount = current.length;
      report.syncStatus = result.syncStatus || null;
      if (!TASK_CODES.includes(hierarchy.taskSession.taskCode)) report.issues.push('unsupported_legacy_task');
      if (Math.max(Number(row.total_trials) || 0, Number(result.summary?.totalTrials) || 0) > result.trials.length) report.issues.push('declared_count_exceeds_available_raw');
      if (!result.trials.length) report.issues.push('no_source_trials');
      if (!session) report.issues.push('missing_session');
      if (!task) report.issues.push('missing_task_session');
      if (tasks.length > 1) report.issues.push('unexpected_additional_task_sessions');
      if (raw.length !== result.trials.length) report.issues.push('raw_trial_count_mismatch');
      if (task && task.total_trials !== result.trials.length) report.issues.push('task_total_mismatch');
      if (current.length !== result.trials.length) report.issues.push('current_derivation_count_mismatch');
      const participant = snapshot.research_participants.find((p) => p.id === session?.participant_id);
      if (session && participant?.patient_id !== row.patient_id) report.issues.push('participant_association_mismatch');
      if (current.some((d) => d.participant_id !== session?.participant_id || d.task_code !== hierarchy.taskSession.taskCode)) report.issues.push('derivation_association_mismatch');
      let reconciled;
      try { reconciled = reconcileBehavioralTrials(hierarchy, raw); }
      catch { report.issues.push('raw_identity_or_content_conflict'); }
      if (reconciled && current.length && reconciled.trials.some((trial) => current.filter((d) => d.trial_id === trial.trialId).length !== 1)) report.issues.push('current_derivation_identity_mismatch');
      if (reconciled && current.length && behavioralDerivationRows(reconciled, session?.participant_id).some((expected) => {
        const stored = current.find((d) => d.trial_id === expected.trial_id && d.processing_version === expected.processing_version);
        return stored && Object.keys(expected).some((key) => !sameBehavioralData(stored[key], expected[key]));
      })) report.issues.push('current_derivation_content_mismatch');
      if (current.some((d) => d.processing_version !== TRIAL_PROCESSING_VERSION)) report.issues.push('older_current_processing_version');
      if (hierarchy.taskSession.taskCode === 'LB') {
        const legacy = hierarchy.trials.map((trial) => trial.legacySourceTrialKey ?? trial.sourceTrialKey);
        report.legacyDuplicateKeyCount = legacy.length - new Set(legacy).size;
        report.canonicalDuplicateKeyCount = hierarchy.trials.length - new Set(hierarchy.trials.map((t) => t.sourceTrialKey)).size;
        if (report.legacyDuplicateKeyCount) report.issues.push('lb_legacy_source_key_collision');
        if (report.canonicalDuplicateKeyCount) report.issues.push('lb_canonical_source_key_collision');
      }
      if (hierarchy.taskSession.taskCode === 'PM') {
        const feature = buildTaskFeatureRow({ taskSession: hierarchy.taskSession, trials: hierarchy.trials });
        report.pm = {
          administered: feature.pm_administered_trial_count, timeouts: feature.pm_timeout_trial_count,
          timeoutRate: feature.pm_timeout_rate, status: feature.pm_timeout_rate_status,
          deselectionTrialsWithoutDuplicateEvidence: hierarchy.trials.filter((t) => Number(t.taskSpecificMetadata.deselectCount) > 0 && !(t.doubleClickCount > 0)).length,
          // Only a stored exclusion is evidence of an actual historical misclassification.
          storedFalseDoubleClickExclusions: reconciled && current.length ? reconciled.trials.filter((t) => Number(t.taskSpecificMetadata.deselectCount) > 0 && !(t.doubleClickCount > 0)
            && current.some((d) => d.trial_id === t.trialId && d.exclusion_reasons?.includes('accidental_double_click'))).length : null,
        };
        if (current.length) {
          report.pm.storedDerivationTimeoutRate = buildTaskFeatureRow({ taskSession: hierarchy.taskSession, trials: current }).pm_timeout_rate;
          if (!sameBehavioralData(report.pm.storedDerivationTimeoutRate, report.pm.timeoutRate)) report.issues.push('pm_stored_derivation_timeout_evidence_differs');
        }
        if (report.pm.storedFalseDoubleClickExclusions) report.issues.push('pm_stored_false_double_click_exclusion');
      }
      const incomplete = report.issues.some((issue) => /missing_|mismatch|conflict|no_source|exceeds|additional/.test(issue));
      if ((result.syncStatus === 'synced' || result.syncState?.researchHierarchy === 'verified') && incomplete) report.issues.push('claimed_synced_but_incomplete');
      report.repairDisposition = report.issues.some((i) => /unsupported|conflict|exceeds|no_source|association|additional/.test(i))
        ? 'manual_review' : report.issues.length ? 'dry_run_candidate_only' : 'complete';
    } catch {
      report.issues.push('unreadable_or_unmappable_source');
      report.repairDisposition = 'manual_review';
    }
    return report;
  });
  return { dryRun: true, processingVersion: TRIAL_PROCESSING_VERSION, scope: 'all_visible_main_results_including_synced',
    counts: Object.fromEntries(Object.entries(snapshot).map(([table, data]) => [table, data.length])),
    sourceTrialCount: rows.reduce((sum, row) => sum + (row.expectedTrialCount || 0), 0),
    issueCounts: issues(rows), results: rows };
}

function readOnlyFetch(fetchImpl) {
  return (input, init) => {
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD'].includes(method)) throw new Error('Historical audit permits GET/HEAD only');
    return fetchImpl(input, init);
  };
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Read-only audit: P0_AUDIT_URL, P0_AUDIT_API_KEY, optional P0_AUDIT_ACCESS_TOKEN. Run: node scripts/p0/audit-history.cjs [--out artifacts/p0-history.json]. GET/HEAD only; no repair option.');
    return;
  }
  const { P0_AUDIT_URL: url, P0_AUDIT_API_KEY: key, P0_AUDIT_ACCESS_TOKEN: token } = process.env;
  if (!url || !key) throw new Error('Set P0_AUDIT_URL and P0_AUDIT_API_KEY in the process environment');
  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: readOnlyFetch(fetch), ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) } });
  const snapshot = {};
  // Sequential, paginated reads; concurrent database writes can cause snapshot drift.
  for (const table of ['game_results', 'research_participants', 'behavioral_sessions', 'behavioral_task_sessions', 'behavioral_trials', 'behavioral_trial_derivations']) {
    snapshot[table] = await readBehavioralRows(client, table, (query) => query);
  }
  const report = { ...auditSnapshot(snapshot), generatedAt: new Date().toISOString(),
    consistency: 'paginated_http_reads_not_a_database_snapshot', coverage: 'RLS_visible_rows_only_not_proof_of_global_completeness' };
  const outIndex = process.argv.indexOf('--out');
  if (outIndex >= 0) {
    const output = process.argv[outIndex + 1];
    if (!output) throw new Error('--out needs a path');
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  }
  console.log(JSON.stringify({ dryRun: true, counts: report.counts, sourceTrialCount: report.sourceTrialCount, issueCounts: report.issueCounts, coverage: report.coverage }, null, 2));
}

if (require.main === module) main().catch(() => { console.error('P0 audit failed; check configuration, permissions and connectivity. No repair was attempted.'); process.exitCode = 1; });
module.exports = { auditSnapshot, readOnlyFetch };
