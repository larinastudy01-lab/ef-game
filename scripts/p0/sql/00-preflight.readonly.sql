-- Admin-authorized READ ONLY snapshot. Contains record IDs: keep private output local.
begin isolation level repeatable read read only;
with sources as (
  select g.*, p.id is not null and p.guardian_id=g.guardian_id owner_binding_valid,
    coalesce((select a.v from (values (1,g.payload->'trials'),(2,g.payload#>'{rawResult,trials}'),
      (3,g.payload#>'{rawResult,trialLogs}'),(4,g.payload#>'{rawResult,records}'),(5,g.payload#>'{rawResult,logs}'),
      (6,g.payload#>'{rawResult,history}'),(7,g.payload#>'{rawResult,rounds}')) a(priority,v)
      where jsonb_typeof(a.v)='array' and case when jsonb_typeof(a.v)='array' then jsonb_array_length(a.v)>0 else false end
      order by a.priority limit 1),'[]'::jsonb) source_trials
  from public.game_results g left join public.patients p on p.id=g.patient_id
), trial_details as (
  select g.id,t.ordinality ordinal,t.value raw,
    coalesce(t.value->>'trialId',t.value->>'trial_id',t.value->>'trialIndex',t.value->>'trialNumber',t.value->>'stepIndex',t.ordinality::text) old_key,
    case when g.game_id='LB' and t.value->>'stageId' is not null
      then 'LB:'||(t.value->>'stageId')||':'||coalesce(t.value->>'stepIndex',t.value->>'stepInLevel',t.value->>'trialNumber',t.value->>'trialIndex',t.ordinality::text)
      else coalesce(t.value->>'trialId',t.value->>'trial_id',t.value->>'trialIndex',t.value->>'trialNumber',t.value->>'stepIndex',t.ordinality::text) end canonical_key
  from sources g cross join lateral jsonb_array_elements(g.source_trials) with ordinality t(value,ordinality)
), records as (
  select g.id main_result_id,g.id game_result_id,g.payload->>'resultId' payload_result_id,
    left(encode(sha256(convert_to(g.id,'UTF8')),'hex'),20) result_ref,
    g.game_id,g.mode,g.payload#>>'{game,gameId}' payload_game_id,g.payload#>>'{session,mode}' payload_mode,
    g.payload#>>'{session,status}' completion_status,
    g.owner_binding_valid,
    coalesce(g.payload#>>'{child,childId}',g.patient_id::text)=g.patient_id::text payload_patient_matches,
    g.payload#>>'{behavioral,sessionId}' original_session_id,
    g.payload#>>'{behavioral,taskSessionId}' original_task_session_id,
    case when jsonb_typeof(g.payload#>'{behavioral,trialIds}')='array' then g.payload#>'{behavioral,trialIds}' else '[]'::jsonb end original_trial_ids,
    jsonb_array_length(g.source_trials) source_trial_count,g.total_trials declared_trial_count,
    g.payload#>'{summary,totalTrials}' payload_declared_trial_count,
    g.started_at,g.finished_at,
    g.payload#>>'{session,startedAt}' payload_started_at,g.payload#>>'{session,finishedAt}' payload_finished_at,
    g.payload->>'syncStatus' sync_status,g.payload#>'{syncState}' sync_state,
    jsonb_typeof(g.payload) payload_type,
    encode(sha256(convert_to(g.payload::text,'UTF8')),'hex') source_payload_sha256,
    (select jsonb_agg(encode(sha256(convert_to(raw::text,'UTF8')),'hex') order by ordinal) from trial_details t where t.id=g.id) source_trial_sha256,
    (select count(*) from trial_details t where t.id=g.id and jsonb_typeof(t.raw)<>'object') non_object_trials,
    (select count(*) from trial_details t where t.id=g.id and coalesce(jsonb_typeof(t.raw->'isCorrect'),jsonb_typeof(t.raw->'correct'),'null')<>'boolean') missing_outcome_trials,
    (select count(*)-count(distinct old_key) from trial_details t where t.id=g.id) old_duplicate_key_count,
    (select count(*)-count(distinct canonical_key) from trial_details t where t.id=g.id) canonical_duplicate_key_count,
    s.id session_id,ts.id task_session_id,ts.total_trials stored_task_total,
    (select count(*) from public.behavioral_trials b where b.task_session_id=ts.id) stored_trial_count,
    (select count(*) from public.behavioral_trial_derivations d join public.behavioral_trials b on b.id=d.trial_id where b.task_session_id=ts.id and d.is_current) stored_current_derivation_count,
    (select count(*) from public.behavioral_trials b where b.task_session_id=ts.id and not exists(select 1 from trial_details t where t.id=g.id and t.raw=b.raw_data)) unmatched_stored_raw_count,
    case when g.game_id='LB' then (select jsonb_agg(jsonb_build_object(
      'ordinal',ordinal,'oldKey',old_key,'canonicalKey',canonical_key,
      'stageId',raw->'stageId','phase',raw->'phase','stage',raw->'stage','ruleStage',raw->'ruleStage',
      'level',raw->'level','levelId',raw->'levelId','taskType',raw->'taskType','ruleType',raw->'ruleType',
      'recordedStatus',raw->'status','isCorrect',raw->'isCorrect',
      'difficulty',raw->'difficulty','stepIndex',raw->'stepIndex','stepInLevel',raw->'stepInLevel',
      'trialIndex',raw->'trialIndex','trialNumber',raw->'trialNumber','round',raw->'round','rule',raw->'rule') order by ordinal)
      from trial_details t where t.id=g.id) end lb_key_evidence,
    case when g.game_id='PM' then (select jsonb_agg((select jsonb_object_agg(k,v) from jsonb_each(raw) f(k,v)
      where k in ('trialIndex','trialNumber','isCorrect','isTimeout','timedOut','timeout','responseStatus','administered','presentedAt','isAdministered',
      'selectedIds','correctIds','completed','reactionTime','responseTime','answerTime','rt','deselectCount','doubleClickCount','repeatedClickCount','errorTypes','tapLogs','clickLogs','memoryCount','errorType')) order by ordinal)
      from trial_details t where t.id=g.id) end pm_projection
  from sources g
  left join public.behavioral_sessions s on s.source_result_id=g.id
  left join public.behavioral_task_sessions ts on ts.session_id=s.id and ts.task_order_index=1
)
select jsonb_build_object(
  'dryRun',true,'snapshotAt',transaction_timestamp(),'coverage','admin_repeatable_read_snapshot_all_main_rows',
  'schema',jsonb_build_object(
    'checks',(select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid),'validated',convalidated)) from pg_constraint
      where conrelid in ('public.behavioral_task_sessions'::regclass,'public.behavioral_trial_derivations'::regclass)),
    'rls',(select jsonb_object_agg(relname,relrowsecurity) from pg_class where oid in ('public.game_results'::regclass,'public.research_participants'::regclass,'public.behavioral_sessions'::regclass,'public.behavioral_task_sessions'::regclass,'public.behavioral_trials'::regclass,'public.behavioral_trial_derivations'::regclass)),
    'policies',(select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname='public' and tablename like 'behavioral%')
  ),
  'records',(select jsonb_agg(to_jsonb(r) order by result_ref) from records r)
) p0b_preflight;
commit;
