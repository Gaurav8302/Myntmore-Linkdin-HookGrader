# Agent Handoff — Myntmore Assignment

**Status:** Ownership transferred — Cursor is sole active implementer  
**Updated:** 2026-10-14 (audit / handoff iteration)

---

## Ownership matrix (current)

| Area | Owner | Notes |
|------|-------|-------|
| Entire `linkedin-hook-grader/` (Task 2) | **Cursor** | Preserve OpenCode work; repair incrementally |
| Entire `automation/` (Task 1) | **Cursor** | n8n orchestrates E2E; TS = rules/tests/CLI |
| Make.com Task 2 → Task 1 bridge | **Cursor** | Deferred until contract verified against code |
| Shared `/docs/`, `/supabase/`, root config | **Cursor** (with Human approval for migrations / `.gitignore`) | Reconcile deliberately |
| Accounts, secrets, Loom, submission PDF | **Human** | Auth, approvals, manual demo recording |
| OpenCode | — | Prior Task 2 author; do not run concurrently |

## Human-only actions

- Create/link Supabase, Vercel, Make.com, Gemini, Zoho, GitHub, Loom accounts
- Provide API keys / OAuth (never commit secrets)
- Approve shared migration text and root `.gitignore` `leads.csv` fix
- Record Loom (5–7 min, camera on, 4 segments) and submit PDF

## Collaboration rules (post-transfer)

1. **Preserve existing work** under both app directories. Do not scaffold over working files.
2. **API contract** (`linkedin-hook-grader/docs/API_CONTRACT.md`) is provisional until verified against route + outbox + Task 1 ingest fields.
3. **n8n** = Task 1 runtime. **Make.com** = only Task 2→1 bridge (assignment-mandated).
4. **No concurrent dual-agent edits** on the same paths during/after transfer.
5. Report tested vs mocked vs unverified honestly.

## Current phase (audit)

| Phase | Status | Owner |
|-------|--------|-------|
| 0: Prerequisites (accounts/keys) | Partial — `leads.csv` present; many live creds missing | Human |
| 1: Hook Grader complete + green tests | In progress — app exists; **8/65 tests failing** | Cursor |
| 2: Task 1 n8n + Supabase + Zoho draft | In progress — n8n dry-run works; Supabase/Zoho live unverified | Cursor |
| 3: Make.com bridge E2E | Blocked on contract + credentials | Cursor + Human |
| 4: Vercel deploy + Loom + submit | Not started | Human + Cursor |

See `docs/COMPLETION_PLAN.md` for prioritized next steps from the 2026-10-14 audit.
