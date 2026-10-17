# Agent Handoff — Myntmore Assignment

**Status:** Cursor is sole active implementer  
**Updated:** 2026-10-17 (documentation / verification pass)

---

## Ownership matrix (current)

| Area | Owner | Notes |
|------|-------|-------|
| Entire `linkedin-hook-grader/` (Task 2) | **Cursor** | Preserve OpenCode work; repair incrementally |
| Entire `automation/` (Task 1) | **Cursor** | n8n orchestrates E2E; TS = rules/tests/CLI |
| Make.com Task 2 → Task 1 bridge | **Cursor** | Scenario `7960198` — see `MAKE_BRIDGE_STATUS.md` |
| Shared `/docs/`, `/supabase/`, root config | **Cursor** (Human approval for risky migrations) | Change deliberately |
| Accounts, secrets, Loom, submission PDF | **Human** | Auth, approvals, manual demo recording |
| OpenCode | — | Prior Task 2 author; do not run concurrently |

## Human-only actions

- Create/link Supabase, Vercel, Make.com, NVIDIA, Zoho, GitHub, Loom accounts
- Provide API keys / OAuth (never commit secrets)
- Approve shared migration changes when schema conflicts arise
- Keep Make → n8n tunnel URL updated when Quick Tunnel restarts
- Record Loom and submit PDF if still required by the recruiter process

## Collaboration rules

1. **Preserve existing work** under both app directories. Do not scaffold over working files.
2. **n8n** = Task 1 runtime. **Make.com** = only Task 2→1 bridge (assignment-mandated).
3. **No concurrent dual-agent edits** on the same paths.
4. Report tested vs mocked vs unverified honestly.
5. **`leads.csv`** is fictional sample data, tracked in Git (gitignore conflict resolved — see `automation/docs/GITIGNORE_CONFLICT.md`).

## Current snapshot (2026-10-17)

| Area | Status |
|------|--------|
| Hook Grader deploy | Live at https://myntmore-linkedin-hook-grader.vercel.app |
| Hook Grader tests | 108/108 unit; lint + build green |
| Automation tests | 56/57 (Notes-mode fallback failing); typecheck duplicate export |
| CSV dry-run tiers | Hot 12 / Warm 2 / Not a fit 6 |
| Make bridge | Documented E2E 2026-10-15; depends on local tunnel |
| Zoho native drafts | Live OAuth path documented in `automation/docs/ZOHO_DRAFT_CAPABILITY.md` |
| Loom | https://www.loom.com/share/39ce810ae73d4f318bd3fbf4691f0bc3 |

Authoritative recruiter summary: [`../README.md`](../README.md).  
Completion checklist history: [`COMPLETION_PLAN.md`](./COMPLETION_PLAN.md) (may lag; prefer root README).
