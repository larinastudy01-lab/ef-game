-- Supabase commonly installs pgcrypto functions in the extensions schema.
-- Update already-created RPCs without rebuilding tables or invalidating codes.
begin;

alter function public.create_patient_access_code(uuid)
  set search_path = public, extensions, pg_temp;

alter function public.redeem_patient_access_code(text)
  set search_path = public, extensions, pg_temp;

commit;
