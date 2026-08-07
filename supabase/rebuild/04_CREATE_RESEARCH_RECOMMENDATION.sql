-- Trial-level research data, ML experiment registry and adaptive decisions.
-- Run after 01_CREATE_AUTH_PATIENTS_RESULTS.sql.
begin;

create table if not exists public.research_participants (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique references public.patients(id) on delete cascade,
  participant_status text not null default 'active'
    check (participant_status in ('active', 'withdrawn', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.research_participants is
  'De-identified research bridge. Export this id, never patient identity fields.';

create table if not exists public.behavioral_sessions (
  id uuid primary key,
  participant_id uuid not null references public.research_participants(id) on delete restrict,
  session_type text not null default 'single_task_session',
  assessment_or_training text not null
    check (assessment_or_training in ('assessment', 'training')),
  started_at timestamptz,
  completed_at timestamptz,
  device_information jsonb not null default '{}'::jsonb,
  task_order text[] not null default '{}'::text[],
  session_status text not null default 'in_progress'
    check (session_status in ('in_progress', 'completed', 'interrupted', 'abandoned')),
  source_result_id text unique references public.game_results(id) on delete set null,
  schema_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

create table if not exists public.behavioral_task_sessions (
  id uuid primary key,
  session_id uuid not null references public.behavioral_sessions(id) on delete cascade,
  task_code text not null check (task_code in ('CBT', 'PM', 'SRT', 'SSG', 'LB', 'DCCS')),
  task_name text not null,
  task_order_index integer not null default 1 check (task_order_index > 0),
  difficulty text,
  started_at timestamptz,
  completed_at timestamptz,
  total_trials integer not null default 0 check (total_trials >= 0),
  correct_trials integer not null default 0 check (correct_trials >= 0),
  incorrect_trials integer not null default 0 check (incorrect_trials >= 0),
  mean_reaction_time_ms numeric check (mean_reaction_time_ms is null or mean_reaction_time_ms >= 0),
  completion_status text not null default 'in_progress'
    check (completion_status in ('in_progress', 'completed', 'interrupted', 'abandoned')),
  raw_task_data jsonb not null default '{}'::jsonb,
  raw_schema_version text not null,
  created_at timestamptz not null default now(),
  unique (session_id, task_order_index),
  check (correct_trials <= total_trials),
  check (incorrect_trials <= total_trials),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

create table if not exists public.behavioral_trials (
  id uuid primary key,
  task_session_id uuid not null references public.behavioral_task_sessions(id) on delete cascade,
  source_trial_key text not null,
  trial_index integer check (trial_index is null or trial_index >= 0),
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  raw_data jsonb not null,
  raw_schema_version text not null,
  raw_data_sha256 text,
  created_at timestamptz not null default now(),
  unique (task_session_id, source_trial_key)
);

create table if not exists public.behavioral_trial_derivations (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references public.behavioral_trials(id) on delete cascade,
  participant_id uuid not null references public.research_participants(id) on delete restrict,
  task_name text not null,
  task_code text not null check (task_code in ('CBT', 'PM', 'SRT', 'SSG', 'LB', 'DCCS')),
  trial_index integer,
  stimulus jsonb,
  condition text,
  difficulty text,
  expected_response jsonb,
  actual_response jsonb,
  is_correct boolean,
  reaction_time_ms numeric check (reaction_time_ms is null or reaction_time_ms >= 0),
  error_type text,
  task_specific_metadata jsonb not null default '{}'::jsonb,
  valid_trial boolean not null,
  exclusion_reasons text[] not null default '{}'::text[],
  processing_version text not null,
  is_current boolean not null default true,
  processed_at timestamptz not null default now(),
  unique (trial_id, processing_version),
  check (not valid_trial or cardinality(exclusion_reasons) = 0)
);

create table if not exists public.ml_experiments (
  id text primary key,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  dataset_version text not null,
  feature_version text not null,
  ml_pipeline_version text not null,
  research_question text,
  result_path text,
  target_definition text not null,
  target_type text not null check (target_type in ('classification', 'regression')),
  model_name text not null,
  hyperparameters jsonb not null default '{}'::jsonb,
  random_seed integer not null,
  split_method text not null
    check (split_method in ('ParticipantHoldout + GroupKFold', 'ParticipantHoldout + StratifiedGroupKFold')),
  train_participants jsonb not null,
  validation_participants jsonb not null,
  test_participants jsonb not null,
  metrics jsonb not null,
  class_distribution jsonb,
  training_time_ms integer check (training_time_ms is null or training_time_ms >= 0),
  training_timestamp timestamptz not null,
  code_model_version text,
  data_mode text not null default 'observed_research' check (data_mode = 'observed_research'),
  created_at timestamptz not null default now()
);

create table if not exists public.recommendation_decisions (
  id text primary key,
  participant_id uuid not null references public.research_participants(id) on delete restrict,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  recommendation_timestamp timestamptz not null,
  recommendation_version text not null,
  policy_name text not null,
  policy_version text not null,
  reward_version text not null,
  context jsonb not null,
  available_actions jsonb not null,
  selected_action jsonb not null,
  predicted_reward numeric,
  exploration boolean not null default false,
  actual_outcome jsonb,
  actual_reward numeric check (actual_reward is null or actual_reward between 0 and 1),
  reward_components jsonb,
  outcome_recorded_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (actual_outcome is null and actual_reward is null and outcome_recorded_at is null)
    or (actual_outcome is not null and actual_reward is not null and outcome_recorded_at is not null)
  )
);

create index if not exists research_participants_patient_idx on public.research_participants(patient_id);
create index if not exists behavioral_sessions_participant_time_idx on public.behavioral_sessions(participant_id, started_at desc);
create index if not exists behavioral_task_sessions_session_idx on public.behavioral_task_sessions(session_id, task_order_index);
create index if not exists behavioral_task_sessions_task_idx on public.behavioral_task_sessions(task_code, started_at desc);
create index if not exists behavioral_trials_task_idx on public.behavioral_trials(task_session_id, trial_index);
create index if not exists derivations_participant_task_idx on public.behavioral_trial_derivations(participant_id, task_code, processed_at desc);
create unique index if not exists derivations_one_current_idx
  on public.behavioral_trial_derivations(trial_id) where is_current;
create index if not exists ml_experiments_creator_time_idx on public.ml_experiments(created_by, training_timestamp desc);
create index if not exists recommendation_participant_time_idx on public.recommendation_decisions(participant_id, recommendation_timestamp desc);
create index if not exists recommendation_policy_time_idx on public.recommendation_decisions(policy_version, recommendation_timestamp desc);

create or replace function public.can_read_research_participant(target_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.research_participants rp
    where rp.id = target_participant_id
      and public.can_access_patient(rp.patient_id)
  );
$$;

create or replace function public.can_write_research_participant(target_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.research_participants rp
    join public.patients p on p.id = rp.patient_id
    where rp.id = target_participant_id and p.guardian_id = auth.uid()
  );
$$;

create or replace function public.prevent_raw_behavioral_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.task_session_id is distinct from new.task_session_id
     or old.source_trial_key is distinct from new.source_trial_key
     or old.raw_data is distinct from new.raw_data
     or old.raw_schema_version is distinct from new.raw_schema_version then
    raise exception 'Raw behavioral acquisition fields are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists behavioral_trials_raw_immutable on public.behavioral_trials;
create trigger behavioral_trials_raw_immutable
before update on public.behavioral_trials
for each row execute function public.prevent_raw_behavioral_mutation();

create or replace function public.protect_recommendation_decision()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.participant_id is distinct from new.participant_id
     or old.created_by is distinct from new.created_by
     or old.context is distinct from new.context
     or old.available_actions is distinct from new.available_actions
     or old.selected_action is distinct from new.selected_action
     or old.policy_version is distinct from new.policy_version
     or old.reward_version is distinct from new.reward_version then
    raise exception 'Recommendation decision fields are immutable';
  end if;
  if old.actual_outcome is not null and (
    old.actual_outcome is distinct from new.actual_outcome
    or old.actual_reward is distinct from new.actual_reward
  ) then
    raise exception 'Recommendation outcome has already been recorded';
  end if;
  return new;
end;
$$;

drop trigger if exists recommendation_decision_protect on public.recommendation_decisions;
create trigger recommendation_decision_protect
before update on public.recommendation_decisions
for each row execute function public.protect_recommendation_decision();

alter table public.research_participants enable row level security;
alter table public.behavioral_sessions enable row level security;
alter table public.behavioral_task_sessions enable row level security;
alter table public.behavioral_trials enable row level security;
alter table public.behavioral_trial_derivations enable row level security;
alter table public.ml_experiments enable row level security;
alter table public.recommendation_decisions enable row level security;

drop policy if exists research_participants_select_related on public.research_participants;
drop policy if exists research_participants_insert_guardian on public.research_participants;
drop policy if exists research_participants_update_guardian on public.research_participants;
create policy research_participants_select_related on public.research_participants
for select to authenticated using (public.can_read_research_participant(id));
create policy research_participants_insert_guardian on public.research_participants
for insert to authenticated with check (
  exists (select 1 from public.patients p where p.id = patient_id and p.guardian_id = auth.uid())
);
create policy research_participants_update_guardian on public.research_participants
for update to authenticated
using (public.can_write_research_participant(id))
with check (public.can_write_research_participant(id));

drop policy if exists behavioral_sessions_select_related on public.behavioral_sessions;
drop policy if exists behavioral_sessions_insert_guardian on public.behavioral_sessions;
drop policy if exists behavioral_sessions_update_guardian on public.behavioral_sessions;
create policy behavioral_sessions_select_related on public.behavioral_sessions
for select to authenticated using (public.can_read_research_participant(participant_id));
create policy behavioral_sessions_insert_guardian on public.behavioral_sessions
for insert to authenticated with check (public.can_write_research_participant(participant_id));
create policy behavioral_sessions_update_guardian on public.behavioral_sessions
for update to authenticated
using (public.can_write_research_participant(participant_id))
with check (public.can_write_research_participant(participant_id));

drop policy if exists task_sessions_select_related on public.behavioral_task_sessions;
drop policy if exists task_sessions_insert_guardian on public.behavioral_task_sessions;
drop policy if exists task_sessions_update_guardian on public.behavioral_task_sessions;
create policy task_sessions_select_related on public.behavioral_task_sessions
for select to authenticated using (exists (
  select 1 from public.behavioral_sessions s
  where s.id = session_id and public.can_read_research_participant(s.participant_id)
));
create policy task_sessions_insert_guardian on public.behavioral_task_sessions
for insert to authenticated with check (exists (
  select 1 from public.behavioral_sessions s
  where s.id = session_id and public.can_write_research_participant(s.participant_id)
));
create policy task_sessions_update_guardian on public.behavioral_task_sessions
for update to authenticated using (exists (
  select 1 from public.behavioral_sessions s
  where s.id = session_id and public.can_write_research_participant(s.participant_id)
)) with check (exists (
  select 1 from public.behavioral_sessions s
  where s.id = session_id and public.can_write_research_participant(s.participant_id)
));

drop policy if exists trials_select_related on public.behavioral_trials;
drop policy if exists trials_insert_guardian on public.behavioral_trials;
create policy trials_select_related on public.behavioral_trials
for select to authenticated using (exists (
  select 1 from public.behavioral_task_sessions ts
  join public.behavioral_sessions s on s.id = ts.session_id
  where ts.id = task_session_id and public.can_read_research_participant(s.participant_id)
));
create policy trials_insert_guardian on public.behavioral_trials
for insert to authenticated with check (exists (
  select 1 from public.behavioral_task_sessions ts
  join public.behavioral_sessions s on s.id = ts.session_id
  where ts.id = task_session_id and public.can_write_research_participant(s.participant_id)
));

drop policy if exists derivations_select_related on public.behavioral_trial_derivations;
drop policy if exists derivations_insert_guardian on public.behavioral_trial_derivations;
drop policy if exists derivations_update_guardian on public.behavioral_trial_derivations;
create policy derivations_select_related on public.behavioral_trial_derivations
for select to authenticated using (public.can_read_research_participant(participant_id));
create policy derivations_insert_guardian on public.behavioral_trial_derivations
for insert to authenticated with check (public.can_write_research_participant(participant_id));
create policy derivations_update_guardian on public.behavioral_trial_derivations
for update to authenticated
using (public.can_write_research_participant(participant_id))
with check (public.can_write_research_participant(participant_id));

drop policy if exists ml_experiments_select_professional on public.ml_experiments;
drop policy if exists ml_experiments_insert_professional on public.ml_experiments;
create policy ml_experiments_select_professional on public.ml_experiments
for select to authenticated using (public.is_professional());
create policy ml_experiments_insert_professional on public.ml_experiments
for insert to authenticated with check (
  created_by = auth.uid() and data_mode = 'observed_research' and public.is_professional()
);

drop policy if exists recommendation_select_related on public.recommendation_decisions;
drop policy if exists recommendation_insert_related on public.recommendation_decisions;
drop policy if exists recommendation_update_creator on public.recommendation_decisions;
create policy recommendation_select_related on public.recommendation_decisions
for select to authenticated using (public.can_read_research_participant(participant_id));
create policy recommendation_insert_related on public.recommendation_decisions
for insert to authenticated with check (
  created_by = auth.uid()
  and (
    public.can_write_research_participant(participant_id)
    or (public.is_professional() and public.can_read_research_participant(participant_id))
  )
);
create policy recommendation_update_creator on public.recommendation_decisions
for update to authenticated
using (created_by = auth.uid()) with check (created_by = auth.uid());

grant select, insert, update on public.research_participants to authenticated;
grant select, insert, update on public.behavioral_sessions to authenticated;
grant select, insert, update on public.behavioral_task_sessions to authenticated;
grant select, insert on public.behavioral_trials to authenticated;
grant select, insert, update on public.behavioral_trial_derivations to authenticated;
grant select, insert on public.ml_experiments to authenticated;
grant select, insert, update on public.recommendation_decisions to authenticated;
revoke all on function public.can_read_research_participant(uuid) from public;
revoke all on function public.can_write_research_participant(uuid) from public;
grant execute on function public.can_read_research_participant(uuid) to authenticated;
grant execute on function public.can_write_research_participant(uuid) to authenticated;

commit;

-- Verification: expect seven rows, all with RLS enabled.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'research_participants', 'behavioral_sessions', 'behavioral_task_sessions',
    'behavioral_trials', 'behavioral_trial_derivations', 'ml_experiments',
    'recommendation_decisions'
  )
order by c.relname;
