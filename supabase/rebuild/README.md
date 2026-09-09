# Core database rebuild

This rebuild includes core flows, research, recommendation, RAG, clinician
review, access consent and account lifecycle schema.

For a new empty project, skip `00_RESET_PUBLIC_APP.sql` and start with 01.
For an existing database that must retain data, do not use the reset workflow;
follow [the setup entrypoint](../README.md).

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

Normal professional onboarding uses clinician applications and administrator
review. The following legacy administrator role assignment example is not a
replacement for review, account lifecycle checks or patient consent, and does
not grant access to every patient:

```sql
update public.profiles
set role = 'clinician', updated_at = now()
where email = 'clinician@example.com';
```

To remove login accounts too, delete them from Authentication > Users before
running step 1. Do not delete rows from the `auth` schema with an ad-hoc query.

After the numbered rebuild, apply
`../migrations/20260902_create_honey_mission_progress.sql` for honey progress.
Review later migrations against the actual schema; do not blindly replay older
migrations or rollback scripts. Re-run read-only verification and test guardian
creation, professional approval, patient access and result persistence.
