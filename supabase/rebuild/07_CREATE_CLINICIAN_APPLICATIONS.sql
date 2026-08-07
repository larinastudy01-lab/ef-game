-- Clinician self-registration and administrator review workflow.
-- Authentication remains in Supabase Auth. Pending applicants have no patient access.
begin;

-- Extend the profile roles without weakening existing professional checks.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in (
    'guardian', 'parent', 'clinician', 'medical', 'doctor',
    'clinician_applicant', 'admin'
  ));

create or replace function public.is_admin(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = target_user_id and role = 'admin'
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

-- Preserve the no-self-promotion rule while allowing the controlled admin RPC.
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null
     and not public.is_admin(auth.uid())
     and new.role is distinct from old.role then
    raise exception 'Profile role changes require an administrator';
  end if;
  return new;
end;
$$;

-- Public metadata may request an application, but can never grant a professional role.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_type text := lower(coalesce(
    new.raw_user_meta_data ->> 'account_type',
    new.raw_user_meta_data ->> 'role',
    'guardian'
  ));
  safe_role text;
begin
  safe_role := case
    when requested_type in (
      'clinician', 'medical', 'doctor', 'professional', 'clinician_applicant'
    ) then 'clinician_applicant'
    else 'guardian'
  end;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    safe_role
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      updated_at = now();

  return new;
end;
$$;

create table if not exists public.clinician_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  legal_name text not null check (length(btrim(legal_name)) between 2 and 100),
  profession_type text not null check (profession_type in (
    'physician',
    'clinical_psychologist',
    'occupational_therapist',
    'physical_therapist',
    'speech_therapist',
    'nurse',
    'other'
  )),
  profession_type_other text,
  practice_city text not null check (length(btrim(practice_city)) between 2 and 50),
  institution_name text not null check (length(btrim(institution_name)) between 2 and 200),
  department text,
  license_number text,
  institutional_email text,
  institution_phone text,
  verification_document_path text,
  status text not null default 'pending' check (status in (
    'pending', 'needs_more_info', 'approved', 'rejected', 'suspended', 'expired'
  )),
  applicant_declaration boolean not null default false
    check (applicant_declaration),
  privacy_consent_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  verification_source text,
  verification_checked_at timestamptz,
  review_note text,
  check (profession_type <> 'other' or nullif(btrim(profession_type_other), '') is not null),
  check (institutional_email is null or institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
  check (
    (status in ('pending', 'needs_more_info') and reviewed_at is null)
    or (status in ('approved', 'rejected', 'suspended', 'expired') and reviewed_at is not null)
  )
);

comment on table public.clinician_applications is
  'Professional-access applications. Approval requires manual verification; never grants access on insert.';
comment on column public.clinician_applications.verification_document_path is
  'Private Storage object path only; never store a public URL.';

create index if not exists clinician_applications_status_submitted_idx
  on public.clinician_applications(status, submitted_at);
create index if not exists clinician_applications_reviewer_idx
  on public.clinician_applications(reviewed_by, reviewed_at desc);

drop trigger if exists clinician_applications_set_updated_at on public.clinician_applications;
create trigger clinician_applications_set_updated_at
before update on public.clinician_applications
for each row execute function public.set_updated_at();

alter table public.clinician_applications enable row level security;

drop policy if exists clinician_applications_select_own_or_admin on public.clinician_applications;
drop policy if exists clinician_applications_insert_own on public.clinician_applications;
drop policy if exists clinician_applications_update_own_pending on public.clinician_applications;
create policy clinician_applications_select_own_or_admin
on public.clinician_applications for select to authenticated
using (user_id = auth.uid() or public.is_admin());
create policy clinician_applications_insert_own
on public.clinician_applications for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'clinician_applicant'
  )
);
create policy clinician_applications_update_own_pending
on public.clinician_applications for update to authenticated
using (user_id = auth.uid() and status in ('pending', 'needs_more_info'))
with check (user_id = auth.uid() and status in ('pending', 'needs_more_info'));

grant select, insert on public.clinician_applications to authenticated;
revoke update on public.clinician_applications from authenticated;
grant update (
  legal_name, profession_type, profession_type_other, practice_city,
  institution_name, department, license_number, institutional_email,
  institution_phone, verification_document_path, applicant_declaration,
  privacy_consent_at
) on public.clinician_applications to authenticated;

-- One transaction records the review and changes the account role.
create or replace function public.review_clinician_application(
  target_application_id uuid,
  decision text,
  reviewer_note text default null,
  checked_source text default 'MOHW medical personnel directory'
)
returns public.clinician_applications
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  application_row public.clinician_applications;
  normalized_decision text := lower(btrim(decision));
  email_is_confirmed boolean;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Administrator permission is required';
  end if;
  if normalized_decision not in ('approved', 'rejected', 'needs_more_info') then
    raise exception 'Decision must be approved, rejected, or needs_more_info';
  end if;

  select * into application_row
  from public.clinician_applications
  where id = target_application_id
  for update;
  if not found then
    raise exception 'Clinician application was not found';
  end if;
  if application_row.status not in ('pending', 'needs_more_info') then
    raise exception 'This application has already been finalized';
  end if;

  if normalized_decision = 'approved' then
    select email_confirmed_at is not null into email_is_confirmed
    from auth.users where id = application_row.user_id;
    if not coalesce(email_is_confirmed, false) then
      raise exception 'The applicant must confirm their email before approval';
    end if;
  end if;

  update public.clinician_applications
  set status = normalized_decision,
      reviewed_by = case when normalized_decision = 'needs_more_info' then null else auth.uid() end,
      reviewed_at = case when normalized_decision = 'needs_more_info' then null else now() end,
      verification_source = checked_source,
      verification_checked_at = now(),
      review_note = nullif(btrim(coalesce(reviewer_note, '')), '')
  where id = target_application_id
  returning * into application_row;

  update public.profiles
  set role = case when normalized_decision = 'approved' then 'clinician' else 'clinician_applicant' end,
      full_name = coalesce(nullif(btrim(application_row.legal_name), ''), full_name),
      updated_at = now()
  where id = application_row.user_id;

  return application_row;
end;
$$;

revoke all on function public.review_clinician_application(uuid, text, text, text) from public;
grant execute on function public.review_clinician_application(uuid, text, text, text) to authenticated;

-- Private proof-document bucket. Files must live under <user-id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinician-verification',
  'clinician-verification',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists clinician_verification_insert_own on storage.objects;
drop policy if exists clinician_verification_select_own_or_admin on storage.objects;
drop policy if exists clinician_verification_update_own on storage.objects;
drop policy if exists clinician_verification_delete_own on storage.objects;
create policy clinician_verification_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'clinician-verification'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy clinician_verification_select_own_or_admin
on storage.objects for select to authenticated
using (
  bucket_id = 'clinician-verification'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
create policy clinician_verification_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'clinician-verification'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'clinician-verification'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy clinician_verification_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'clinician-verification'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;

-- Verification: expect one table with RLS enabled, one private bucket and two functions.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'clinician_applications';

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'clinician-verification';

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('is_admin', 'review_clinician_application')
order by routine_name;
