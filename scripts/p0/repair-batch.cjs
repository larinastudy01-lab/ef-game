// Default is read-only. P0-B apply is deliberately limited to isolated SYNTHETIC IDs.
const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');
const { loadSource } = require('./source-loader.cjs');
const { readOnlyFetch } = require('./audit-history.cjs');
const { requireP0CIsolation, assertRepairUsesReviewedIdentity } = require('./p0c-guard.cjs');
const { repairStoredBehavioralHierarchy, assertIsolatedRepairExecution } = loadSource('src/lib/behavioralSync.js');

function appendDurable(journal, entry) {
  const fd = fs.openSync(journal, 'a');
  try { fs.writeFileSync(fd, JSON.stringify(entry) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
async function main() {
  const args = process.argv.slice(2); const applying = args.includes('--apply-isolated');
  const input = args[0], output = args[1];
  if (!input || !output || args.includes('--help')) throw new Error('Usage: repair-batch.cjs IDs_OR_REVIEWED_PLANS.json OUTPUT.jsonl [--apply-isolated]');
  const entries = JSON.parse(fs.readFileSync(input, 'utf8'));
  if (!Array.isArray(entries) || !entries.length) throw new Error('Nonempty explicit result list required');
  const { P0_REPAIR_URL: url, P0_REPAIR_ANON_KEY: key, P0_REPAIR_ACCESS_TOKEN: token } = process.env;
  if (!url || !key || !token) throw new Error('P0_REPAIR_URL, P0_REPAIR_ANON_KEY and P0_REPAIR_ACCESS_TOKEN required');
  if (applying) assertRepairUsesReviewedIdentity(process.env, requireP0CIsolation());
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: applying ? fetch : readOnlyFetch(fetch), headers: { Authorization: `Bearer ${token}` } } });
  const executionFor = (id, ownerId) => ({ environment: process.env.P0_REPAIR_ENVIRONMENT,
    projectRef: process.env.P0_REPAIR_PROJECT_REF, targetOrigin: process.env.P0_REPAIR_TARGET_ORIGIN,
    confirmation: process.env.P0_REPAIR_CONFIRMATION, resultId: id, ownerId });
  // Verify every target before ANY network request, including auth.
  if (applying) for (const entry of entries) {
    if (entry.approved !== true || !entry.plan?.dryRun) throw new Error('Every entry needs an explicitly reviewed dry-run plan');
    assertIsolatedRepairExecution(client, executionFor(entry.plan.resultId, 'preflight'), { id: 'preflight' }, entry.plan.resultId);
  }
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error('Authenticated guardian required');
  if (applying) {
    const profile = await client.from('profiles').select('role').eq('id', data.user.id).single();
    if (profile.error || profile.data?.role !== 'guardian') throw new Error('A normal synthetic guardian is required for apply');
  }
  let failures = 0;
  for (const entry of entries) {
    const id = typeof entry === 'string' ? entry : entry.plan?.resultId;
    if (!id) throw new Error('Each entry needs a result ID');
    // Persist intent before mutation. Resume using the SAME reviewed plan/IDs;
    // previously successful records are reverified, never trusted from a log alone.
    appendDurable(output, { resultId: id, phase: applying ? 'apply_started' : 'dry_run_started', at: new Date().toISOString() });
    try {
      const result = await repairStoredBehavioralHierarchy(client, id, data.user, applying
        ? { dryRun: false, execution: executionFor(id, data.user.id), approvedPlan: entry.plan } : {});
      appendDurable(output, { resultId: id, phase: applying ? 'hierarchy_verified_main_status_unchanged' : 'dry_run_plan', result });
    } catch (failure) {
      failures += 1; appendDurable(output, { resultId: id, phase: 'failed_retryable_or_manual_review', error: String(failure.message || failure) });
    }
  }
  console.log(JSON.stringify({ attempted: entries.length, failures, dryRun: !applying, mainStatusUpdated: false }));
  if (failures) process.exitCode = 1;
}
if (require.main === module) main().catch(() => { console.error('Repair batch stopped. Check configuration, target, authorization and private journal.'); process.exitCode = 1; });
module.exports = { appendDurable };
