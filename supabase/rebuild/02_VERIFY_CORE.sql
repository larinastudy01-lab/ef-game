-- Read-only verification after rebuilding the core schema.

-- Expect four rows, all with RLS enabled.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'patients', 'clinician_patient_access', 'game_results')
order by c.relname;

-- Expect zero rows: every auth user must have one profile.
select u.id, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Informational row counts.
select 'auth_users' as entity, count(*) from auth.users
union all select 'profiles', count(*) from public.profiles
union all select 'patients', count(*) from public.patients
union all select 'game_results', count(*) from public.game_results;

-- Expect the trigger and function names listed below.
select event_object_schema, event_object_table, trigger_name
from information_schema.triggers
where trigger_name in (
  'on_auth_user_created_profile', 'profiles_set_updated_at',
  'patients_set_updated_at', 'profiles_prevent_role_escalation'
)
order by trigger_name;

select routine_schema, routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('clinician_create_patient', 'can_access_patient', 'is_professional')
order by routine_name;
