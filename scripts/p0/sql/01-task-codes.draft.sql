-- DRAFT ONLY. Never run on production in P0-B. No data transformation.
-- Operator must first verify an isolated target and set session-local values:
-- set p0b.environment='isolated'; set p0b.project_ref='<verified test ref or local>';
-- Save the preflight catalog output before running this file.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
do $p0b$
declare
  target text := current_setting('p0b.project_ref',true);
  table_name text;
  definition text;
  codes text[];
  invalid boolean;
  before_other jsonb;
  after_other jsonb;
begin
  if current_setting('p0b.environment',true) is distinct from 'isolated'
    or target is null or target='' or target='krgvfzjwqijjdwphsyto' then
    raise exception 'Verified isolated environment required; production is forbidden';
  end if;
  select jsonb_agg(jsonb_build_array(conrelid::regclass::text,conname,pg_get_constraintdef(oid)) order by conrelid,conname)
    into before_other from pg_constraint
    where conrelid in ('public.behavioral_task_sessions'::regclass,'public.behavioral_trial_derivations'::regclass)
      and conname not in ('behavioral_task_sessions_task_code_check','behavioral_trial_derivations_task_code_check');
  foreach table_name in array array['behavioral_task_sessions','behavioral_trial_derivations'] loop
    select pg_get_constraintdef(c.oid) into definition
      from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attname='task_code'
      where c.conrelid=format('public.%I',table_name)::regclass
        and c.conname=table_name||'_task_code_check' and c.contype='c' and c.conkey=array[a.attnum];
    if definition is null or definition !~ '^CHECK \(\(task_code = ANY \(ARRAY\[' then
      raise exception 'Unexpected constraint on %; review schema drift',table_name;
    end if;
    select array_agg(distinct m[1] order by m[1]) into codes from regexp_matches(definition,'''([^'']+)''','g') m;
    if codes is null or codes not in (array['CBT','DCCS','LB','PM','SRT','SSG'],array['ARI','CBT','DCCS','LB','PM','SRT'],array['ARI','CBT','DCCS','LB','PM','SRT','SSG']) then
      raise exception 'Unexpected task-code set on %',table_name;
    end if;
    execute format('select exists(select 1 from public.%I where task_code not in (''ARI'',''CBT'',''DCCS'',''LB'',''PM'',''SRT'',''SSG''))',table_name) into invalid;
    if invalid then raise exception 'Unexpected existing task codes on %',table_name; end if;
    execute format('alter table public.%I drop constraint %I',table_name,table_name||'_task_code_check');
    execute format('alter table public.%I add constraint %I check (task_code in (''CBT'',''PM'',''SRT'',''SSG'',''ARI'',''LB'',''DCCS'')) not valid',table_name,table_name||'_task_code_check');
    execute format('alter table public.%I validate constraint %I',table_name,table_name||'_task_code_check');
  end loop;
  select jsonb_agg(jsonb_build_array(conrelid::regclass::text,conname,pg_get_constraintdef(oid)) order by conrelid,conname)
    into after_other from pg_constraint
    where conrelid in ('public.behavioral_task_sessions'::regclass,'public.behavioral_trial_derivations'::regclass)
      and conname not in ('behavioral_task_sessions_task_code_check','behavioral_trial_derivations_task_code_check');
  if before_other is distinct from after_other then raise exception 'Unrelated constraints changed'; end if;
end $p0b$;
select conrelid::regclass,conname,convalidated,pg_get_constraintdef(oid)
from pg_constraint where conname in ('behavioral_task_sessions_task_code_check','behavioral_trial_derivations_task_code_check');
commit;
