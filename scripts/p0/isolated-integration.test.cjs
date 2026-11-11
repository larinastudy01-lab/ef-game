// Opt-in only: not part of CRA/Jest's test glob. Uses real PostgREST + authenticated JWTs.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { assertIsolatedEnvironment, repositoryProductionUrls } = require('./isolation-guard.cjs');
const { requireP0CIsolation } = require('./p0c-guard.cjs');
const { loadSource } = require('./source-loader.cjs');
const { syncGameResult, readBehavioralRows, prepareBehavioralHierarchy, repairStoredBehavioralHierarchy } = loadSource('src/lib/behavioralSync.js');
// Guard executes BEFORE constructing clients or making any HTTP request.
const config = assertIsolatedEnvironment(process.env, repositoryProductionUrls());
requireP0CIsolation(); // No client or write exists before the resource/credential gate.
const runId = randomUUID();
const env = process.env;
let owner, other, guardian, outsider, anonymous, clinicianAllowed, clinicianDenied;
function client(token, intercept = fetch) {
  return createClient(config.url, env.P0_TEST_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: intercept, ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) },
  });
}
async function ok(query) {
  const { data, error } = await query;
  assert.equal(error, null, error?.code || 'PostgREST request failed');
  return data;
}
function fixture(task = 'LB', count = task === 'PM' ? 12 : 20) {
  const trials = Array.from({ length: count }, (_, index) => task === 'PM' ? {
    trialNumber: index + 1, correctIds: ['target'], selectedIds: ['target'], deselectCount: index === 0 ? 1 : 0,
    tapLogs: index === 0 ? [{ action: 'select' }, { action: 'deselect' }, { action: 'select' }] : [],
    isCorrect: true, reactionTime: 1000,
  } : { stageId: index < 10 ? 'forward' : 'red-blue', stepIndex: index % 10,
    expectedKey: `key-${index}`, clickedKey: `key-${index}`, isCorrect: true, reactionTime: 500 });
  return { resultId: `p0-acceptance-${runId}-${randomUUID()}`, child: { childId: env.P0_TEST_PATIENT_ID },
    game: { gameId: task, gameName: 'P0 synthetic transport fixture' },
    session: { mode: 'test', status: 'completed', difficulty: 'default', startedAt: '2026-10-23T00:00:00.000Z', finishedAt: '2026-10-23T00:01:00.000Z' },
    summary: { totalTrials: count, correctCount: count, errorCount: 0, accuracy: 100, score: 100, stars: 3, avgReactionTime: 500 },
    rawResult: { trialLogs: structuredClone(trials), acceptanceRun: runId }, trials,
    behavioral: { sessionId: randomUUID(), taskSessionId: randomUUID(), trialIds: trials.map(() => randomUUID()) } };
}
async function verify(record) {
  const { hierarchy } = await prepareBehavioralHierarchy(guardian, record);
  const raw = await readBehavioralRows(guardian, 'behavioral_trials', (q) => q.eq('task_session_id', hierarchy.taskSession.taskSessionId));
  assert.equal(raw.length, record.trials.length);
  for (const [index, trial] of record.trials.entries()) assert.deepEqual(raw.find((r) => r.id === record.behavioral.trialIds[index])?.raw_data, trial);
  const derived = await readBehavioralRows(guardian, 'behavioral_trial_derivations', (q) => q.in('trial_id', raw.map((r) => r.id)).eq('is_current', true));
  assert.equal(derived.length, record.trials.length);
  assert.equal(new Set(derived.map((d) => d.trial_id)).size, record.trials.length);
  assert.equal(new Set(raw.map((r) => r.source_trial_key)).size, record.trials.length);
  const main = await ok(guardian.from('game_results').select('*').eq('id', record.resultId).single());
  assert.equal(main.payload.syncState.researchHierarchy, 'verified');
  assert.equal(main.payload.syncState.verifiedTrialCount, record.trials.length);
  assert.deepEqual(main.payload.trials, record.trials);
  assert.deepEqual(main.payload.summary, record.summary);
  return raw;
}
before(async () => {
  guardian = client(env.P0_TEST_GUARDIAN_TOKEN); outsider = client(env.P0_TEST_OTHER_GUARDIAN_TOKEN); anonymous = client();
  owner = (await ok(guardian.auth.getUser(env.P0_TEST_GUARDIAN_TOKEN))).user;
  other = (await ok(outsider.auth.getUser(env.P0_TEST_OTHER_GUARDIAN_TOKEN))).user;
  assert.notEqual(owner.id, other.id);
  clinicianAllowed = client(env.P0_TEST_CLINICIAN_ALLOWED_TOKEN); clinicianDenied = client(env.P0_TEST_CLINICIAN_DENIED_TOKEN);
  for (const [c, token] of [[clinicianAllowed, env.P0_TEST_CLINICIAN_ALLOWED_TOKEN], [clinicianDenied, env.P0_TEST_CLINICIAN_DENIED_TOKEN]]) {
    const user = (await ok(c.auth.getUser(token))).user;
    assert.ok(![owner.id, other.id].includes(user.id));
    assert.equal((await ok(c.from('profiles').select('role').eq('id', user.id).single())).role, 'clinician');
  }
  for (const [c, user, id] of [[guardian, owner, env.P0_TEST_PATIENT_ID], [outsider, other, env.P0_TEST_OTHER_PATIENT_ID]]) {
    const patient = await ok(c.from('patients').select('id,guardian_id').eq('id', id).single());
    assert.equal(patient.guardian_id, user.id);
    const profile = await ok(c.from('profiles').select('role').eq('id', user.id).single());
    assert.equal(profile.role, 'guardian', 'Use ordinary guardians; elevated roles do not validate guardian RLS');
  }
  assert.equal(await ok(clinicianAllowed.rpc('can_access_patient', { target_patient_id: env.P0_TEST_PATIENT_ID })), true);
  assert.equal(await ok(clinicianDenied.rpc('can_access_patient', { target_patient_id: env.P0_TEST_PATIENT_ID })), false);
});

