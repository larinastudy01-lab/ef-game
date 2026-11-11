-- DRAFT ONLY. Restore EACH saved preflight code set. Never delete ARI rows.
-- Required isolated target guard as in the forward draft.
-- set p0b.original_task_codes='legacy'; -- or current, from saved TASK constraint
-- set p0b.original_derivation_codes='legacy'; -- or current, from saved DERIVATION constraint
begin;
set local lock_timeout='5s';
do $p0b$
declare table_name text; original text; codes text; invalid boolean;
begin
  if current_setting('p0b.environment',true) is distinct from 'isolated'
    or coalesce(current_setting('p0b.project_ref',true),'') in ('','krgvfzjwqijjdwphsyto') then
    raise exception 'Verified isolated environment required';
  end if;
  foreach table_name in array array['behavioral_task_sessions','behavioral_trial_derivations'] loop
    original := current_setting(case when table_name='behavioral_task_sessions' then 'p0b.original_task_codes' else 'p0b.original_derivation_codes' end,true);
    codes := case original
      when 'legacy' then '''CBT'',''PM'',''SRT'',''SSG'',''LB'',''DCCS'''
      when 'current' then '''CBT'',''PM'',''SRT'',''ARI'',''LB'',''DCCS'''
      when 'expanded' then '''CBT'',''PM'',''SRT'',''SSG'',''ARI'',''LB'',''DCCS'''
      else null end;
    if codes is null then raise exception 'Saved preflight code set required for %',table_name; end if;
    execute format('select exists(select 1 from public.%I where task_code not in (%s))',table_name,codes) into invalid;
    if invalid then raise exception 'Rollback would invalidate retained data; keep expanded constraint and roll back application only'; end if;
    execute format('alter table public.%I drop constraint %I',table_name,table_name||'_task_code_check');
    execute format('alter table public.%I add constraint %I check(task_code in (%s))',table_name,table_name||'_task_code_check',codes);
  end loop;
end $p0b$;
commit;
