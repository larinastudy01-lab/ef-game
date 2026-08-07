-- Read-only verification for research, recommendation and RAG features.

-- Expect nine rows, all with RLS enabled.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'research_participants', 'behavioral_sessions', 'behavioral_task_sessions',
    'behavioral_trials', 'behavioral_trial_derivations', 'ml_experiments',
    'recommendation_decisions', 'clinical_knowledge_documents',
    'clinical_knowledge_chunks'
  )
order by c.relname;

-- Expect zero rows: no unvalidated foreign keys.
select conrelid::regclass as table_name, conname
from pg_constraint
where contype = 'f'
  and connamespace = 'public'::regnamespace
  and not convalidated;

-- Expect zero rows: no duplicate source trials or knowledge chunks.
select 'behavioral_trials' as entity, task_session_id::text as parent_id,
       source_trial_key as item_key, count(*)
from public.behavioral_trials
group by task_session_id, source_trial_key
having count(*) > 1
union all
select 'clinical_knowledge_chunks', document_id::text, chunk_index::text, count(*)
from public.clinical_knowledge_chunks
group by document_id, chunk_index
having count(*) > 1;

-- Expect the four helper functions plus two match_clinical_knowledge overloads.
select n.nspname as routine_schema, p.proname as routine_name,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'can_read_research_participant', 'can_write_research_participant',
    'prevent_raw_behavioral_mutation', 'protect_recommendation_decision',
    'match_clinical_knowledge'
  )
order by p.proname, arguments;

-- Informational row counts.
select 'research_participants' as entity, count(*) from public.research_participants
union all select 'behavioral_sessions', count(*) from public.behavioral_sessions
union all select 'behavioral_trials', count(*) from public.behavioral_trials
union all select 'ml_experiments', count(*) from public.ml_experiments
union all select 'recommendation_decisions', count(*) from public.recommendation_decisions
union all select 'knowledge_documents', count(*) from public.clinical_knowledge_documents
union all select 'knowledge_chunks', count(*) from public.clinical_knowledge_chunks;
