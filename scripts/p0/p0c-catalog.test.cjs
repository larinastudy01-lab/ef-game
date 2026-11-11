const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cases } = require('./integration-cases.cjs');

test('original P0-B IDs, names and expectations remain aligned with all 28 registered tests', () => {
  const original = JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/p0b-integration-cases-2026-10-23.json'), 'utf8')).cases;
  assert.equal(original.length, 28);
  assert.deepEqual(cases.map(({ id, purpose, expected }) => ({ id, purpose, expected })), original.map(({ id, purpose, expected }) => ({ id, purpose, expected })));
  const names = [];
  const source = fs.readFileSync(path.join(__dirname, 'isolated-integration.test.cjs'), 'utf8');
  const stubRequire = (name) => {
    if (name === 'node:test') return { test: (title) => names.push(title), before: () => {} };
    if (name === 'node:assert/strict') return assert;
    if (name === 'node:crypto') return require(name);
    if (name === '@supabase/supabase-js') return { createClient: () => { throw new Error('Offline catalog inspection must never create clients'); } };
    if (name === './isolation-guard.cjs') return { assertIsolatedEnvironment: () => ({}), repositoryProductionUrls: () => [] };
    if (name === './p0c-guard.cjs') return { requireP0CIsolation: () => {} };
    if (name === './source-loader.cjs') return { loadSource: () => ({}) };
    throw new Error('Unexpected catalog dependency');
  };
  // Register titles only: never invoke hooks/callbacks, clients, fetch, or production modules.
  vm.runInNewContext(source, { require: stubRequire, process: { env: {} }, fetch: () => { throw new Error('No HTTP allowed'); } }, { timeout: 1000 });
  assert.deepEqual(names, cases.map((c) => c.purpose));
});
