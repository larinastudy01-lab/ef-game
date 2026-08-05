-- Allows an authenticated clinician to create a child for an existing guardian
-- and links that child to the clinician in one transaction.
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
set search_path = public
as $$
declare
  v_clinician_id uuid := auth.uid();
  v_guardian_id uuid;
  v_patient_id uuid;
begin
  if v_clinician_id is null then
    raise exception '請先登入醫療端帳號。';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_clinician_id
      and lower(coalesce(role, '')) in ('clinician', 'medical', 'doctor', '醫療人員')
  ) then
    raise exception '目前帳號沒有醫療人員權限。';
  end if;

  if nullif(trim(p_guardian_email), '') is null then
    raise exception '請輸入家長 Email。';
  end if;

  if nullif(trim(p_nickname), '') is null then
    raise exception '請輸入孩子暱稱。';
  end if;

  if p_birth_date is null or p_birth_date > current_date then
    raise exception '請輸入有效的孩子生日。';
  end if;

  select id into v_guardian_id
  from public.profiles
  where lower(email) = lower(trim(p_guardian_email))
    and lower(coalesce(role, '')) in ('guardian', 'parent')
  limit 1;

  if v_guardian_id is null then
    raise exception '找不到此家長帳號，請先讓家長完成註冊。';
  end if;

  insert into public.patients (
    guardian_id,
    nickname,
    full_name,
    birth_date,
    gender
  ) values (
    v_guardian_id,
    trim(p_nickname),
    nullif(trim(coalesce(p_full_name, '')), ''),
    p_birth_date,
    nullif(trim(coalesce(p_gender, '')), '')
  )
  returning id into v_patient_id;

  insert into public.clinician_patient_access (clinician_id, patient_id)
  values (v_clinician_id, v_patient_id);

  return v_patient_id;
end;
$$;

revoke all on function public.clinician_create_patient(text, text, text, date, text) from public;
grant execute on function public.clinician_create_patient(text, text, text, date, text) to authenticated;