['LB', 'PM'].forEach((task) => test(`${task}: full write, exact raw readback and duplicate submission`, async () => {
  const record = fixture(task);
  await syncGameResult(guardian, record, owner);
  const first = await verify(record);
  await syncGameResult(guardian, structuredClone(record), owner);
  assert.deepEqual(await verify(record), first);
}));

['CBT', 'SRT', 'ARI', 'DCCS'].forEach((task) => test(`${task}: real schema accepts the current task code`, async () => {
  const record = fixture(task, 1);
  await syncGameResult(guardian, record, owner);
  await verify(record);
}));

['game_results', 'behavioral_sessions', 'behavioral_task_sessions', 'behavioral_trials', 'behavioral_trial_derivations'].forEach((table) => {
  test(`${table}: one interrupted request stays pending and a new client retries`, async () => {
    const record = fixture(); let interrupted = false;
    const faulty = client(env.P0_TEST_GUARDIAN_TOKEN, async (input, init) => {
      if (!interrupted && new URL(String(input)).pathname.endsWith(`/rest/v1/${table}`) && ['POST', 'PATCH'].includes(init?.method)) {
        interrupted = true; throw new TypeError('Injected request interruption');
      }
      return fetch(input, init);
    });
    await assert.rejects(syncGameResult(faulty, record, owner), (error) => error.syncState?.researchHierarchy === 'pending');
    assert.equal(interrupted, true);
    const main = await ok(guardian.from('game_results').select('payload').eq('id', record.resultId).maybeSingle());
    assert.notEqual(main?.payload.syncStatus, 'synced');
    await syncGameResult(client(env.P0_TEST_GUARDIAN_TOKEN), JSON.parse(JSON.stringify(record)), owner);
    await verify(record);
  });
});

