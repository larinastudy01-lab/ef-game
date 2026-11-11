const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertP0CIsolation, assertRepairUsesReviewedIdentity, sha256 } = require('./p0c-guard.cjs');
const now = Date.parse('2026-10-23T09:00:00Z');
const jwt = (claims) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.synthetic-not-a-real-signature`;
function fixture() {
  const url = 'http://127.0.0.1:55321'; const issuer = url + '/auth/v1';
  const env = { P0_TEST_URL: url, P0_TEST_PROJECT_REF: 'local', P0_TEST_ISOLATION_ACK: 'DISPOSABLE_TEST_PROJECT',
    P0_TEST_ANON_KEY: jwt({ role: 'anon' }), P0_TEST_PATIENT_ID: 'synthetic-patient-a', P0_TEST_OTHER_PATIENT_ID: 'synthetic-patient-b' };
  ['GUARDIAN', 'OTHER_GUARDIAN', 'CLINICIAN_ALLOWED', 'CLINICIAN_DENIED'].forEach((name, i) => {
    env[`P0_TEST_${name}_TOKEN`] = jwt({ role: 'authenticated', sub: 'synthetic-user-' + i, iss: issuer, exp: now / 1000 + 3600 });
  });
  const attestation = { version: 'p0c-isolation-1', projectRef: 'local', targetOrigin: url, authIssuer: issuer,
    reviewedAt: new Date(now).toISOString(), reviewer: 'synthetic-review', apiKeySha256: sha256(env.P0_TEST_ANON_KEY),
    fixturePrefix: 'p0-acceptance-', cleanupStrategy: 'dedicated_local_stack',
    versions: { postgres: '17.fixture', postgrest: 'fixture.1', auth: 'fixture.1', supabaseCli: 'fixture.1' },
    checks: Object.fromEntries(['separateDatabase','separateAuth','separateStorage','noProductionWebhooks','externalSideEffectsDisabled','syntheticOnly','loopbackOrDedicatedCloudProject'].map((k) => [k, true])),
    evidence: ['resource_identity','service_configuration','database_side_effects'].map((kind) => ({ kind, sha256: 'synthetic' })) };
  return { env, attestation };
}
const options = () => ({ now, checkEvidence: () => true });
test('offline gate never claims signature validation or real RLS execution', () => {
  const { env, attestation } = fixture(); const result = assertP0CIsolation(env, attestation, options());
  assert.equal(result.authValidation, 'server_getUser_and_positive_RLS_checks_still_required');
});
test('test-like URL and flags without independent resource evidence are blocked', () => {
  const { env } = fixture(); assert.throws(() => assertP0CIsolation(env, null, options()), /attestation/);
});
test('evidence checksum failure blocks all writes', () => {
  const { env, attestation } = fixture(); assert.throws(() => assertP0CIsolation(env, attestation, { ...options(), checkEvidence: () => false }), /evidence/);
});
for (const field of ['separateAuth', 'separateStorage', 'noProductionWebhooks', 'externalSideEffectsDisabled']) {
  test(`unverified resource independence is blocked: ${field}`, () => {
    const { env, attestation } = fixture(); attestation.checks[field] = false;
    assert.throws(() => assertP0CIsolation(env, attestation, options()), /review incomplete/);
  });
}
test('reused production credentials are rejected without exposing their value', () => {
  const { env, attestation } = fixture();
  assert.throws(() => assertP0CIsolation(env, attestation, { ...options(), productionSecrets: [env.P0_TEST_ANON_KEY] }), (error) =>
    /reuse/.test(error.message) && !error.message.includes(env.P0_TEST_ANON_KEY));
});
test('service-role JWT cannot stand in for ordinary user API key', () => {
  const { env, attestation } = fixture(); env.P0_TEST_ANON_KEY = jwt({ role: 'service_role' });
  attestation.apiKeySha256 = sha256(env.P0_TEST_ANON_KEY);
  assert.throws(() => assertP0CIsolation(env, attestation, options()), /anon/);
});
test('opaque secret keys are rejected before any client exists', () => {
  const { env, attestation } = fixture(); env.P0_TEST_ANON_KEY = 'sb_secret_synthetic';
  assert.throws(() => assertP0CIsolation(env, attestation, options()), /admin/);
});
test('cross-project API key and production-issued user token are both rejected', () => {
  const { env, attestation } = fixture(); env.P0_TEST_ANON_KEY = jwt({ role: 'anon', ref: 'krgvfzjwqijjdwphsyto' });
  assert.throws(() => assertP0CIsolation(env, attestation, options()), /project/);
  const b = fixture(); b.env.P0_TEST_GUARDIAN_TOKEN = jwt({ role: 'authenticated', sub: 'a', iss: 'https://krgvfzjwqijjdwphsyto.supabase.co/auth/v1', exp: now / 1000 + 3600 });
  assert.throws(() => assertP0CIsolation(b.env, b.attestation, options()), /issuer/);
});
test('expired user token and stale review are blocked', () => {
  const { env, attestation } = fixture();
  assert.throws(() => assertP0CIsolation(env, attestation, { ...options(), now: now + 25 * 3600000 }), /review/);
  env.P0_TEST_GUARDIAN_TOKEN = jwt({ role: 'authenticated', sub: 'a', iss: attestation.authIssuer, exp: now / 1000 - 1 });
  assert.throws(() => assertP0CIsolation(env, attestation, options()), /expiry/);
});
test('key fingerprint and runtime version must come from the reviewed stack', () => {
  const { env, attestation } = fixture(); attestation.apiKeySha256 = 'wrong';
  assert.throws(() => assertP0CIsolation(env, attestation, options()), /differs/);
  const b = fixture(); b.attestation.versions.postgres = 'UNVERIFIED';
  assert.throws(() => assertP0CIsolation(b.env, b.attestation, options()), /versions/);
});
test('same-account tokens cannot disguise two independent guardians', () => {
  const { env, attestation } = fixture(); env.P0_TEST_CLINICIAN_ALLOWED_TOKEN = env.P0_TEST_GUARDIAN_TOKEN;
  assert.throws(() => assertP0CIsolation(env, attestation, options()), /distinct/);
});

test('malformed or parameterized issuer fails without echoing supplied content', () => {
  const { env, attestation } = fixture(); attestation.authIssuer = 'invalid-sensitive-content';
  assert.throws(() => assertP0CIsolation(env, attestation, options()), (error) => /issuer invalid/.test(error.message) && !error.message.includes(attestation.authIssuer));
  attestation.authIssuer = env.P0_TEST_URL + '/auth/v1?secret=synthetic';
  assert.throws(() => assertP0CIsolation(env, attestation, options()), /issuer differs/);
});

test('repair apply uses exactly the reviewed target key and ordinary guardian', () => {
  const { env } = fixture(); const target = { url: env.P0_TEST_URL };
  Object.assign(env, { P0_REPAIR_URL: target.url, P0_REPAIR_ANON_KEY: env.P0_TEST_ANON_KEY, P0_REPAIR_ACCESS_TOKEN: env.P0_TEST_GUARDIAN_TOKEN });
  assert.doesNotThrow(() => assertRepairUsesReviewedIdentity(env, target));
  for (const field of ['P0_REPAIR_URL', 'P0_REPAIR_ANON_KEY', 'P0_REPAIR_ACCESS_TOKEN']) {
    assert.throws(() => assertRepairUsesReviewedIdentity({ ...env, [field]: 'unreviewed' }, target), /must match/);
  }
});
