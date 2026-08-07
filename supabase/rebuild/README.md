# Core database rebuild

This rebuild intentionally contains only the current core application flows:
registration/login profiles, patients, clinician assignment and game results.

Run in Supabase SQL Editor as `postgres`, in this exact order:

1. `00_RESET_PUBLIC_APP.sql` — destructive; back up first.
2. `01_CREATE_AUTH_PATIENTS_RESULTS.sql` — creates the clean core schema.
3. `02_VERIFY_CORE.sql` — read-only verification.
4. `03_CREATE_NOTES_REMINDERS.sql` — clinician notes and parent reminders used
   by the current UI.
5. `04_CREATE_RESEARCH_RECOMMENDATION.sql` — trial-level research data, ML
   experiment registry and adaptive recommendation history.
6. `05_CREATE_CLINICAL_RAG.sql` — pgvector clinical knowledge store and search
   RPCs for the clinical assistant.
7. `06_VERIFY_ADVANCED.sql` — read-only verification for steps 5 and 6.
8. `07_CREATE_CLINICIAN_APPLICATIONS.sql` — pending clinician registration,
   private verification documents and administrator review RPC.
9. `08_CREATE_ACCESS_CONSENT.sql` — guardian approval and revocation for
   clinician access to each patient.
10. `09_CREATE_SECURITY_AUDIT_AND_ACCOUNT_LIFECYCLE.sql` — immutable audit
    history, suspension, expiry and annual re-verification.
11. `10_FIX_PATIENT_CREATION_RPC.sql` — authenticated guardian patient creation
    RPC that avoids direct-insert RLS ambiguity.

The reset preserves Supabase Authentication users. The create script rebuilds a
guardian profile for every preserved auth user. It intentionally does not trust
the `role` value supplied during public sign-up.

After rebuilding, assign each professional account manually in SQL Editor:

```sql
update public.profiles
set role = 'clinician', updated_at = now()
where email = 'clinician@example.com';
```

To remove login accounts too, delete them from Authentication > Users before
running step 1. Do not delete rows from the `auth` schema with an ad-hoc query.
