-- Phase 1: trial-level behavioral data architecture.
-- Additive migration: existing patients/game_results and payloads are not modified.

create extension if not exists "pgcrypto";

create table if not exists public.research_participants (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique references public.patients(id) on delete cascade,
  participant_status text not null default 'active' check (participant_status in ('active', 'withdrawn', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.research_participants is
  'Identity bridge. Research datasets use id; names and direct identifiers remain in patients and must not be exported.';

create table if not exists public.behavioral_sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.research_participants(id) on delete restrict,
  session_type text not null default 'single_task_session',
  assessment_or_training text not null check (assessment_or_training in ('assessment', 'training')),
  started_at timestamptz,
  completed_at timestamptz,
  device_information jsonb not null default '{}'::jsonb,
  task_order text[] not null default '{}'::text[],
  session_status text not null default 'in_progress'
    check (session_status in ('in_progress', 'completed', 'interrupted', 'abandoned')),
  source_result_id text unique,
  schema_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

create table if not exists public.behavioral_task_sessions (
  id uuid primary key default gen_random_uuid(),
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
  mean_reaction_time_ms numeric,
  completion_status text not null default 'in_progress'
    check (completion_status in ('in_progress', 'completed', 'interrupted', 'abandoned')),
  raw_task_data jsonb not null default '{}'::jsonb,
  raw_schema_version text not null,
  created_at timestamptz not null default now(),
  unique (session_id, task_order_index),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

-- Immutable acquisition records. No derived score or validity decision is stored here.
create table if not exists public.behavioral_trials (
  id uuid primary key default gen_random_uuid(),
  task_session_id uuid not null references public.behavioral_task_sessions(id) on delete cascade,
  source_trial_key text not null,
  trial_index integer,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  raw_data jsonb not null,
  raw_schema_version text not null,
  raw_data_sha256 text,
  created_at timestamptz not null default now()
);

-- Versioned interpretation of an immutable raw trial.
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
  reaction_time_ms numeric,
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

create index if not exists idx_research_participants_patient on public.research_participants(patient_id);
create index if not exists idx_behavioral_sessions_participant_time on public.behavioral_sessions(participant_id, started_at desc);
create index if not exists idx_behavioral_sessions_mode on public.behavioral_sessions(assessment_or_training, started_at desc);
create index if not exists idx_behavioral_task_sessions_session on public.behavioral_task_sessions(session_id, task_order_index);
create index if not exists idx_behavioral_task_sessions_task on public.behavioral_task_sessions(task_code, started_at desc);
create index if not exists idx_behavioral_trials_task_index on public.behavioral_trials(task_session_id, trial_index);
create index if not exists idx_behavioral_trials_source_key on public.behavioral_trials(task_session_id, source_trial_key);
create index if not exists idx_trial_derivations_participant_task on public.behavioral_trial_derivations(participant_id, task_code, processed_at desc);
create index if not exists idx_trial_derivations_quality on public.behavioral_trial_derivations(task_code, valid_trial, processing_version);
create unique index if not exists idx_trial_derivations_one_current
  on public.behavioral_trial_derivations(trial_id) where is_current;

create or replace function public.can_read_research_participant(target_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.research_participants rp
    join public.patients pa on pa.id = rp.patient_id
    where rp.id = target_participant_id
      and (
        pa.guardian_id = auth.uid()
        or exists (
          select 1 from public.clinician_patient_access cpa
          where cpa.patient_id = pa.id and cpa.clinician_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.can_write_research_participant(target_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.research_participants rp
    join public.patients pa on pa.id = rp.patient_id
    where rp.id = target_participant_id and pa.guardian_id = auth.uid()
  );
$$;

revoke all on function public.can_read_research_participant(uuid) from public;
revoke all on function public.can_write_research_participant(uuid) from public;
grant execute on function public.can_read_research_participant(uuid) to authenticated;
grant execute on function public.can_write_research_participant(uuid) to authenticated;

create or replace function public.prevent_raw_behavioral_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.raw_data is distinct from new.raw_data
     or old.raw_schema_version is distinct from new.raw_schema_version
     or old.task_session_id is distinct from new.task_session_id
     or old.source_trial_key is distinct from new.source_trial_key then
    raise exception 'Raw behavioral data is immutable; append a new record instead';
  end if;
  return new;
end;
$$;

drop trigger if exists behavioral_trials_raw_immutable on public.behavioral_trials;
create trigger behavioral_trials_raw_immutable
before update on public.behavioral_trials
for each row execute function public.prevent_raw_behavioral_mutation();

alter table public.research_participants enable row level security;
alter table public.behavioral_sessions enable row level security;
alter table public.behavioral_task_sessions enable row level security;
alter table public.behavioral_trials enable row level security;
alter table public.behavioral_trial_derivations enable row level security;

create policy "research_participants_select_related" on public.research_participants
for select using (public.can_read_research_participant(id));
create policy "research_participants_insert_guardian" on public.research_participants
for insert with check (exists (select 1 from public.patients pa where pa.id = patient_id and pa.guardian_id = auth.uid()));
create policy "research_participants_update_guardian" on public.research_participants
for update using (public.can_write_research_participant(id)) with check (public.can_write_research_participant(id));

create policy "behavioral_sessions_select_related" on public.behavioral_sessions
for select using (public.can_read_research_participant(participant_id));
create policy "behavioral_sessions_insert_guardian" on public.behavioral_sessions
for insert with check (public.can_write_research_participant(participant_id));
create policy "behavioral_sessions_update_guardian" on public.behavioral_sessions
for update using (public.can_write_research_participant(participant_id)) with check (public.can_write_research_participant(participant_id));

create policy "task_sessions_select_related" on public.behavioral_task_sessions
for select using (exists (select 1 from public.behavioral_sessions s where s.id = session_id and public.can_read_research_participant(s.participant_id)));
create policy "task_sessions_insert_guardian" on public.behavioral_task_sessions
for insert with check (exists (select 1 from public.behavioral_sessions s where s.id = session_id and public.can_write_research_participant(s.participant_id)));
create policy "task_sessions_update_guardian" on public.behavioral_task_sessions
for update using (exists (select 1 from public.behavioral_sessions s where s.id = session_id and public.can_write_research_participant(s.participant_id)))
with check (exists (select 1 from public.behavioral_sessions s where s.id = session_id and public.can_write_research_participant(s.participant_id)));

create policy "trials_select_related" on public.behavioral_trials
for select using (exists (
  select 1 from public.behavioral_task_sessions ts
  join public.behavioral_sessions s on s.id = ts.session_id
  where ts.id = task_session_id and public.can_read_research_participant(s.participant_id)
));
create policy "trials_insert_guardian" on public.behavioral_trials
for insert with check (exists (
  select 1 from public.behavioral_task_sessions ts
  join public.behavioral_sessions s on s.id = ts.session_id
  where ts.id = task_session_id and public.can_write_research_participant(s.participant_id)
));

create policy "trial_derivations_select_related" on public.behavioral_trial_derivations
for select using (public.can_read_research_participant(participant_id));
create policy "trial_derivations_insert_guardian" on public.behavioral_trial_derivations
for insert with check (public.can_write_research_participant(participant_id));
create policy "trial_derivations_update_guardian" on public.behavioral_trial_derivations
for update using (public.can_write_research_participant(participant_id)) with check (public.can_write_research_participant(participant_id));

grant select, insert, update on public.research_participants to authenticated;
grant select, insert, update on public.behavioral_sessions to authenticated;
grant select, insert, update on public.behavioral_task_sessions to authenticated;
grant select, insert on public.behavioral_trials to authenticated;
grant select, insert, update on public.behavioral_trial_derivations to authenticated;
