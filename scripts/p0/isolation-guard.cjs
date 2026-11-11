const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const knownProductionRef = 'krgvfzjwqijjdwphsyto';

function assertIsolatedEnvironment(env, productionUrls = []) {
  if (env.P0_TEST_ISOLATION_ACK !== 'DISPOSABLE_TEST_PROJECT') throw new Error('An explicitly disposable test project is required');
  let url;
  try { url = new URL(env.P0_TEST_URL); } catch { throw new Error('P0_TEST_URL is required'); }
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error('Use an origin URL without credentials or parameters');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('Use HTTPS, or HTTP on loopback only');
  const ref = local ? 'local' : url.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
  if (!ref || ref !== env.P0_TEST_PROJECT_REF) throw new Error('P0_TEST_PROJECT_REF must match the test URL (local for loopback)');
  const blockedHosts = new Set([`${knownProductionRef}.supabase.co`, ...productionUrls.filter(Boolean).map((u) => new URL(u).hostname)]);
  if (blockedHosts.has(url.hostname)) throw new Error('Production target is blocked');
  const required = ['P0_TEST_ANON_KEY', 'P0_TEST_GUARDIAN_TOKEN', 'P0_TEST_OTHER_GUARDIAN_TOKEN', 'P0_TEST_PATIENT_ID', 'P0_TEST_OTHER_PATIENT_ID',
    'P0_TEST_CLINICIAN_ALLOWED_TOKEN', 'P0_TEST_CLINICIAN_DENIED_TOKEN'];
  if (required.some((key) => !env[key])) throw new Error('Two test guardians, their tokens and their separate test patients are required');
  if (env.P0_TEST_GUARDIAN_TOKEN === env.P0_TEST_OTHER_GUARDIAN_TOKEN || env.P0_TEST_PATIENT_ID === env.P0_TEST_OTHER_PATIENT_ID) throw new Error('RLS verification requires separate test identities and patients');
  return { url: url.origin, ref };
}

function repositoryProductionUrls() {
  return ['.env', '.env.production'].flatMap((file) => {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) return [];
    const value = fs.readFileSync(full, 'utf8').match(/^REACT_APP_SUPABASE_URL\s*=\s*([^\r\n]+)/m)?.[1];
    return value ? [value.trim().replace(/^['"]|['"]$/g, '')] : [];
  });
}

module.exports = { assertIsolatedEnvironment, repositoryProductionUrls };
