# Supabase database setup

The SQL Editor history is not the schema source of truth. Keep every accepted
change in `supabase/migrations` and use timestamp order.

For the existing production project, run only:

1. `migrations/20260807_schema_reconciliation_and_rag.sql`
2. `VERIFY_SCHEMA.sql` (read-only)

The reconciliation migration is additive except for replacing overly broad RLS
policies. It does not drop application data. Take a Supabase backup before any
production migration and run the whole file as the `postgres` role.

The repository's older bootstrap file contains legacy encoding damage, so it is
not yet approved as a clean-project bootstrap. For now, use these files only to
reconcile the existing production project. Files ending in `.rollback.sql` are
emergency rollback scripts and must not be part of normal setup.

Do not keep ad-hoc `Untitled query` scripts as the only copy of a schema change.
Do not run the screenshot's `drop table ... cascade` cleanup against production;
it deletes knowledge chunks and dependent objects.
