-- Guardian consent workflow for clinician access to patient data.
-- Run after 07_CREATE_CLINICIAN_APPLICATIONS.sql.
begin;

create table if not exists public.clinician_access_invitations (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references auth.users(id) on delete cascade,
  guardian_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  initiated_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  purpose text not null default 'clinical_follow_up'
    check (length(btrim(purpose)) between 3 and 500),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  responded_at timestamptz,
  response_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > requested_at),
  check (
    (status = 'pending' and responded_at is null)
    or (status <> 'pending' and responded_at is not null)
  )
);

create table if not exists public.patient_access_consents (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.clinician_access_invitations(id) on delete restrict,
  clinician_id uuid not null references auth.users(id) on delete restrict,
  guardian_id uuid not null references auth.users(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete cascade,
  consent_status text not null default 'granted'
    check (consent_status in ('granted', 'revoked')),
  consent_scope text[] not null default array[
    'patient_profile', 'game_results', 'clinical_notes', 'research_views'
  ]::text[],
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (consent_status = 'granted' and revoked_at is null and revoked_by is null)
    or (consent_status = 'revoked' and revoked_at is not null and revoked_by is not null)
  )
);

create unique index if not exists clinician_access_one_pending_idx
  on public.clinician_access_invitations(clinician_id, patient_id)
  where status = 'pending';
create index if not exists clinician_access_invites_guardian_idx
  on public.clinician_access_invitations(guardian_id, status, requested_at desc);
create index if not exists clinician_access_invites_clinician_idx
  on public.clinician_access_invitations(clinician_id, status, requested_at desc);
create index if not exists patient_access_consents_patient_idx
  on public.patient_access_consents(patient_id, consent_status, granted_at desc);

drop trigger if exists clinician_access_invitations_set_updated_at on public.clinician_access_invitations;
create trigger clinician_access_invitations_set_updated_at
before update on public.clinician_access_invitations
for each row execute function public.set_updated_at();
drop trigger if exists patient_access_consents_set_updated_at on public.patient_access_consents;
create trigger patient_access_consents_set_updated_at
before update on public.patient_access_consents
for each row execute function public.set_updated_at();

alter table public.clinician_access_invitations enable row level security;
alter table public.patient_access_consents enable row level security;

drop policy if exists access_invitations_select_related on public.clinician_access_invitations;
create policy access_invitations_select_related
on public.clinician_access_invitations for select to authenticated
using (
  guardian_id = auth.uid()
  or clinician_id = auth.uid()
  or public.is_admin()
);

drop policy if exists access_consents_select_related on public.patient_access_consents;
create policy access_consents_select_related
on public.patient_access_consents for select to authenticated
using (
  guardian_id = auth.uid()
  or clinician_id = auth.uid()
  or public.is_admin()
);

grant select on public.clinician_access_invitations to authenticated;
grant select on public.patient_access_consents to authenticated;

-- Clinician requests access for an existing patient belonging to the supplied guardian.
create or replace function public.request_patient_access(
  target_patient_id uuid,
  guardian_email text,
  access_purpose text default 'clinical_follow_up'
)
returns public.clinician_access_invitations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  clinician_user_id uuid := auth.uid();
  guardian_user_id uuid;
  invitation_row public.clinician_access_invitations;
begin
  if clinician_user_id is null or not public.is_professional(clinician_user_id) then
    raise exception 'An approved professional account is required';
  end if;
  if nullif(btrim(guardian_email), '') is null then
    raise exception 'Guardian email is required';
  end if;

  select p.guardian_id into guardian_user_id
  from public.patients p
  join public.profiles gp on gp.id = p.guardian_id
  where p.id = target_patient_id
    and lower(gp.email) = lower(btrim(guardian_email));
  if guardian_user_id is null then
    raise exception 'Patient and guardian could not be matched';
  end if;
  if exists (
    select 1 from public.clinician_patient_access a
    where a.clinician_id = clinician_user_id and a.patient_id = target_patient_id
  ) then
    raise exception 'Access has already been granted';
  end if;

  insert into public.clinician_access_invitations (
    clinician_id, guardian_id, patient_id, initiated_by, purpose
  ) values (
    clinician_user_id, guardian_user_id, target_patient_id,
    clinician_user_id, btrim(access_purpose)
  )
  returning * into invitation_row;
  return invitation_row;
end;
$$;

-- Guardian accepts or rejects a pending request. Acceptance atomically grants access.
create or replace function public.respond_to_access_invitation(
  target_invitation_id uuid,
  response text,
  note text default null
)
returns public.clinician_access_invitations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invitation_row public.clinician_access_invitations;
  normalized_response text := lower(btrim(response));
