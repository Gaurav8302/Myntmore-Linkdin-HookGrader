# Supabase status

**Original note:** 2026-10-14  
**Docs refresh:** 2026-10-17 — do not treat “tables empty / migrations unapplied” below as current without re-checking the project. Make bridge E2E on 2026-10-15 recorded a `leads` row and Hook Grader production smoke previously persisted sessions (see `AI_PROVIDER_FAILURES.md`, `MAKE_BRIDGE_STATUS.md`).

## Project (from 2026-10-14 inventory)

| Item | Value |
|------|--------|
| Project | `Gaurav8302's Project` (`chywwbszcmmyplojqniv`, `ap-south-1`) |
| API URL | `https://chywwbszcmmyplojqniv.supabase.co` |
| Keys | Stored only in gitignored `.env.local` files — never commit |

## Repo migrations

1. `supabase/migrations/001_hook_grader_schema.sql` — sessions + outbox + deliveries + RPC  
2. `supabase/migrations/002_task1_leads_schema.sql` — Task 1 leads (coordinate with `automation/docs/SCHEMA_PROPOSAL.md`)  
3. `003_qualification_draft_artifacts.sql` — qualification / draft artifacts  
4. `004_fix_outbox_payload_session_id.sql` / `004_preserve_native_zoho_draft_status.sql` — follow-up fixes  

Apply via Supabase SQL editor when schema changes are intentional. Prefer reconciling Hook Grader and Task 1 contracts before altering shared tables.

## Human actions

1. Keep `SUPABASE_SERVICE_ROLE_KEY` in gitignored env files for both apps as needed.  
2. Approve DDL changes that conflict with live data.  
3. Never commit service role keys.
