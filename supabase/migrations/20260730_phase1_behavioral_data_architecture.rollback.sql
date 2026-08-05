-- Rollback is destructive for Phase 1 tables only. Export them before running.
drop trigger if exists behavioral_trials_raw_immutable on public.behavioral_trials;
drop function if exists public.prevent_raw_behavioral_mutation();
drop function if exists public.can_write_research_participant(uuid);
drop function if exists public.can_read_research_participant(uuid);
drop table if exists public.behavioral_trial_derivations;
drop table if exists public.behavioral_trials;
drop table if exists public.behavioral_task_sessions;
drop table if exists public.behavioral_sessions;
drop table if exists public.research_participants;

-- Existing patients, game_results and their payloads are intentionally untouched.
