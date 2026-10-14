# Task 1 — Lead Follow-up Automation

Cursor-owned Myntmore lead engine. **n8n is the Task 1 runtime.** TypeScript under `src/` is the shared rules engine, test harness, and local CSV dry-run CLI.

Make.com Task 2→1 bridge is Cursor-owned but **deferred** until OpenCode confirms the Hook Grader contract.

## Quick start (local CLI dry-run)

```bash
cd automation
npm install
cp .env.example .env.local   # optional Gemini key for live drafts
npm test
npm run process:csv
```

Output: `automation/output/pipeline-result.json`

## n8n runtime

| Item | Value |
|------|-------|
| Workflow | [Myntmore Task1 Lead Follow-up](http://localhost:5678/workflow/RPh6nEfzP2mq7GFj) |
| ID | `RPh6nEfzP2mq7GFj` |
| Data Table | `myntmore_task1_leads` |
| Engine | `workflows/n8n-code/process-leads.js` |

See `workflows/n8n-lead-followup.md`.

## Integration status

| Integration | Status |
|-------------|--------|
| Cleaning / scoring / routing | Tested (unit + CSV dry-run + n8n test) |
| Email template fallback | Tested |
| Gemini live | Verified for a single lead via Generative Language REST + `GEMINI_MODEL=gemini-3.8-flash` (assignment `gemini-2.5-flash` returns 404 for this key). Full 14-draft CSV hit Google **quota**; recoverable template fallback used. n8n has **no** Gemini credential → template fallback only. |
| Supabase | Dry-run / UNVERIFIED (migration proposal only) |
| Zoho | Draft-only dry-run / UNVERIFIED |
| Make.com Task2→1 | Deferred |

## Docs

| Doc | Contents |
|-----|----------|
| [docs/CLEANING_RULES.md](docs/CLEANING_RULES.md) | Per-row accounting |
| [docs/SCORING_RULES.md](docs/SCORING_RULES.md) | Rules vs Gemini |
| [docs/SCHEMA_PROPOSAL.md](docs/SCHEMA_PROPOSAL.md) | Proposed `leads` table + idempotency |
| [docs/INTEGRATION_PENDING.md](docs/INTEGRATION_PENDING.md) | Make.com / OpenCode blockers |
| [docs/GITIGNORE_CONFLICT.md](docs/GITIGNORE_CONFLICT.md) | `leads.csv` ignore issue |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Runtime layout |