begin
  if normalized_response not in ('accepted', 'rejected') then
    raise exception 'Response must be accepted or rejected';
  end if;

  select * into invitation_row
  from public.clinician_access_invitations
  where id = target_invitation_id
  for update;
  if not found or invitation_row.guardian_id <> auth.uid() then
    raise exception 'Invitation was not found';
  end if;
  if invitation_row.status <> 'pending' then
    raise exception 'Invitation has already been resolved';
  end if;
  if invitation_row.expires_at <= now() then
    update public.clinician_access_invitations
    set status = 'expired', responded_at = now()
    where id = invitation_row.id
    returning * into invitation_row;
    return invitation_row;
  end if;

  update public.clinician_access_invitations
  set status = normalized_response,
      responded_at = now(),
      response_note = nullif(btrim(coalesce(note, '')), '')
  where id = invitation_row.id
  returning * into invitation_row;

  if normalized_response = 'accepted' then
    insert into public.clinician_patient_access (clinician_id, patient_id)
    values (invitation_row.clinician_id, invitation_row.patient_id)
    on conflict (clinician_id, patient_id) do nothing;

    insert into public.patient_access_consents (
      invitation_id, clinician_id, guardian_id, patient_id
    ) values (
      invitation_row.id, invitation_row.clinician_id,
      invitation_row.guardian_id, invitation_row.patient_id
    );
  end if;

  return invitation_row;
end;
$$;

-- Guardian revokes previously granted access.
create or replace function public.revoke_patient_access(
  target_patient_id uuid,
  target_clinician_id uuid,
  reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  guardian_user_id uuid;
  access_was_deleted boolean := false;
begin
  select guardian_id into guardian_user_id
  from public.patients where id = target_patient_id;
  if guardian_user_id is null or guardian_user_id <> auth.uid() then
    raise exception 'Only the guardian may revoke access';
  end if;

  delete from public.clinician_patient_access
  where patient_id = target_patient_id and clinician_id = target_clinician_id;
  access_was_deleted := found;

  update public.patient_access_consents
  set consent_status = 'revoked',
      revoked_at = now(),
      revoked_by = auth.uid(),
      revocation_reason = nullif(btrim(coalesce(reason, '')), '')
  where patient_id = target_patient_id
    and clinician_id = target_clinician_id
    and consent_status = 'granted';

  return access_was_deleted or found;
end;
$$;

-- Replace the earlier workflow: creating a patient now creates a pending request,
-- not immediate clinician access.
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
  clinician_user_id uuid := auth.uid();
  guardian_user_id uuid;
  new_patient_id uuid;
begin
  if clinician_user_id is null or not public.is_professional(clinician_user_id) then
    raise exception 'An approved professional account is required';
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

  select id into guardian_user_id
  from public.profiles
  where lower(email) = lower(btrim(p_guardian_email))
    and role in ('guardian', 'parent')
  order by created_at limit 1;
  if guardian_user_id is null then
    raise exception 'No guardian account matches that email';
  end if;

  insert into public.patients (guardian_id, nickname, full_name, birth_date, gender)
  values (
    guardian_user_id, btrim(p_nickname),
    nullif(btrim(coalesce(p_full_name, '')), ''), p_birth_date,
    nullif(btrim(coalesce(p_gender, '')), '')
  ) returning id into new_patient_id;

  insert into public.clinician_access_invitations (
    clinician_id, guardian_id, patient_id, initiated_by,
    purpose
  ) values (
    clinician_user_id, guardian_user_id, new_patient_id,
    clinician_user_id, 'new_patient_created_by_clinician'
  );

  return new_patient_id;
end;
$$;

revoke all on function public.request_patient_access(uuid, text, text) from public;
revoke all on function public.respond_to_access_invitation(uuid, text, text) from public;
revoke all on function public.revoke_patient_access(uuid, uuid, text) from public;
revoke all on function public.clinician_create_patient(text, text, text, date, text) from public;
grant execute on function public.request_patient_access(uuid, text, text) to authenticated;
grant execute on function public.respond_to_access_invitation(uuid, text, text) to authenticated;
grant execute on function public.revoke_patient_access(uuid, uuid, text) to authenticated;
grant execute on function public.clinician_create_patient(text, text, text, date, text) to authenticated;

commit;

-- Verification: expect two RLS-enabled tables and four functions.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('clinician_access_invitations', 'patient_access_consents')
order by c.relname;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'request_patient_access', 'respond_to_access_invitation',
    'revoke_patient_access', 'clinician_create_patient'
  )
order by routine_name;