test('lost raw insert acknowledgement retries without duplicate IDs or source keys', async () => {
  const record = fixture(); let lost = false;
  const faulty = client(env.P0_TEST_GUARDIAN_TOKEN, async (input, init) => {
    const response = await fetch(input, init);
    if (!lost && new URL(String(input)).pathname.endsWith('/rest/v1/behavioral_trials') && init?.method === 'POST' && response.ok) {
      lost = true; throw new TypeError('Injected lost acknowledgement AFTER server commit');
    }
    return response;
  });
  await assert.rejects(syncGameResult(faulty, record, owner));
  assert.equal(lost, true);
  await syncGameResult(guardian, record, owner); await verify(record);
});

test('existing session plus partial trial checkpoint fills remaining trials', async () => {
  const record = fixture(); const partial = structuredClone(record);
  partial.trials = partial.trials.slice(0, 7); partial.rawResult.trialLogs = partial.rawResult.trialLogs.slice(0, 7);
  partial.session.status = 'in_progress'; partial.session.finishedAt = null;
  partial.summary = { ...partial.summary, totalTrials: 7, correctCount: 7 };
  await syncGameResult(guardian, partial, owner);
  await syncGameResult(guardian, record, owner); await verify(record);
});

test('real unique constraint rejects duplicate source key and leaves raw answers intact', async () => {
  const record = fixture(); await syncGameResult(guardian, record, owner);
  const raw = await verify(record);
  // Retain mandatory acquisition fields so the intended UNIQUE, not NOT NULL,
  // is the reason this otherwise valid synthetic row must be rejected.
  const { error } = await guardian.from('behavioral_trials').insert({ ...raw[0], id: randomUUID() });
  assert.equal(error?.code, '23505');
  assert.deepEqual(await verify(record), raw);
});

test('anonymous/other guardian cannot read or attach a raw trial to this session', async () => {
  const record = fixture(); await syncGameResult(guardian, record, owner);
  const raw = await verify(record);
  for (const c of [anonymous, outsider]) {
    for (const [table, column, id] of [['game_results', 'id', record.resultId], ['behavioral_sessions', 'source_result_id', record.resultId], ['behavioral_trials', 'task_session_id', raw[0].task_session_id]]) {
      const response = await c.from(table).select('id').eq(column, id);
      assert.ok(response.error || response.data?.length === 0, `${table}: unauthorized rows must not be visible`);
    }
    const { error } = await c.from('behavioral_trials').insert({ id: randomUUID(), task_session_id: raw[0].task_session_id,
      source_trial_key: `unauthorized-${randomUUID()}`, raw_data: { synthetic: true } });
    assert.ok(error, 'Unauthorized insert must fail');
  }
  assert.deepEqual(await verify(record), raw);
});

test('guardian cannot rewrite a saved raw answer through PostgREST', async () => {
  const record = fixture(); await syncGameResult(guardian, record, owner);
  const raw = await verify(record);
  await guardian.from('behavioral_trials').update({ raw_data: { changed: true } }).eq('id', raw[0].id).select('id');
  assert.deepEqual(await verify(record), raw);
});

// Intentionally retain tagged synthetic records for inspection. No deletion or reset.
// A fresh client is tested; a real browser/process crash and physical outage remain manual checks.

test('existing session survives a later main-result failure and can retry', async () => {
  const record = fixture(); await syncGameResult(guardian, record, owner);
  let failed = false;
  const faulty = client(env.P0_TEST_GUARDIAN_TOKEN, async (input, init) => {
    if (!failed && new URL(String(input)).pathname.endsWith('/rest/v1/game_results') && init?.method === 'PATCH') {
      failed = true; throw new TypeError('Injected main-result failure after earlier session commit');
    }
    return fetch(input, init);
  });
  await assert.rejects(syncGameResult(faulty, record, owner)); assert.equal(failed, true);
  await syncGameResult(guardian, record, owner); await verify(record);
});

