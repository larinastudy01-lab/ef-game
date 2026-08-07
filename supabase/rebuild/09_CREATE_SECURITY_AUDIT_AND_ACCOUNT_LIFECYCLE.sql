-- Immutable security audit, verification history and clinician account lifecycle.
-- Run after 08_CREATE_ACCESS_CONSENT.sql.
begin;

alter table public.clinician_applications
  add column if not exists verification_expires_at timestamptz;

create table if not exists public.security_audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text,
  event_type text not null,
  target_table text not null,
  target_record_id text,
  old_data jsonb,
  new_data jsonb,
  request_id text,
  created_at timestamptz not null default now()
);
comment on table public.security_audit_logs is
  'Append-only audit metadata. Sensitive identity, licence and document fields are redacted.';

create table if not exists public.clinician_verification_history (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.clinician_applications(id) on delete restrict,
  clinician_user_id uuid not null references auth.users(id) on delete restrict,
  previous_status text,
  new_status text not null,
  reviewer_id uuid references auth.users(id) on delete set null,
  verification_source text,
  verification_checked_at timestamptz,
  verification_expires_at timestamptz,
  review_note text,
  recorded_at timestamptz not null default now()
);

create index if not exists security_audit_logs_time_idx
  on public.security_audit_logs(occurred_at desc);
create index if not exists security_audit_logs_target_idx
  on public.security_audit_logs(target_table, target_record_id, occurred_at desc);
create index if not exists security_audit_logs_actor_idx
  on public.security_audit_logs(actor_id, occurred_at desc);
create index if not exists clinician_verification_history_application_idx
  on public.clinician_verification_history(application_id, recorded_at desc);
create index if not exists clinician_verification_history_user_idx
  on public.clinician_verification_history(clinician_user_id, recorded_at desc);

alter table public.security_audit_logs enable row level security;
alter table public.clinician_verification_history enable row level security;

drop policy if exists security_audit_select_admin on public.security_audit_logs;
create policy security_audit_select_admin
on public.security_audit_logs for select to authenticated
using (public.is_admin());

drop policy if exists verification_history_select_own_or_admin on public.clinician_verification_history;
create policy verification_history_select_own_or_admin
on public.clinician_verification_history for select to authenticated
using (clinician_user_id = auth.uid() or public.is_admin());

grant select on public.security_audit_logs to authenticated;
grant select on public.clinician_verification_history to authenticated;

