-- Atomically create or return the de-identified participant used by the
-- adaptive recommendation service. The caller must own the patient record.
create or replace function public.ensure_research_participant(target_patient_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  participant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.patients p
    where p.id = target_patient_id
      and p.guardian_id = auth.uid()
  ) then
    raise exception 'Patient is not owned by the authenticated guardian'
      using errcode = '42501';
  end if;

  insert into public.research_participants (patient_id)
  values (target_patient_id)
  on conflict (patient_id) do update
    set updated_at = public.research_participants.updated_at
  returning id into participant_id;

  return participant_id;
end;
$$;

revoke all on function public.ensure_research_participant(uuid) from public;
grant execute on function public.ensure_research_participant(uuid) to authenticated;

comment on function public.ensure_research_participant(uuid) is
  'Returns the de-identified participant for a guardian-owned patient, creating it atomically when needed.';