test('full main payload with only seven committed trials stays pending and fills the remaining thirteen', async () => {
  const record = fixture(); let partial = false;
  const faulty = client(env.P0_TEST_GUARDIAN_TOKEN, async (input, init) => {
    if (!partial && new URL(String(input)).pathname.endsWith('/rest/v1/behavioral_trials') && init?.method === 'POST') {
      partial = true;
      // Send a seven-row synthetic checkpoint as a separate atomic request.
      // This models existing partial data; PostgreSQL does not partially commit one batch.
      return fetch(input, { ...init, body: JSON.stringify(JSON.parse(init.body).slice(0, 7)) });
    }
    return fetch(input, init);
  });
  await assert.rejects(syncGameResult(faulty, record, owner));
  const main = await ok(guardian.from('game_results').select('payload').eq('id', record.resultId).single());
  assert.equal(main.payload.trials.length, 20); assert.notEqual(main.payload.syncStatus, 'synced');
  const existing = await ok(guardian.from('behavioral_trials').select('*').eq('task_session_id', record.behavioral.taskSessionId));
  assert.equal(existing.length, 7);
  await syncGameResult(guardian, record, owner);
  const complete = await verify(record);
  for (const row of existing) assert.deepEqual(complete.find((r) => r.id === row.id), row);
});

test('final main acknowledgement failure keeps research data and retries the final status safely', async () => {
  const record = fixture(); let failed = false;
  const faulty = client(env.P0_TEST_GUARDIAN_TOKEN, async (input, init) => {
    if (!failed && new URL(String(input)).pathname.endsWith('/rest/v1/game_results') && init?.method === 'PATCH') {
      failed = true; throw new TypeError('Injected failure at final main acknowledgement');
    }
    return fetch(input, init);
  });
  await assert.rejects(syncGameResult(faulty, record, owner)); assert.equal(failed, true);
  const main = await ok(guardian.from('game_results').select('payload').eq('id', record.resultId).single());
  assert.notEqual(main.payload.syncStatus, 'synced');
  assert.equal((await ok(guardian.from('behavioral_trials').select('id').eq('task_session_id', record.behavioral.taskSessionId))).length, 20);
  await syncGameResult(guardian, record, owner); await verify(record);
});

test('two simultaneous sync clients converge after retry without duplicate trials', async () => {
  const record = fixture();
  const settled = await Promise.allSettled([syncGameResult(client(env.P0_TEST_GUARDIAN_TOKEN), record, owner),
    syncGameResult(client(env.P0_TEST_GUARDIAN_TOKEN), structuredClone(record), owner)]);
  assert.ok(settled.some((r) => r.status === 'fulfilled'));
  await syncGameResult(guardian, record, owner); await verify(record);
});

test('legacy SSG remains readable without conversion to ARI', async () => {
  const record = fixture('SSG', 1); await syncGameResult(guardian, record, owner);
  const row = await ok(guardian.from('game_results').select('game_id,payload').eq('id', record.resultId).single());
  assert.equal(row.game_id, 'SSG'); assert.equal(row.payload.game.gameId, 'SSG');
});

['ART', 'INVALID_TASK'].forEach((task) => test(`${task}: unrecognized task code still fails the real CHECK`, async () => {
  await assert.rejects(syncGameResult(guardian, fixture(task, 1), owner), (error) => error.code === '23514');
}));

test('unrelated nonnegative trial-count constraint remains enforced', async () => {
  const record = fixture(); await syncGameResult(guardian, record, owner);
  const { error } = await guardian.from('behavioral_task_sessions').update({ total_trials: -1 }).eq('id', record.behavioral.taskSessionId);
  assert.equal(error?.code, '23514'); await verify(record);
});

test('authorized researcher reads the complete hierarchy while an unauthorized clinician cannot', async () => {
  const record = fixture(); await syncGameResult(guardian, record, owner);
  const raw = await verify(record);
  const session = await ok(guardian.from('behavioral_sessions').select('participant_id').eq('source_result_id', record.resultId).single());
  for (const [table, column, id, expected] of [
    ['research_participants', 'id', session.participant_id, 1],
    ['game_results', 'id', record.resultId, 1], ['behavioral_sessions', 'source_result_id', record.resultId, 1],
    ['behavioral_task_sessions', 'id', raw[0].task_session_id, 1],
    ['behavioral_trials', 'task_session_id', raw[0].task_session_id, raw.length],
    ['behavioral_trial_derivations', 'trial_id', raw[0].id, 1],
  ]) {
    assert.equal((await ok(clinicianAllowed.from(table).select('id').eq(column, id))).length, expected);
    const denied = await clinicianDenied.from(table).select('id').eq(column, id);
    assert.ok(denied.error || denied.data?.length === 0, `${table}: unauthorized clinician saw a row`);
  }
});

