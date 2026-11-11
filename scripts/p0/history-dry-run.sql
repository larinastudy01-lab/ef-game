-- Run with an authorized read-only/admin connection. No repair or migration.
-- One repeatable-read snapshot, all rows including records already marked synced.
begin isolation level repeatable read read only;
with sources as (
  select g.*, coalesce((
    select a.v from (values
      (1, g.payload->'trials'), (2, g.payload#>'{rawResult,trials}'),
      (3, g.payload#>'{rawResult,trialLogs}'), (4, g.payload#>'{rawResult,records}'),
      (5, g.payload#>'{rawResult,logs}'), (6, g.payload#>'{rawResult,history}'),
      (7, g.payload#>'{rawResult,rounds}')
    ) a(priority, v)
    where jsonb_typeof(a.v) = 'array'
      and case when jsonb_typeof(a.v) = 'array' then jsonb_array_length(a.v) > 0 else false end
    order by a.priority limit 1
  ), '[]'::jsonb) source_trials
  from public.game_results g
), per_result as (
  select left(encode(sha256(convert_to(g.id,'UTF8')),'hex'),20) result_ref, g.game_id, g.mode,
    g.payload->>'syncStatus' sync_status,
    jsonb_array_length(g.source_trials) source_trial_count,
    g.total_trials declared_trial_count,
    s.id is null missing_session, ts.id is null missing_task,
    ts.total_trials stored_task_total,
    (select count(*) from public.behavioral_trials b where b.task_session_id=ts.id) stored_trial_count,
    (select count(*) from public.behavioral_trial_derivations d join public.behavioral_trials b on b.id=d.trial_id
      where b.task_session_id=ts.id and d.is_current) stored_current_derivation_count,
    (select count(*) from public.behavioral_trials b where b.task_session_id=ts.id
      and not exists(select 1 from jsonb_array_elements(g.source_trials) tr where tr=b.raw_data)) unmatched_stored_raw_count,
    case when g.game_id='LB' then (
      select count(*)-count(distinct coalesce(tr->>'trialId',tr->>'trial_id',tr->>'trialIndex',tr->>'trialNumber',tr->>'stepIndex',ordinality::text))
      from jsonb_array_elements(g.source_trials) with ordinality t(tr,ordinality)
    ) end lb_old_duplicate_key_count,
    case when g.game_id='LB' then (
      select count(*)-count(distinct case when tr->>'stageId' is not null
        then 'LB:'||(tr->>'stageId')||':'||coalesce(tr->>'stepIndex',tr->>'stepInLevel',tr->>'trialNumber',tr->>'trialIndex',ordinality::text)
        else coalesce(tr->>'trialId',tr->>'trial_id',tr->>'trialIndex',tr->>'trialNumber',tr->>'stepIndex',ordinality::text) end)
      from jsonb_array_elements(g.source_trials) with ordinality t(tr,ordinality)
    ) end lb_current_duplicate_key_count,
    case when g.game_id='PM' then (
      select count(*) from jsonb_array_elements(g.source_trials) tr where
        case when coalesce(tr->>'deselectCount','0') ~ '^[0-9]+$' then (tr->>'deselectCount')::numeric>0 else false end
    ) end pm_deselection_candidate_trials,
    case when g.game_id='PM' then (
      select count(*) from jsonb_array_elements(g.source_trials) tr where
        tr->'isTimeout'='true'::jsonb or tr->'timedOut'='true'::jsonb or tr->'timeout'='true'::jsonb
        or tr->>'responseStatus' in ('timed_out','timeout') or tr->>'errorType'='timeout'
    ) end pm_recorded_timeout_trials
  from sources g
  left join public.behavioral_sessions s on s.source_result_id=g.id
  left join public.behavioral_task_sessions ts on ts.session_id=s.id and ts.task_order_index=1
), report as (
  select jsonb_build_object(
    'dryRun',true,'snapshotAt',transaction_timestamp(),
    'coverage','all_main_results_including_synced; admin_snapshot; no_device_local_outboxes',
    'summary',(select jsonb_build_object(
      'results',count(*),'sourceTrials',coalesce(sum(source_trial_count),0),
      'missingSession',count(*) filter(where missing_session),
      'missingTask',count(*) filter(where missing_task),
      'syncedButMissingHierarchy',count(*) filter(where sync_status='synced' and (missing_session or missing_task or stored_trial_count<>source_trial_count or stored_current_derivation_count<>source_trial_count)),
      'declaredCountExceedsRaw',count(*) filter(where declared_trial_count>source_trial_count),
      'zeroSourceResults',count(*) filter(where source_trial_count=0),
      'unmatchedStoredRaw',coalesce(sum(unmatched_stored_raw_count),0),
      'lbCollisionResults',count(*) filter(where lb_old_duplicate_key_count>0),
      'lbDuplicateKeys',coalesce(sum(lb_old_duplicate_key_count),0),
      'lbUnresolvedCollisionResults',count(*) filter(where lb_current_duplicate_key_count>0),
      'lbUnresolvedDuplicateKeys',coalesce(sum(lb_current_duplicate_key_count),0),
      'pmDeselectionCandidates',coalesce(sum(pm_deselection_candidate_trials),0),
      'pmRecordedTimeouts',coalesce(sum(pm_recorded_timeout_trials),0)
    ) from per_result),
    'byTask',(select jsonb_agg(to_jsonb(x)) from (
      select game_id,mode,count(*) results,sum(source_trial_count) source_trials,
        sum(stored_trial_count) stored_trials,sum(pm_deselection_candidate_trials) pm_deselection_candidates,
        sum(pm_recorded_timeout_trials) pm_recorded_timeouts
      from per_result group by game_id,mode order by game_id,mode
    ) x),
    'results',(select coalesce(jsonb_agg(to_jsonb(x) order by result_ref),'[]'::jsonb) from per_result x),
    'limitations',jsonb_build_array(
      'String-encoded JSON payloads require the JS scanner; this SQL reports object payloads.',
      'PM SQL counts are candidates/evidence only. Recompute exact features with the versioned JS mapper; do not substitute this SQL for its response-state contract.',
      'Raw equality here checks membership; JS reconciliation is required for exact ID/count/multiplicity verification.',
      'No source rows are modified. No automatic repair list is approved.'
    )
  ) value
)
select value as p0_history_dry_run from report;
commit;
