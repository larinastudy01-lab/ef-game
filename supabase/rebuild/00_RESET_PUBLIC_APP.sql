-- DANGER: deletes all application data in the public schema.
-- It intentionally preserves auth.users. Run only after taking a backup.
begin;

drop trigger if exists on_auth_user_created_profile on auth.users;

drop table if exists public.recommendation_decisions cascade;
drop table if exists public.ml_experiments cascade;
drop table if exists public.behavioral_trial_derivations cascade;
drop table if exists public.behavioral_trials cascade;
drop table if exists public.behavioral_task_sessions cascade;
drop table if exists public.behavioral_sessions cascade;
drop table if exists public.research_participants cascade;
drop table if exists public.clinical_knowledge_chunks cascade;
drop table if exists public.clinical_knowledge_documents cascade;
drop table if exists public.parent_reminders cascade;
drop table if exists public.clinician_notes cascade;
drop table if exists public.security_audit_logs cascade;
drop table if exists public.clinician_verification_history cascade;
drop table if exists public.patient_access_consents cascade;
drop table if exists public.clinician_access_invitations cascade;
drop table if exists public.clinician_applications cascade;
drop table if exists public.clinician_patient_access cascade;
drop table if exists public.game_results cascade;
drop table if exists public.patients cascade;
drop table if exists public.profiles cascade;

-- Remove every known application function, including overloaded RAG functions.
do $$
declare
  target regprocedure;
begin
  for target in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'clinician_create_patient', 'can_access_patient', 'is_professional',
        'handle_new_user_profile', 'prevent_profile_role_escalation',
        'set_updated_at', 'can_read_research_participant',
        'can_write_research_participant', 'prevent_raw_behavioral_mutation',
        'protect_recommendation_decision', 'match_clinical_knowledge',
        'is_admin', 'review_clinician_application', 'request_patient_access',
        'respond_to_access_invitation', 'revoke_patient_access',
        'redact_audit_data', 'write_security_audit_log',
        'record_clinician_verification_history',
        'set_clinician_verification_expiry', 'set_clinician_account_status',
        'expire_due_clinician_verifications', 'create_my_patient'
      )
  loop
    execute format('drop function if exists %s cascade', target);
  end loop;
end;
$$;

commit;
