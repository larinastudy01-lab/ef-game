-- Phase 4: additive experiment metadata tracking. No raw or derived behavioral row is modified.
create table if not exists public.ml_experiments (
  id text primary key,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  dataset_version text not null,
  feature_version text not null,
  ml_pipeline_version text not null,
  target_definition text not null,
  target_type text not null check (target_type in ('classification', 'regression')),
  model_name text not null,
  hyperparameters jsonb not null default '{}'::jsonb,
  random_seed integer not null,
  split_method text not null check (split_method in ('ParticipantHoldout + GroupKFold', 'ParticipantHoldout + StratifiedGroupKFold')),
  train_participants jsonb not null,
  validation_participants jsonb not null,
  test_participants jsonb not null,
  metrics jsonb not null,
  class_distribution jsonb,
  training_time_ms integer check (training_time_ms >= 0),
  training_timestamp timestamptz not null,
  code_model_version text,
  data_mode text not null default 'observed_research' check (data_mode = 'observed_research'),
  created_at timestamptz not null default now()
);

comment on table public.ml_experiments is
  'Reproducibility metadata for behavioral prediction experiments. Synthetic demo runs are intentionally rejected.';

create index if not exists idx_ml_experiments_creator_time on public.ml_experiments(created_by, training_timestamp desc);
create index if not exists idx_ml_experiments_target_model on public.ml_experiments(target_definition, model_name, training_timestamp desc);

alter table public.ml_experiments enable row level security;

create policy "ml_experiments_select_own_professional" on public.ml_experiments
for select using (
  created_by = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('clinician', 'medical', 'doctor'))
);

create policy "ml_experiments_insert_own_professional" on public.ml_experiments
for insert with check (
  created_by = auth.uid()
  and data_mode = 'observed_research'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('clinician', 'medical', 'doctor'))
);

grant select, insert on public.ml_experiments to authenticated;

-- Rollback (metadata only):
-- drop table if exists public.ml_experiments;
