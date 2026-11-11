-- DRAFT; isolated only. Restores the observed prior policy, including its known
-- fresh-insert RETURNING limitation. No data deletion; no authorization expansion.
begin;
set local lock_timeout='5s';
do $p0c2$
begin
  if current_setting('p0b.environment',true) is distinct from 'isolated'
    or coalesce(current_setting('p0b.project_ref',true),'') in ('','krgvfzjwqijjdwphsyto') then
    raise exception 'Verified isolated target required; production forbidden';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public'
    and tablename='research_participants' and policyname='research_participants_select_related'
    and cmd='SELECT' and permissive='PERMISSIVE' and roles=array['authenticated']::name[]
    and qual in ('can_access_patient(patient_id)','public.can_access_patient(patient_id)')) then
    raise exception 'Unexpected participant policy; review before rollback';
  end if;
end $p0c2$;
alter policy research_participants_select_related on public.research_participants
using (public.can_read_research_participant(id));
commit;
