const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { assertIsolatedEnvironment, repositoryProductionUrls } = require('./isolation-guard.cjs');
const root = path.resolve(__dirname, '../..');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => { throw new Error(`P0-C BLOCKED: ${message}`); };

function productionCredentials() {
  const secrets = [];
  for (const file of ['.env', '.env.production', '.env.rag']) {
    const filename = path.join(root, file);
    if (!fs.existsSync(filename)) continue;
    const values = require('dotenv').parse(fs.readFileSync(filename));
    for (const [name, value] of Object.entries(values)) {
      if (/SUPABASE_.*(KEY|TOKEN)$/.test(name) && value) secrets.push(value);
    }
  }
  return secrets; // Memory only. Never serialize values or include them in errors.
}
function jwtClaims(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) fail('JWT structure invalid');
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch { return fail('JWT structure invalid'); }
}
function assertP0CIsolation(env, attestation, { productionUrls = [], productionSecrets = [], now = Date.now(), checkEvidence = () => false } = {}) {
  const target = assertIsolatedEnvironment(env, productionUrls);
  const a = attestation;
  if (!a || a.version !== 'p0c-isolation-1' || a.projectRef !== target.ref || a.targetOrigin !== target.url) fail('matching resource attestation required');
  const age = now - Date.parse(a.reviewedAt);
  if (!Number.isFinite(age) || age < -60000 || age > 24 * 60 * 60 * 1000 || !a.reviewer) fail('current reviewed resource evidence required');
  for (const name of ['separateDatabase', 'separateAuth', 'separateStorage', 'noProductionWebhooks', 'externalSideEffectsDisabled', 'syntheticOnly', 'loopbackOrDedicatedCloudProject']) {
    if (a.checks?.[name] !== true) fail('resource independence or side-effect review incomplete');
  }
  if (a.fixturePrefix !== 'p0-acceptance-' || !['dedicated_local_stack', 'dedicated_cloud_fixtures'].includes(a.cleanupStrategy)) fail('synthetic scope and cleanup plan required');
  for (const name of ['postgres', 'postgrest', 'auth', 'supabaseCli']) {
    if (!a.versions?.[name] || /unknown|unverified|replace|pending/i.test(a.versions[name])) fail('actual runtime versions required');
  }
  const kinds = ['resource_identity', 'service_configuration', 'database_side_effects'];
  if (!kinds.every((kind) => a.evidence?.some((e) => e.kind === kind && checkEvidence(e)))) fail('reviewed evidence files and checksums required');
  const key = env.P0_TEST_ANON_KEY;
  const tokens = ['P0_TEST_GUARDIAN_TOKEN', 'P0_TEST_OTHER_GUARDIAN_TOKEN', 'P0_TEST_CLINICIAN_ALLOWED_TOKEN', 'P0_TEST_CLINICIAN_DENIED_TOKEN'].map((name) => env[name]);
  if ([key, ...tokens].some((value) => productionSecrets.includes(value))) fail('production credential reuse is forbidden');
  if (key.startsWith('sb_secret_')) fail('service/admin key cannot represent ordinary users');
  if (key.split('.').length === 3) {
    const claims = jwtClaims(key);
    if (claims.role !== 'anon') fail('only anon/publishable API keys may run user tests');
    if (claims.ref && claims.ref !== target.ref) fail('API key project differs from target');
    if (claims.ref === 'krgvfzjwqijjdwphsyto') fail('production key project is forbidden');
  } else if (!key.startsWith('sb_publishable_')) fail('unrecognized API key type');
  if (a.apiKeySha256 !== sha256(key)) fail('API key differs from reviewed project evidence');
  let issuer;
  try { issuer = new URL(a.authIssuer); } catch { return fail('auth issuer invalid'); }
  if (issuer.origin !== target.url || issuer.pathname !== '/auth/v1' || issuer.username || issuer.password || issuer.search || issuer.hash) fail('auth issuer differs from target');
  const subjects = new Set();
  for (const token of tokens) {
    const claims = jwtClaims(token);
    if (claims.role !== 'authenticated' || claims.iss !== a.authIssuer || !claims.sub || !Number.isFinite(claims.exp) || claims.exp * 1000 <= now) fail('user token role, issuer or expiry invalid');
    if (subjects.has(claims.sub)) fail('ordinary test identities must be distinct');
    subjects.add(claims.sub);
  }
  return { ...target, resourceReview: 'accepted_offline_evidence', authValidation: 'server_getUser_and_positive_RLS_checks_still_required' };
}
function readEvidence(entry) {
  if (!entry || !/^[a-f0-9]{64}$/.test(entry.sha256 || '')) return false;
  const filename = path.resolve(root, entry.path || '');
  const allowed = ['.tmp/p0c', 'artifacts/p0c'].map((p) => path.join(root, p) + path.sep);
  if (!allowed.some((p) => filename.startsWith(p))) return false;
  try {
    const resolved = fs.realpathSync(filename);
    return allowed.some((p) => resolved.startsWith(p)) && sha256(fs.readFileSync(resolved)) === entry.sha256;
  } catch { return false; }
}
function requireP0CIsolation(env = process.env) {
  if (!env.P0C_ATTESTATION_FILE) fail('P0C_ATTESTATION_FILE is required');
  let attestation;
  try { attestation = JSON.parse(fs.readFileSync(env.P0C_ATTESTATION_FILE, 'utf8')); }
  catch { return fail('resource attestation unreadable'); }
  return assertP0CIsolation(env, attestation, { productionUrls: repositoryProductionUrls(), productionSecrets: productionCredentials(), checkEvidence: readEvidence });
}
function assertRepairUsesReviewedIdentity(env, target) {
  // Do not let the separate repair CLI bypass the reviewed resource/ordinary-user gate.
  if (env.P0_REPAIR_URL !== target.url || env.P0_REPAIR_ANON_KEY !== env.P0_TEST_ANON_KEY || env.P0_REPAIR_ACCESS_TOKEN !== env.P0_TEST_GUARDIAN_TOKEN) fail('repair target/key/guardian must match the reviewed integration environment');
}
module.exports = { assertP0CIsolation, requireP0CIsolation, assertRepairUsesReviewedIdentity, sha256, jwtClaims };