test('own participant cannot be attached to another patient raw trial through a derivation', async () => {
  const a = fixture(); const b = fixture(); b.child.childId = env.P0_TEST_OTHER_PATIENT_ID;
  await syncGameResult(guardian, a, owner); await syncGameResult(outsider, b, other);
  const original = (await ok(guardian.from('behavioral_trial_derivations').select('*').eq('trial_id', a.behavioral.trialIds[0]).eq('is_current', true).single()));
  const attack = { ...original, id: randomUUID(), trial_id: b.behavioral.trialIds[0], is_current: false, processing_version: `p0b-cross-binding-${randomUUID()}` };
  const inserted = await guardian.from('behavioral_trial_derivations').insert(attack);
  assert.equal(inserted.error?.code, '42501', 'Relational RLS must reject an own-participant/foreign-trial binding');
  const updated = await guardian.from('behavioral_trial_derivations').update({ trial_id: attack.trial_id,
    is_current: false, processing_version: attack.processing_version }).eq('id', original.id);
  assert.equal(updated.error?.code, '42501');
  await verify(a);
});

test('reviewed isolated repair is repeatable and retains old derivation versions and main status', async () => {
  const record = fixture(); await syncGameResult(guardian, record, owner);
  const old = await ok(guardian.from('behavioral_trial_derivations').select('*').eq('trial_id', record.behavioral.trialIds[0]).eq('is_current', true).single());
  await ok(guardian.from('behavioral_trial_derivations').insert({ ...old, id: randomUUID(), processing_version: 'p0b-synthetic-old', is_current: false }));
  const plan = await repairStoredBehavioralHierarchy(guardian, record.resultId, owner);
  const options = { dryRun: false, approvedPlan: plan, execution: { environment: 'isolated', targetOrigin: config.url, projectRef: config.ref,
    resultId: record.resultId, ownerId: owner.id, confirmation: 'APPLY_SINGLE_SYNTHETIC_REPAIR' } };
  await repairStoredBehavioralHierarchy(guardian, record.resultId, owner, options);
  await repairStoredBehavioralHierarchy(guardian, record.resultId, owner, options);
  const versions = await ok(guardian.from('behavioral_trial_derivations').select('processing_version,is_current').eq('trial_id', record.behavioral.trialIds[0]));
  assert.ok(versions.some((row) => row.processing_version === 'p0b-synthetic-old' && !row.is_current));
  await verify(record);
});

test('an owned participant cannot link a different patient main result through a session', async () => {
  const a = fixture(); const b = fixture(); b.child.childId = env.P0_TEST_OTHER_PATIENT_ID;
  await syncGameResult(guardian, a, owner);
  let blocked = false;
  const checkpointClient = client(env.P0_TEST_OTHER_GUARDIAN_TOKEN, async (input, init) => {
    if (!blocked && new URL(String(input)).pathname.endsWith('/rest/v1/behavioral_sessions') && init?.method === 'POST') {
      blocked = true; throw new TypeError('Synthetic main-only checkpoint');
    }
    return fetch(input, init);
  });
  await assert.rejects(syncGameResult(checkpointClient, b, other)); assert.equal(blocked, true);
  const session = await ok(guardian.from('behavioral_sessions').select('*').eq('source_result_id', a.resultId).single());
  const inserted = await guardian.from('behavioral_sessions').insert({ ...session, id: randomUUID(), source_result_id: b.resultId });
  assert.equal(inserted.error?.code, '42501');
  const updated = await guardian.from('behavioral_sessions').update({ source_result_id: b.resultId }).eq('id', session.id);
  assert.equal(updated.error?.code, '42501'); await verify(a);
});
