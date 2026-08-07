-- Clean core schema for registration, login, patients and game results.
-- Run after 00_RESET_PUBLIC_APP.sql as the postgres role.
begin;

create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'guardian'
    check (role in ('guardian', 'parent', 'clinician', 'medical', 'doctor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (length(btrim(nickname)) between 1 and 50),
  full_name text,
  birth_date date check (birth_date is null or birth_date <= current_date),
  gender text,
  avatar text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinician_patient_access (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (clinician_id, patient_id)
);

create table public.game_results (
  id text primary key,
  patient_id uuid not null references public.patients(id) on delete cascade,
  guardian_id uuid not null references auth.users(id) on delete cascade,
  game_id text,
  game_name text,
  mode text check (mode is null or mode in ('test', 'training')),
  difficulty text,
  score numeric not null default 0,
  stars integer not null default 0 check (stars >= 0),
  accuracy numeric not null default 0 check (accuracy >= 0 and accuracy <= 100),
  avg_reaction_time numeric not null default 0 check (avg_reaction_time >= 0),
  total_trials integer not null default 0 check (total_trials >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  started_at timestamptz,
  finished_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (started_at is null or finished_at >= started_at),
  check (correct_count <= total_trials),
  check (error_count <= total_trials)
);

create index patients_guardian_created_idx
  on public.patients(guardian_id, created_at desc);
create index clinician_access_patient_idx
  on public.clinician_patient_access(patient_id, clinician_id);
create index game_results_patient_finished_idx
  on public.game_results(patient_id, finished_at desc);
create index game_results_guardian_finished_idx
  on public.game_results(guardian_id, finished_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
create trigger patients_set_updated_at
before update on public.patients
for each row execute function public.set_updated_at();

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception 'Profile role changes require an administrator';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
before update of role on public.profiles
for each row execute function public.prevent_profile_role_escalation();

-- New public registrations are always guardians. Professional roles must be
-- assigned by an administrator, never trusted from sign-up metadata.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    'guardian'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_user_profile();

-- Recreate profiles for auth accounts intentionally preserved by the reset.
insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
  'guardian'
from auth.users u
on conflict (id) do nothing;

create or replace function public.is_professional(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = target_user_id
      and role in ('clinician', 'medical', 'doctor')
  );
$$;

create or replace function public.can_access_patient(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.patients p
    where p.id = target_patient_id
      and (
        p.guardian_id = auth.uid()
        or exists (
          select 1 from public.clinician_patient_access a
          where a.patient_id = p.id and a.clinician_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.is_professional(uuid) from public;
revoke all on function public.can_access_patient(uuid) from public;
grant execute on function public.is_professional(uuid) to authenticated;
grant execute on function public.can_access_patient(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.clinician_patient_access enable row level security;
alter table public.game_results enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated using (id = auth.uid());
create policy profiles_insert_guardian on public.profiles
for insert to authenticated
with check (id = auth.uid() and role in ('guardian', 'parent'));
create policy profiles_update_own on public.profiles
for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy patients_select_related on public.patients
for select to authenticated using (public.can_access_patient(id));
create policy patients_insert_guardian on public.patients
for insert to authenticated with check (guardian_id = auth.uid());
create policy patients_update_guardian on public.patients
for update to authenticated
using (guardian_id = auth.uid()) with check (guardian_id = auth.uid());
create policy patients_delete_guardian on public.patients
for delete to authenticated using (guardian_id = auth.uid());

create policy clinician_access_select_related on public.clinician_patient_access
for select to authenticated
using (clinician_id = auth.uid() or public.can_access_patient(patient_id));
create policy game_results_select_related on public.game_results
for select to authenticated using (public.can_access_patient(patient_id));
create policy game_results_insert_guardian on public.game_results
for insert to authenticated
with check (
  guardian_id = auth.uid()
  and exists (
    select 1 from public.patients p
    where p.id = patient_id and p.guardian_id = auth.uid()
  )
);
create policy game_results_update_guardian on public.game_results
for update to authenticated
using (guardian_id = auth.uid())
with check (
  guardian_id = auth.uid()
  and exists (
    select 1 from public.patients p
    where p.id = patient_id and p.guardian_id = auth.uid()
  )
);
create policy game_results_delete_guardian on public.game_results
for delete to authenticated using (guardian_id = auth.uid());

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.patients to authenticated;
grant select on public.clinician_patient_access to authenticated;
grant select, insert, update, delete on public.game_results to authenticated;

-- A clinician can create a patient only for an existing guardian and receives
-- access to that patient in the same transaction.
create or replace function public.clinician_create_patient(
  p_guardian_email text,
  p_nickname text,
  p_full_name text default null,
  p_birth_date date default null,
  p_gender text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clinician_id uuid := auth.uid();
  v_guardian_id uuid;
  v_patient_id uuid;
begin
  if v_clinician_id is null or not public.is_professional(v_clinician_id) then
    raise exception 'An authorized professional account is required';
  end if;
  if nullif(btrim(p_guardian_email), '') is null then
    raise exception 'Guardian email is required';
  end if;
  if nullif(btrim(p_nickname), '') is null then
    raise exception 'Patient nickname is required';
  end if;
  if p_birth_date is null or p_birth_date > current_date then
    raise exception 'A valid birth date is required';
  end if;

  select id into v_guardian_id
  from public.profiles
  where lower(email) = lower(btrim(p_guardian_email))
    and role in ('guardian', 'parent')
  order by created_at
  limit 1;

  if v_guardian_id is null then
    raise exception 'No guardian account matches that email';
  end if;

  insert into public.patients (guardian_id, nickname, full_name, birth_date, gender)
  values (
    v_guardian_id,
    btrim(p_nickname),
    nullif(btrim(coalesce(p_full_name, '')), ''),
    p_birth_date,
    nullif(btrim(coalesce(p_gender, '')), '')
  )
  returning id into v_patient_id;

  insert into public.clinician_patient_access (clinician_id, patient_id)
  values (v_clinician_id, v_patient_id);

  return v_patient_id;
end;
$$;

revoke all on function public.clinician_create_patient(text, text, text, date, text) from public;
grant execute on function public.clinician_create_patient(text, text, text, date, text) to authenticated;

commit;
