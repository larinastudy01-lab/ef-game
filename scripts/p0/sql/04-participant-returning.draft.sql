-- DRAFT; isolated P0-C2 only. No source data changes or RLS disabling.
-- A STABLE self-lookup cannot see the just-inserted participant during RETURNING.
-- Check the same non-null patient FK directly, preserving the existing read authority.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $p0c2$
declare existing text;
begin
  if current_setting('p0b.environment',true) is distinct from 'isolated'
    or coalesce(current_setting('p0b.project_ref',true),'') in ('','krgvfzjwqijjdwphsyto') then
    raise exception 'Verified isolated target required; production forbidden';
  end if;
  select qual into existing from pg_policies
    where schemaname='public' and tablename='research_participants'
      and policyname='research_participants_select_related' and cmd='SELECT'
      and permissive='PERMISSIVE' and roles=array['authenticated']::name[];
  if existing is null or existing not in (
    'can_read_research_participant(id)','public.can_read_research_participant(id)',
    'can_access_patient(patient_id)','public.can_access_patient(patient_id)'
  ) then raise exception 'Unexpected participant read policy; review schema drift'; end if;
end $p0c2$;
alter policy research_participants_select_related on public.research_participants
using (public.can_access_patient(patient_id));
commit;
