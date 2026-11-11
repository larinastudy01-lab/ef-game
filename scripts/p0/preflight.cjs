const fs = require('node:fs');
const { loadSource } = require('./source-loader.cjs');
const { researchTaskCodeCompatibility } = loadSource('src/analytics/trials/constants.js');
const { buildBehavioralHierarchy } = loadSource('src/analytics/trials/buildBehavioralHierarchy.js');
const { buildTaskFeatureRow } = loadSource('src/analytics/features/pipeline.js');
const uuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function classifyPreflight(snapshot) {
  const checks = snapshot.schema.checks.filter((c) => c.name.endsWith('_task_code_check'));
  if (checks.length !== 2) throw new Error('Both task-code constraints must be inspected');
  const records = snapshot.records.map((r) => {
    const reasons = [];
    const tags = [];
    const compatibility = researchTaskCodeCompatibility(r.game_id);
    const count = Number(r.source_trial_count);
    const declared = Math.max(Number(r.declared_trial_count) || 0, Number(r.payload_declared_trial_count) || 0);
    if (!count || declared > count || r.non_object_trials > 0 || r.payload_type !== 'object') { tags.push('D'); reasons.push('insufficient_source_trials_or_payload'); }
    if (!compatibility.writable) { tags.push('C'); reasons.push('unmapped_legacy_task_semantics'); }
    if (r.canonical_duplicate_key_count > 0) { tags.push('C'); reasons.push('canonical_source_key_collision'); }
    if (!r.owner_binding_valid || !r.payload_patient_matches) { tags.push('C'); reasons.push('owner_or_patient_binding_conflict'); }
    if ((r.payload_result_id && r.payload_result_id !== r.main_result_id)
      || (r.payload_game_id && r.payload_game_id !== r.game_id) || (r.payload_mode && r.payload_mode !== r.mode)) { tags.push('C'); reasons.push('main_payload_identity_or_mode_conflict'); }
    if (r.missing_outcome_trials > 0) { tags.push('C'); reasons.push('missing_recorded_trial_outcomes'); }
    if (!['test', 'training'].includes(r.mode)) { tags.push('C'); reasons.push('unknown_mode'); }
    const ids = r.original_trial_ids || [];
    if ((r.original_session_id && !uuid(r.original_session_id)) || (r.original_task_session_id && !uuid(r.original_task_session_id))
      || ids.some((id) => !uuid(id)) || new Set(ids).size !== ids.length || (ids.length && ids.length !== count)) { tags.push('C'); reasons.push('invalid_or_conflicting_original_research_ids'); }
    if (!r.original_session_id || !r.original_task_session_id || !ids.length) reasons.push('technical_ids_require_frozen_reviewed_plan');
    if (!r.started_at && !r.payload_started_at) reasons.push('source_start_not_recorded_preserve_null');
    const missingSchema = compatibility.writable ? checks.filter((c) => ![...c.definition.matchAll(/'([^']+)'/g)].some((m) => m[1] === compatibility.taskCode)).map((c) => c.name) : [];
    if (missingSchema.length) { tags.push('B'); reasons.push('task_code_schema_block'); }
    if (r.unmatched_stored_raw_count > 0) { tags.push('C'); reasons.push('stored_raw_content_conflict'); }
    const countsPresent = Boolean(r.session_id && r.task_session_id) && r.stored_trial_count === count
      && r.stored_current_derivation_count === count && r.stored_task_total === count && !r.unmatched_stored_raw_count;
    const complete = countsPresent && r.exact_hierarchy_verified === true;
    if (countsPresent && !complete) { tags.push('C'); reasons.push('exact_identity_and_content_verification_required'); }
    const primary = tags.includes('D') ? 'D' : tags.includes('C') ? 'C' : tags.includes('B') ? 'B' : complete ? 'E' : 'A';
    let pm = null;
    if (r.game_id === 'PM') {
      const h = buildBehavioralHierarchy({ game: { gameId: 'PM' }, session: { mode: r.mode, status: r.completion_status || 'completed' }, trials: r.pm_projection || [] });
      const f = buildTaskFeatureRow({ taskSession: h.taskSession, trials: h.trials });
      pm = { administered: f.pm_administered_trial_count, timeouts: f.pm_timeout_trial_count, timeoutRate: f.pm_timeout_rate,
        status: f.pm_timeout_rate_status, pipelineVersion: f.pipeline_version, processingVersion: h.processingVersion,
        recordedFalseTimeoutFlags: (r.pm_projection || []).filter((t) => t.isTimeout === false).length,
        missingTimeoutFlags: (r.pm_projection || []).filter((t) => t.isTimeout == null).length,
        legalDeselectionTrials: h.trials.filter((t) => Number(t.taskSpecificMetadata.deselectCount) > 0 && !(t.doubleClickCount > 0)).length,
        storedPreviousVersion: r.stored_current_derivation_count ? 'inspect_current_versions' : 'absent_not_fabricated' };
    }
    return { resultRef: r.result_ref, gameId: r.game_id, mode: r.mode, primaryCategory: primary,
      problemCategories: [...new Set(tags)], reasons, missingSchema,
      sourceTrialCount: count, expectedResearchTrialCount: declared > count ? null : count,
      storedResearch: { session: r.session_id ? 1 : 0, task: r.task_session_id ? 1 : 0, trials: r.stored_trial_count, currentDerivations: r.stored_current_derivation_count },
      sync: { mainResult: 'saved', recordedStatus: r.sync_status, recordedResearchState: r.sync_state?.researchHierarchy || null,
        researchHierarchy: complete ? 'counts_present_needs_exact_readback' : 'incomplete', incorrectlyClaimedSynced: (r.sync_status === 'synced' || r.sync_state?.researchHierarchy === 'verified') && !complete },
      originalIds: { mainResultPresent: Boolean(r.main_result_id), payloadResultMatches: !r.payload_result_id || r.payload_result_id === r.main_result_id,
        sessionIdPresent: Boolean(r.original_session_id), taskSessionIdPresent: Boolean(r.original_task_session_id), trialIdCount: ids.length, missingTechnicalIds: !r.original_session_id || !r.original_task_session_id || !ids.length },
      timestamps: { originalStartRecorded: Boolean(r.started_at || r.payload_started_at), missingStartPolicy: 'preserve_null_no_invention', finishRecorded: Boolean(r.finished_at || r.payload_finished_at) },
      oldDuplicateKeyCount: r.old_duplicate_key_count, canonicalDuplicateKeyCount: r.canonical_duplicate_key_count,
      sourcePayloadSha256: r.source_payload_sha256, sourceTrialHashCount: r.source_trial_sha256?.length || 0,
      pm, manualLbEvidence: r.game_id === 'LB' && r.canonical_duplicate_key_count ? r.lb_key_evidence : null,
      applyAuthorized: false, status: primary === 'A' ? 'candidate_only_global_acceptance_gates_pending' : primary === 'E' ? 'requires_exact_content_verification' : 'blocked' };
  });
  const categories = Object.fromEntries(['A', 'B', 'C', 'D', 'E'].map((category) => [category, {
    results: records.filter((r) => r.primaryCategory === category).length,
    sourceTrials: records.filter((r) => r.primaryCategory === category).reduce((sum, r) => sum + r.sourceTrialCount, 0),
  }]));
  return { dryRun: true, snapshotAt: snapshot.snapshotAt, coverage: snapshot.coverage, classificationVersion: 'p0b-preflight-1.0',
    categories, totals: { results: records.length, sourceTrials: records.reduce((n, r) => n + r.sourceTrialCount, 0),
      incorrectlySynced: records.filter((r) => r.sync.incorrectlyClaimedSynced).length,
      withMissingTechnicalIds: records.filter((r) => r.originalIds.missingTechnicalIds).length },
    globalGates: ['isolated_postgres_postgrest_rls_not_verified', 'backup_restore_not_verified', 'production_apply_forbidden_in_p0b'],
    records };
}
if (require.main === module) {
  const [, , input, output] = process.argv;
  if (!input || !output) throw new Error('Usage: node scripts/p0/preflight.cjs PRIVATE_SNAPSHOT.json REDACTED_REPORT.json');
  const report = classifyPreflight(JSON.parse(fs.readFileSync(input, 'utf8')));
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ totals: report.totals, categories: report.categories, globalGates: report.globalGates }, null, 2));
}
module.exports = { classifyPreflight };
