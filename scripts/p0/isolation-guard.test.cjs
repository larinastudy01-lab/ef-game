const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertIsolatedEnvironment } = require('./isolation-guard.cjs');
const config = () => ({ P0_TEST_ISOLATION_ACK: 'DISPOSABLE_TEST_PROJECT', P0_TEST_URL: 'https://isolatedref.supabase.co', P0_TEST_PROJECT_REF: 'isolatedref',
  P0_TEST_ANON_KEY: 'test-key', P0_TEST_GUARDIAN_TOKEN: 'guardian-a', P0_TEST_OTHER_GUARDIAN_TOKEN: 'guardian-b', P0_TEST_PATIENT_ID: 'patient-a', P0_TEST_OTHER_PATIENT_ID: 'patient-b',
  P0_TEST_CLINICIAN_ALLOWED_TOKEN: 'clinician-allowed', P0_TEST_CLINICIAN_DENIED_TOKEN: 'clinician-denied' });

test('integration guard permits an explicitly isolated project or loopback stack', () => {
  assert.equal(assertIsolatedEnvironment(config()).ref, 'isolatedref');
  assert.equal(assertIsolatedEnvironment({ ...config(), P0_TEST_URL: 'http://127.0.0.1:54321', P0_TEST_PROJECT_REF: 'local' }).ref, 'local');
});
for (const url of ['https://krgvfzjwqijjdwphsyto.supabase.co', 'https://KRgVfZjWqIjJdWpHsYtO.supabase.co/']) test(`production URL is blocked: ${url}`, () => {
  assert.throws(() => assertIsolatedEnvironment({ ...config(), P0_TEST_URL: url, P0_TEST_PROJECT_REF: 'krgvfzjwqijjdwphsyto' }), /Production/);
});
test('integration guard also blocks the repository configured production host', () => {
  assert.throws(() => assertIsolatedEnvironment(config(), ['https://isolatedref.supabase.co']), /Production/);
});
for (const patch of [{ P0_TEST_ISOLATION_ACK: '' }, { P0_TEST_PROJECT_REF: 'wrong' }, { P0_TEST_GUARDIAN_TOKEN: '' }, { P0_TEST_OTHER_PATIENT_ID: 'patient-a' }, { P0_TEST_OTHER_GUARDIAN_TOKEN: 'guardian-a' }, { P0_TEST_URL: 'http://isolatedref.supabase.co' }, { P0_TEST_URL: 'https://isolatedref.supabase.co/rest/v1' }, { P0_TEST_URL: 'https://custom.example' }]) {
  test(`invalid integration configuration is blocked: ${Object.keys(patch)[0]}=${Object.values(patch)[0]}`, () => assert.throws(() => assertIsolatedEnvironment({ ...config(), ...patch })));
}
