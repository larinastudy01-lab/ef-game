-- Persistent, per-child honey milestone progress.
create table if not exists public.honey_mission_progress (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  round integer not null default 1 check (round between 1 and 5),
  daily_stars jsonb not null default '{}'::jsonb,
  credited_stages jsonb not null default '{}'::jsonb,
  effective_training_days text[] not null default '{}'::text[],
  last_effective_training_date date,
  milestone_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.honey_mission_progress enable row level security;

drop policy if exists honey_progress_select_guardian on public.honey_mission_progress;
drop policy if exists honey_progress_insert_guardian on public.honey_mission_progress;
drop policy if exists honey_progress_update_guardian on public.honey_mission_progress;

create policy honey_progress_select_guardian
on public.honey_mission_progress for select to authenticated
using (exists (
  select 1 from public.patients p
  where p.id = patient_id and p.guardian_id = auth.uid()
));

create policy honey_progress_insert_guardian
on public.honey_mission_progress for insert to authenticated
with check (exists (
  select 1 from public.patients p
  where p.id = patient_id and p.guardian_id = auth.uid()
));

create policy honey_progress_update_guardian
on public.honey_mission_progress for update to authenticated
using (exists (
  select 1 from public.patients p
  where p.id = patient_id and p.guardian_id = auth.uid()
))
with check (exists (
  select 1 from public.patients p
  where p.id = patient_id and p.guardian_id = auth.uid()
));

grant select, insert, update on public.honey_mission_progress to authenticated;
