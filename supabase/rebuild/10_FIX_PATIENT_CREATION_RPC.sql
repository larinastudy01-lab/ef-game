-- Safe patient creation RPC. Fixes direct-insert RLS failures without weakening RLS.
begin;

create or replace function public.create_my_patient(
  patient_nickname text,
  patient_full_name text default null,
  patient_birth_date date default null,
  patient_gender text default null,
  patient_avatar text default null,
  patient_note text default null
)
returns public.patients
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  created_patient public.patients;
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = current_user_id and role in ('guardian', 'parent')
  ) then
    raise exception 'Only a guardian account may create a patient' using errcode = '42501';
  end if;
  if nullif(btrim(patient_nickname), '') is null then
    raise exception 'Patient nickname is required' using errcode = '22023';
  end if;
  if patient_birth_date is null or patient_birth_date > current_date then
    raise exception 'A valid birth date is required' using errcode = '22023';
  end if;

  insert into public.patients (
    guardian_id, nickname, full_name, birth_date, gender, avatar, note
  ) values (
    current_user_id,
    btrim(patient_nickname),
    nullif(btrim(coalesce(patient_full_name, '')), ''),
    patient_birth_date,
    nullif(btrim(coalesce(patient_gender, '')), ''),
    nullif(btrim(coalesce(patient_avatar, '')), ''),
    nullif(btrim(coalesce(patient_note, '')), '')
  )
  returning * into created_patient;

  return created_patient;
end;
$$;

revoke all on function public.create_my_patient(text, text, date, text, text, text) from public;
grant execute on function public.create_my_patient(text, text, date, text, text, text) to authenticated;

commit;

-- Verification: expect one row.
select routine_schema, routine_name
from information_schema.routines
where routine_schema = 'public' and routine_name = 'create_my_patient';
