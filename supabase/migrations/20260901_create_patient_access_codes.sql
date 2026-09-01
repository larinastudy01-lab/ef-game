-- One-time guardian-issued codes for granting a clinician access to one patient.
begin;

create table if not exists public.patient_access_codes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  guardian_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((consumed_at is null and consumed_by is null) or (consumed_at is not null and consumed_by is not null))
);

create table if not exists public.patient_access_code_attempts (
  id bigint generated always as identity primary key,
  clinician_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null default false
);

create index if not exists patient_access_codes_active_idx
  on public.patient_access_codes(patient_id, expires_at desc)
  where consumed_at is null;
create index if not exists patient_access_code_attempts_rate_idx
  on public.patient_access_code_attempts(clinician_id, attempted_at desc);

alter table public.patient_access_codes enable row level security;
alter table public.patient_access_code_attempts enable row level security;

drop policy if exists patient_access_codes_guardian_select on public.patient_access_codes;
create policy patient_access_codes_guardian_select
on public.patient_access_codes for select to authenticated
using (guardian_id = auth.uid() or public.is_admin());

grant select on public.patient_access_codes to authenticated;

create or replace function public.create_patient_access_code(target_patient_id uuid)
returns table(access_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  owner_id uuid;
  raw_code text;
  expiry timestamptz := now() + interval '7 days';
begin
  select guardian_id into owner_id from public.patients where id = target_patient_id;
  if owner_id is null or owner_id <> auth.uid() then
    raise exception 'Only the guardian may create an access code for this patient';
  end if;

  update public.patient_access_codes c
  set expires_at = now()
  where c.patient_id = target_patient_id and c.consumed_at is null and c.expires_at > now();

  raw_code := upper(encode(gen_random_bytes(6), 'hex'));
  insert into public.patient_access_codes (patient_id, guardian_id, code_hash, expires_at)
  values (target_patient_id, owner_id, crypt(raw_code, gen_salt('bf', 8)), expiry);

  return query select substring(raw_code from 1 for 6) || '-' || substring(raw_code from 7 for 6), expiry;
end;
$$;

create or replace function public.redeem_patient_access_code(provided_code text)
returns table(success boolean, patient_id uuid, patient_nickname text, message text)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  clinician_user_id uuid := auth.uid();
  normalized_code text := upper(regexp_replace(coalesce(provided_code, ''), '[^A-Fa-f0-9]', '', 'g'));
  code_row public.patient_access_codes;
  invite_id uuid;
  attempt_id bigint;
begin
  if clinician_user_id is null or not public.is_professional(clinician_user_id) then
    return query select false, null::uuid, null::text, '需要已核准的醫療帳號。';
    return;
  end if;

  insert into public.patient_access_code_attempts (clinician_id)
  values (clinician_user_id) returning id into attempt_id;

  if (select count(*) from public.patient_access_code_attempts
      where clinician_id = clinician_user_id and attempted_at > now() - interval '15 minutes') > 10 then
    return query select false, null::uuid, null::text, '嘗試次數過多，請 15 分鐘後再試。';
    return;
  end if;

  if length(normalized_code) <> 12 then
    return query select false, null::uuid, null::text, '授權碼格式不正確。';
    return;
  end if;

  select c.* into code_row
  from public.patient_access_codes c
  where c.consumed_at is null
    and c.expires_at > now()
    and c.code_hash = crypt(normalized_code, c.code_hash)
  order by c.created_at desc limit 1 for update;

  if not found then
    return query select false, null::uuid, null::text, '授權碼無效、已使用或已過期。';
    return;
  end if;

  if not exists (select 1 from public.clinician_patient_access a where a.clinician_id = clinician_user_id and a.patient_id = code_row.patient_id) then
    insert into public.clinician_access_invitations (
      clinician_id, guardian_id, patient_id, initiated_by, status,
      purpose, responded_at, response_note
    ) values (
      clinician_user_id, code_row.guardian_id, code_row.patient_id,
      code_row.guardian_id, 'accepted', 'guardian_one_time_access_code',
      now(), 'Guardian granted access using a one-time code'
    ) returning id into invite_id;

    insert into public.clinician_patient_access (clinician_id, patient_id)
    values (clinician_user_id, code_row.patient_id);

    insert into public.patient_access_consents (
      invitation_id, clinician_id, guardian_id, patient_id
    ) values (invite_id, clinician_user_id, code_row.guardian_id, code_row.patient_id);
  end if;

  update public.patient_access_codes
  set consumed_at = now(), consumed_by = clinician_user_id
  where id = code_row.id;
  update public.patient_access_code_attempts set succeeded = true where id = attempt_id;

  return query
  select true, p.id, p.nickname, '兒童已新增至你的醫療個案清單。'
  from public.patients p where p.id = code_row.patient_id;
end;
$$;

revoke all on function public.create_patient_access_code(uuid) from public;
revoke all on function public.redeem_patient_access_code(text) from public;
grant execute on function public.create_patient_access_code(uuid) to authenticated;
grant execute on function public.redeem_patient_access_code(text) to authenticated;

commit;
