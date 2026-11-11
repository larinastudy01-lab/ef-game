-- DRAFT ONLY. Prevent an owned participant from linking another patient's main result.
begin;
do $p0b$
begin
  if current_setting('p0b.environment',true) is distinct from 'isolated'
    or coalesce(current_setting('p0b.project_ref',true),'') in ('','krgvfzjwqijjdwphsyto') then
    raise exception 'Verified isolated environment required';
  end if;
  if exists(select 1 from public.behavioral_sessions s
    join public.research_participants p on p.id=s.participant_id
    join public.game_results g on g.id=s.source_result_id where g.patient_id<>p.patient_id) then
    raise exception 'Existing mismatched source-result bindings require manual review';
  end if;
end $p0b$;
drop policy if exists p0b_sessions_source_insert on public.behavioral_sessions;
drop policy if exists p0b_sessions_source_update on public.behavioral_sessions;
create policy p0b_sessions_source_insert on public.behavioral_sessions as restrictive
for insert to authenticated with check (source_result_id is null or exists (
  select 1 from public.game_results g join public.research_participants p on p.patient_id=g.patient_id
  where g.id=behavioral_sessions.source_result_id and p.id=behavioral_sessions.participant_id
    and g.guardian_id=auth.uid()
));
create policy p0b_sessions_source_update on public.behavioral_sessions as restrictive
for update to authenticated using (public.can_write_research_participant(participant_id))
with check (source_result_id is null or exists (
  select 1 from public.game_results g join public.research_participants p on p.patient_id=g.patient_id
  where g.id=behavioral_sessions.source_result_id and p.id=behavioral_sessions.participant_id
    and g.guardian_id=auth.uid()
));
commit;
-- Rollback after authorization review: drop ONLY these two p0b_* policies
-- in a guarded isolated transaction, preserving all data and older policies.
