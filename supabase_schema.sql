-- Supabase SQL Editor 直接貼上執行
-- 這份 schema 對應目前 React 專案：帳號 profiles、孩子 patients、遊戲結果 game_results

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'guardian' check (role in ('guardian', 'parent', 'clinician', 'medical', 'doctor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null,
  birth_date date,
  gender text,
  avatar text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_results (
  id text primary key,
  patient_id uuid not null references public.patients(id) on delete cascade,
  guardian_id uuid not null references auth.users(id) on delete cascade,
  game_id text,
  game_name text,
  mode text check (mode in ('test', 'training')),
  difficulty text,
  score numeric default 0,
  stars int default 0,
  accuracy numeric default 0,
  avg_reaction_time numeric default 0,
  total_trials int default 0,
  correct_count int default 0,
  error_count int default 0,
  started_at timestamptz,
  finished_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_patients_guardian_id on public.patients(guardian_id);
create index if not exists idx_game_results_patient_id on public.game_results(patient_id);
create index if not exists idx_game_results_guardian_id on public.game_results(guardian_id);
create index if not exists idx_game_results_finished_at on public.game_results(finished_at desc);

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.game_results enable row level security;

-- profiles：使用者只能管理自己的 profile；醫療端可讀基本 profile 資料
create policy "profiles_select_own_or_clinician"
on public.profiles for select
using (
  auth.uid() = id
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('clinician', 'medical', 'doctor')
  )
);

create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- patients：家長只能管理自己的孩子；醫療端可讀取全部孩子資料
create policy "patients_select_owner_or_clinician"
on public.patients for select
using (
  guardian_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('clinician', 'medical', 'doctor')
  )
);

create policy "patients_insert_owner"
on public.patients for insert
with check (guardian_id = auth.uid());

create policy "patients_update_owner"
on public.patients for update
using (guardian_id = auth.uid())
with check (guardian_id = auth.uid());

create policy "patients_delete_owner"
on public.patients for delete
using (guardian_id = auth.uid());

-- game_results：家長管理自己孩子的結果；醫療端可讀全部結果
create policy "game_results_select_owner_or_clinician"
on public.game_results for select
using (
  guardian_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('clinician', 'medical', 'doctor')
  )
);

create policy "game_results_insert_owner"
on public.game_results for insert
with check (guardian_id = auth.uid());

create policy "game_results_update_owner"
on public.game_results for update
using (guardian_id = auth.uid())
with check (guardian_id = auth.uid());

create policy "game_results_delete_owner"
on public.game_results for delete
using (guardian_id = auth.uid());


-- 醫療端授權、備註與提醒
create table if not exists public.clinician_patient_access (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (clinician_id, patient_id)
);

create table if not exists public.clinician_notes (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.parent_reminders (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  reminder_type text,
  message text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.clinician_patient_access enable row level security;
alter table public.clinician_notes enable row level security;
alter table public.parent_reminders enable row level security;

create policy "clinician_access_select_related"
on public.clinician_patient_access for select
using (
  clinician_id = auth.uid()
  or exists (
    select 1 from public.patients pa
    where pa.id = clinician_patient_access.patient_id
      and pa.guardian_id = auth.uid()
  )
);

create policy "clinician_access_insert_clinician"
on public.clinician_patient_access for insert
with check (
  clinician_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('clinician', 'medical', 'doctor')
  )
);

create policy "clinician_access_delete_clinician"
on public.clinician_patient_access for delete
using (clinician_id = auth.uid());

create policy "clinician_notes_select_related"
on public.clinician_notes for select
using (
  clinician_id = auth.uid()
  or exists (
    select 1 from public.patients pa
    where pa.id = clinician_notes.patient_id
      and pa.guardian_id = auth.uid()
  )
);

create policy "clinician_notes_insert_clinician"
on public.clinician_notes for insert
with check (
  clinician_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('clinician', 'medical', 'doctor')
  )
);

create policy "parent_reminders_select_related"
on public.parent_reminders for select
using (
  clinician_id = auth.uid()
  or exists (
    select 1 from public.patients pa
    where pa.id = parent_reminders.patient_id
      and pa.guardian_id = auth.uid()
  )
);

create policy "parent_reminders_insert_clinician"
on public.parent_reminders for insert
with check (
  clinician_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('clinician', 'medical', 'doctor')
  )
);

-- 註冊後自動建立 profile，避免 Email 驗證開啟時前端無法立刻寫入 profiles。
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'guardian')
  )
  on conflict (id) do update
  set email = excluded.email,
      role = excluded.role,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();
