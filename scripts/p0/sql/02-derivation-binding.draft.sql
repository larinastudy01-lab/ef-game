-- DRAFT ONLY. Add restrictive relational checks; keep existing authorization policies.
-- Required isolated target guard. No raw/derived rows are rewritten or deleted.
begin;
do $p0b$
begin
  if current_setting('p0b.environment',true) is distinct from 'isolated'
    or coalesce(current_setting('p0b.project_ref',true),'') in ('','krgvfzjwqijjdwphsyto') then
    raise exception 'Verified isolated environment required';
  end if;
  if exists(select 1 from public.behavioral_trial_derivations d
    join public.behavioral_trials b on b.id=d.trial_id
    join public.behavioral_task_sessions t on t.id=b.task_session_id
    join public.behavioral_sessions s on s.id=t.session_id
    where d.participant_id<>s.participant_id or d.task_code<>t.task_code) then
    raise exception 'Existing inconsistent derivation bindings require manual review';
  end if;
end $p0b$;
drop policy if exists p0b_derivations_read_binding on public.behavioral_trial_derivations;
drop policy if exists p0b_derivations_insert_binding on public.behavioral_trial_derivations;
drop policy if exists p0b_derivations_update_binding on public.behavioral_trial_derivations;
create policy p0b_derivations_read_binding on public.behavioral_trial_derivations as restrictive
for select to authenticated using (exists (
  select 1 from public.behavioral_trials b
  join public.behavioral_task_sessions t on t.id=b.task_session_id
  join public.behavioral_sessions s on s.id=t.session_id
  where b.id=behavioral_trial_derivations.trial_id
    and s.participant_id=behavioral_trial_derivations.participant_id
    and t.task_code=behavioral_trial_derivations.task_code
    and public.can_read_research_participant(s.participant_id)
));
create policy p0b_derivations_insert_binding on public.behavioral_trial_derivations as restrictive
for insert to authenticated with check (exists (
  select 1 from public.behavioral_trials b
  join public.behavioral_task_sessions t on t.id=b.task_session_id
  join public.behavioral_sessions s on s.id=t.session_id
  where b.id=behavioral_trial_derivations.trial_id
    and s.participant_id=behavioral_trial_derivations.participant_id
    and t.task_code=behavioral_trial_derivations.task_code
    and public.can_write_research_participant(s.participant_id)
));
create policy p0b_derivations_update_binding on public.behavioral_trial_derivations as restrictive
for update to authenticated using (exists (
  select 1 from public.behavioral_trials b
  join public.behavioral_task_sessions t on t.id=b.task_session_id
  join public.behavioral_sessions s on s.id=t.session_id
  where b.id=behavioral_trial_derivations.trial_id and s.participant_id=behavioral_trial_derivations.participant_id
    and t.task_code=behavioral_trial_derivations.task_code and public.can_write_research_participant(s.participant_id)
)) with check (exists (
  select 1 from public.behavioral_trials b
  join public.behavioral_task_sessions t on t.id=b.task_session_id
  join public.behavioral_sessions s on s.id=t.session_id
  where b.id=behavioral_trial_derivations.trial_id and s.participant_id=behavioral_trial_derivations.participant_id
    and t.task_code=behavioral_trial_derivations.task_code and public.can_write_research_participant(s.participant_id)
));
commit;
-- Rollback: after reviewing authorization risk, drop ONLY the three p0b_* policies
-- in a guarded isolated transaction. Keep all data and existing policies.
