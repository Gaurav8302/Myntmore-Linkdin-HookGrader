# Supabase status (2026-10-14)

| Item | Status |
|------|--------|
| Project | `Gaurav8302's Project` (`chywwbszcmmyplojqniv`, `ap-south-1`, ACTIVE) |
| API URL | `https://chywwbszcmmyplojqniv.supabase.co` |
| Anon key | Written to gitignored `linkedin-hook-grader/.env.local` |
| Service role | **Missing** — required for Hook Grader atomic insert + outbox |
| Tables | **Empty** — no migrations applied yet |
| Remote migrations | None listed |

## Repo migrations (not applied)

1. `supabase/migrations/001_hook_grader_schema.sql` — sessions + outbox + deliveries + RPC  
2. `supabase/migrations/002_task1_leads_schema.sql` — **placeholder only**; replace with `automation/docs/SCHEMA_PROPOSAL.md` (`idempotency_key TEXT`) before apply  

## Exact Human actions

1. Supabase Dashboard → Project Settings → API → copy **service_role** (secret) into `linkedin-hook-grader/.env.local` as `SUPABASE_SERVICE_ROLE_KEY=` and `automation/.env.local` if needed.  
2. Reply **approve apply migrations** (001 as-is; 002 from SCHEMA_PROPOSAL text). Cursor will not apply DDL without that approval.  
