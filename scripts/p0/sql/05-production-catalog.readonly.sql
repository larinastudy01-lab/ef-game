-- P0-C3 review aid ONLY. Requires separately authorized read-only connection.
-- Never feed this file to a migration/apply tool. Keep unredacted output private:
-- function bodies, grants and object names require review before publication.
begin isolation level repeatable read read only;
set local statement_timeout = '30s';
select jsonb_build_object(
  'captured_at', transaction_timestamp(),
  'database', current_database(),
  'server_version', current_setting('server_version'),
  'transaction_read_only', current_setting('transaction_read_only'),
  'settings', jsonb_build_object('timezone',current_setting('TimeZone'),'date_style',current_setting('DateStyle'),
    'server_encoding',current_setting('server_encoding'),'client_encoding',current_setting('client_encoding'),
    'row_security',current_setting('row_security')),
  'settings', jsonb_build_object('timezone',current_setting('TimeZone'),'date_style',current_setting('DateStyle'),
    'server_encoding',current_setting('server_encoding'),'client_encoding',current_setting('client_encoding'),
    'row_security',current_setting('row_security')),
  'extensions', (select jsonb_agg(jsonb_build_object('name',extname,'version',extversion) order by extname) from pg_extension),
  'tables', (select jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl) order by c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')),
  'columns', (select jsonb_agg(row_to_json(x) order by x.table_name,x.ordinal_position) from (
    select table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default
    from information_schema.columns where table_schema='public') x),
  'constraints', (select jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'type',c.contype,'validated',c.convalidated,'definition',pg_get_constraintdef(c.oid)) order by c.conrelid,c.conname)
    from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'),
  'policies', (select jsonb_agg(row_to_json(p) order by p.tablename,p.policyname) from pg_policies p where schemaname='public'),
  'functions', (select jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'security_definer',p.prosecdef,'volatility',p.provolatile,'settings',p.proconfig,'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,'definition',pg_get_functiondef(p.oid)) order by p.oid::regprocedure::text)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'),
  'triggers', (select jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by t.tgrelid,t.tgname)
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal),
  'indexes', (select jsonb_agg(row_to_json(i) order by i.tablename,i.indexname) from pg_indexes i where schemaname='public'),
  'grants', (select jsonb_agg(row_to_json(g) order by g.table_name,g.grantee,g.privilege_type) from information_schema.table_privileges g where table_schema='public'),
  'migration_history_relation', to_regclass('supabase_migrations.schema_migrations')::text
);
-- If the migration relation exists AND the operator has read permission,
-- separately capture its version/name/history with the official list_migrations
-- connector. Do not guess missing columns or elevate privileges automatically.
rollback;
