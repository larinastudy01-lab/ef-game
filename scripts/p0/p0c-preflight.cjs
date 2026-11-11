// Offline, read-only preflight. Never starts a service, constructs a client, or sends HTTP.
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { requireP0CIsolation } = require('./p0c-guard.cjs');
const { cases } = require('./integration-cases.cjs');

function probe(command) {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 5000, windowsHide: true, shell: false });
  // Store only a recognized version number; never serialize arbitrary command output.
  const version = result.status === 0 ? (result.stdout || '').match(/\b\d+\.\d+(?:\.\d+)?\b/)?.[0] : null;
  return { available: Boolean(version), version: version || null };
}
function report(env = process.env) {
  const runtimes = Object.fromEntries(['docker', 'supabase', 'psql', 'podman'].map((name) => [name, probe(name)]));
  let gate = 'BLOCKED';
  try { requireP0CIsolation(env); gate = 'PASS'; } catch { /* Do not print credential-bearing errors. */ }
  return {
    version: 'p0c-offline-preflight-1', observedAt: new Date().toISOString(), status: 'BLOCKED',
    writesAttempted: 0, httpRequestsAttempted: 0, node: process.version, runtimes,
    resourceGate: gate, actualDatabaseVersions: { postgres: null, postgrest: null, auth: null },
    localTemplateDatabaseMajor: 17, templateStarted: false, templateCliValidated: false,
    reasons: [
      ...(!runtimes.docker.available || !runtimes.supabase.available ? ['LOCAL_STACK_PREREQUISITES_UNAVAILABLE'] : []),
      ...(gate !== 'PASS' ? ['ISOLATED_RESOURCE_AND_CREDENTIAL_EVIDENCE_NOT_ACCEPTED'] : []),
      'SERVER_AUTH_MIGRATION_AND_REAL_INTEGRATION_EXECUTION_REQUIRED',
    ],
    note: 'Offline probes are not proof of a running or isolated database. This tool never reports overall P0-C PASS.',
    cases: cases.map(({ id, purpose, expected }) => ({ id, purpose, expected, actual: 'No isolated database execution in this offline preflight', status: 'BLOCKED' })),
  };
}
if (require.main === module) {
  const output = process.argv[2];
  if (!output) throw new Error('New output JSON path required');
  const value = report();
  fs.writeFileSync(output, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: value.status, originalCases: value.cases.length, executed: 0, writesAttempted: 0 }));
  process.exitCode = 2; // BLOCKED is distinguishable from a passed test run.
}
module.exports = { report };
