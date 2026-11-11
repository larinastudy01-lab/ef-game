// Expectations catalog; these entries are NOT test execution results.
const fs = require('node:fs');
const cases = [];
function add(name, testData, expected) {
  cases.push({ id: `P0B-I${String(cases.length + 1).padStart(2, '0')}`, purpose: name,
    testData: `Entirely synthetic, disposable project only: ${testData}`, expected,
    actual: 'NOT_RUN_NO_VERIFIED_ISOLATED_ENVIRONMENT', result: 'UNVERIFIED',
    unresolved: ['PostgreSQL/PostgREST/RLS execution required; local doubles are not substitutes'] });
}
['LB', 'PM'].forEach((task) => add(`${task}: full write, exact raw readback and duplicate submission`,
  task === 'LB' ? '20 events, two stages with overlapping stepIndex' : '12 administered trials including one legal cancellation',
  'One main/session/task, exact unique raw and current derivations; repeated submission retains IDs/content'));
['CBT', 'SRT', 'ARI', 'DCCS'].forEach((task) => add(`${task}: real schema accepts the current task code`, `${task}, one transport-only trial`,
  'Main, task, raw and derived rows written; raw answer and summary unchanged'));
['game_results', 'behavioral_sessions', 'behavioral_task_sessions', 'behavioral_trials', 'behavioral_trial_derivations'].forEach((table) =>
  add(`${table}: one interrupted request stays pending and a new client retries`, `LB20; one rejected ${table} request`,
    'No false success, source retained, a fresh client fills the complete hierarchy'));
add('lost raw insert acknowledgement retries without duplicate IDs or source keys', 'LB20, response lost after server commit', 'Retry converges to 20 original raw rows and 20 current derived rows');
add('existing session plus partial trial checkpoint fills remaining trials', 'LB7 checkpoint, then LB20 complete payload', 'Existing seven IDs/content retained, thirteen rows added');
add('real unique constraint rejects duplicate source key and leaves raw answers intact', 'LB20 plus conflicting new UUID/source key', '23505 and no raw changes');
add('anonymous/other guardian cannot read or attach a raw trial to this session', 'two distinct guardians/patients plus anonymous client', 'No foreign rows visible; insertion denied; original dataset unchanged');
add('guardian cannot rewrite a saved raw answer through PostgREST', 'an attempted update to stored raw_data', 'Stored acquisition data unchanged');
add('existing session survives a later main-result failure and can retry', 'complete LB20 followed by a failed main update', 'Previous hierarchy retained and retry completes');
add('full main payload with only seven committed trials stays pending and fills the remaining thirteen', 'full LB20 main plus a seven-row atomic synthetic checkpoint', 'Main remains pending until exact twenty-row readback succeeds; existing seven rows unchanged');
add('final main acknowledgement failure keeps research data and retries the final status safely', 'LB20 hierarchy succeeds, final main PATCH fails', 'Research retained, main pending, retry verifies full data before status acknowledgement');
add('two simultaneous sync clients converge after retry without duplicate trials', 'two clients submit the same LB20 result/IDs', 'At least one succeeds; conflicts retry to one exact dataset');
add('legacy SSG remains readable without conversion to ARI', 'one synthetic legacy SSG payload', 'Raw stored/read code stays SSG');
['ART', 'INVALID_TASK'].forEach((task) => add(`${task}: unrecognized task code still fails the real CHECK`, `one ${task} synthetic payload`, '23514; hierarchy never falsely acknowledged'));
add('unrelated nonnegative trial-count constraint remains enforced', 'valid LB20, then total_trials=-1', '23514; original dataset unchanged');
add('authorized researcher reads the complete hierarchy while an unauthorized clinician cannot', 'two approved clinicians, only one with guardian research consent', 'Authorized positive read on all six tables; unauthorized client sees no case rows');
add('own participant cannot be attached to another patient raw trial through a derivation', 'guardian A own participant plus B raw UUID; distinct processing version', 'Both INSERT and UPDATE fail 42501, not an unrelated unique violation');
add('reviewed isolated repair is repeatable and retains old derivation versions and main status', 'reviewed LB20 plan plus inactive synthetic old derivation', 'Verified count/IDs/content, old version retained, historical main payload/status unchanged');
add('an owned participant cannot link a different patient main result through a session', 'B main-only checkpoint plus A owned participant', 'INSERT/UPDATE fail 42501, not a duplicate source-result constraint');

if (require.main === module) {
  if (!process.argv[2]) throw new Error('Output JSON path required');
  fs.writeFileSync(process.argv[2], JSON.stringify({ executionStatus: 'UNVERIFIED', cases }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ cases: cases.length, executed: 0, status: 'UNVERIFIED' }));
}
module.exports = { cases };