-- Remove fields that should not be duplicated into audit storage.
create or replace function public.redact_audit_data(source_data jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select case when source_data is null then null else
    source_data
      - 'email'
      - 'full_name'
      - 'legal_name'
      - 'license_number'
      - 'institutional_email'
      - 'institution_phone'
      - 'verification_document_path'
      - 'review_note'
      - 'response_note'
      - 'revocation_reason'
  end;
$$;

create or replace function public.write_security_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  record_id text := coalesce(new_row ->> 'id', old_row ->> 'id');
  current_actor_role text;
begin
  select role into current_actor_role from public.profiles where id = auth.uid();

  insert into public.security_audit_logs (
    actor_id, actor_role, event_type, target_table, target_record_id,
    old_data, new_data, request_id
  ) values (
    auth.uid(), current_actor_role, lower(tg_op), tg_table_schema || '.' || tg_table_name,
    record_id, public.redact_audit_data(old_row), public.redact_audit_data(new_row),
    null
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.record_clinician_verification_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from new.status then
    insert into public.clinician_verification_history (
      application_id, clinician_user_id, previous_status, new_status,
      reviewer_id, verification_source, verification_checked_at,
      verification_expires_at, review_note
    ) values (
      new.id, new.user_id, old.status, new.status, new.reviewed_by,
      new.verification_source, new.verification_checked_at,
      new.verification_expires_at, new.review_note
    );
  end if;
  return new;
end;
$$;

create or replace function public.set_clinician_verification_expiry()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'approved' and (
    old.status is distinct from 'approved' or new.verification_expires_at is null
  ) then
    new.verification_expires_at := coalesce(new.verification_checked_at, now()) + interval '1 year';
  elsif new.status in ('suspended', 'expired', 'rejected') then
    new.verification_expires_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists clinician_applications_set_expiry on public.clinician_applications;
create trigger clinician_applications_set_expiry
before update on public.clinician_applications
for each row execute function public.set_clinician_verification_expiry();
drop trigger if exists clinician_applications_verification_history on public.clinician_applications;
create trigger clinician_applications_verification_history
after update on public.clinician_applications
for each row execute function public.record_clinician_verification_history();

-- Attach append-only audit triggers to security-sensitive tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'clinician_applications', 'clinician_patient_access',
    'clinician_access_invitations', 'patient_access_consents'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      table_name || '_security_audit', table_name
    );
    execute format(
      'create trigger %I after insert or update or delete on public.%I '
      || 'for each row execute function public.write_security_audit_log()',
      table_name || '_security_audit', table_name
    );
  end loop;
end;
$$;

-- Admin suspends, expires or reactivates an approved clinician. Reactivation
-- never restores patient access; guardians must consent again.
create or replace function public.set_clinician_account_status(
  target_user_id uuid,
  account_action text,
  admin_note text default null,
  checked_source text default 'MOHW medical personnel directory'
)
returns public.clinician_applications
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  normalized_action text := lower(btrim(account_action));
  application_row public.clinician_applications;
  confirmed boolean;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Administrator permission is required';
  end if;
  if normalized_action not in ('suspended', 'expired', 'reactivated') then
    raise exception 'Action must be suspended, expired, or reactivated';
  end if;

  select * into application_row
  from public.clinician_applications
  where user_id = target_user_id
  for update;
  if not found then
    raise exception 'Clinician application was not found';
  end if;

  if normalized_action = 'reactivated' then
    if application_row.status not in ('suspended', 'expired') then
      raise exception 'Only suspended or expired accounts may be reactivated';
    end if;
    select email_confirmed_at is not null into confirmed
    from auth.users where id = target_user_id;
    if not coalesce(confirmed, false) then
      raise exception 'The account email is not confirmed';
    end if;

    update public.clinician_applications
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
        verification_source = checked_source, verification_checked_at = now(),
        review_note = nullif(btrim(coalesce(admin_note, '')), '')
    where id = application_row.id
    returning * into application_row;

    update public.profiles set role = 'clinician', updated_at = now()
    where id = target_user_id;
  else
    update public.clinician_applications
    set status = normalized_action, reviewed_by = auth.uid(), reviewed_at = now(),
        review_note = nullif(btrim(coalesce(admin_note, '')), '')
    where id = application_row.id
    returning * into application_row;

    update public.profiles set role = 'clinician_applicant', updated_at = now()
    where id = target_user_id;

    delete from public.clinician_patient_access where clinician_id = target_user_id;
    update public.patient_access_consents
    set consent_status = 'revoked', revoked_at = now(), revoked_by = auth.uid(),
        revocation_reason = coalesce(nullif(btrim(admin_note), ''), 'Professional access disabled')
    where clinician_id = target_user_id and consent_status = 'granted';
    update public.clinician_access_invitations
    set status = 'cancelled', responded_at = now(),
        response_note = 'Professional access disabled'
    where clinician_id = target_user_id and status = 'pending';
  end if;

  return application_row;
end;
$$;

-- Admin maintenance job: expire approvals whose annual verification has lapsed.
create or replace function public.expire_due_clinician_verifications()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target record;
  expired_count integer := 0;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Administrator permission is required';
  end if;

  for target in
    select user_id from public.clinician_applications
    where status = 'approved' and verification_expires_at <= now()
    for update skip locked
  loop
    perform public.set_clinician_account_status(
      target.user_id, 'expired', 'Annual professional verification expired'
    );
    expired_count := expired_count + 1;
  end loop;
  return expired_count;
end;
$$;

revoke all on function public.redact_audit_data(jsonb) from public;
revoke all on function public.set_clinician_account_status(uuid, text, text, text) from public;
revoke all on function public.expire_due_clinician_verifications() from public;
grant execute on function public.set_clinician_account_status(uuid, text, text, text) to authenticated;
grant execute on function public.expire_due_clinician_verifications() to authenticated;

commit;

-- Verification: expect two RLS-enabled tables and two lifecycle functions.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('security_audit_logs', 'clinician_verification_history')
order by c.relname;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('set_clinician_account_status', 'expire_due_clinician_verifications')
order by routine_name;
