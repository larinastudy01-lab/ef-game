-- Required by ClinicianDashboard.jsx and SettingsPage.jsx.
-- Safe to run after 01_CREATE_AUTH_PATIENTS_RESULTS.sql.
begin;

create table if not exists public.clinician_notes (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  note text not null check (length(btrim(note)) between 1 and 10000),
  created_at timestamptz not null default now()
);

create table if not exists public.parent_reminders (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  reminder_type text not null default 'custom',
  title text,
  message text not null check (length(btrim(message)) between 1 and 5000),
  status text not null default 'unread'
    check (status in ('unread', 'read', 'done')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (status = 'unread' or read_at is not null)
);

create index if not exists clinician_notes_patient_created_idx
  on public.clinician_notes(patient_id, created_at desc);
create index if not exists parent_reminders_patient_status_created_idx
  on public.parent_reminders(patient_id, status, created_at desc);

alter table public.clinician_notes enable row level security;
alter table public.parent_reminders enable row level security;

drop policy if exists clinician_notes_select_related on public.clinician_notes;
drop policy if exists clinician_notes_insert_assigned on public.clinician_notes;
create policy clinician_notes_select_related on public.clinician_notes
for select to authenticated
using (public.can_access_patient(patient_id));
create policy clinician_notes_insert_assigned on public.clinician_notes
for insert to authenticated
with check (
  clinician_id = auth.uid()
  and public.is_professional()
  and public.can_access_patient(patient_id)
);

drop policy if exists parent_reminders_select_related on public.parent_reminders;
drop policy if exists parent_reminders_insert_assigned on public.parent_reminders;
drop policy if exists parent_reminders_update_related on public.parent_reminders;
create policy parent_reminders_select_related on public.parent_reminders
for select to authenticated
using (public.can_access_patient(patient_id));
create policy parent_reminders_insert_assigned on public.parent_reminders
for insert to authenticated
with check (
  clinician_id = auth.uid()
  and public.is_professional()
  and public.can_access_patient(patient_id)
);
create policy parent_reminders_update_related on public.parent_reminders
for update to authenticated
using (public.can_access_patient(patient_id))
with check (public.can_access_patient(patient_id));

grant select, insert on public.clinician_notes to authenticated;
grant select, insert on public.parent_reminders to authenticated;
revoke update on public.parent_reminders from authenticated;
grant update (status, read_at) on public.parent_reminders to authenticated;

commit;

-- Verification: expect two rows with rls_enabled = true.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('clinician_notes', 'parent_reminders')
order by c.relname;
