# n8n Task 1 runtime — Lead Follow-up

**Status:** Executable workflow on this n8n instance (CSV dry-run).  
**Workflow:** [Myntmore Task1 Lead Follow-up](http://localhost:5678/workflow/RPh6nEfzP2mq7GFj) (`RPh6nEfzP2mq7GFj`)  
**Data Table:** `myntmore_task1_leads` (`V9yyFJaurPbn0HJD`) — upsert on `idempotency_key`

## Ownership

- Cursor owns Task 1 **and** the future Make.com Task 2→1 bridge (deferred).
- n8n orchestrates the end-to-end Task 1 flow.
- Supporting TypeScript in `automation/src/` mirrors the same rules for local CLI/tests.

## Flow

1. **CSV Dry-Run Trigger** (manual)
2. **Import Clean Score Route Draft** — Code node embeds 20 CSV rows + deterministic clean/score/route + validated template email drafts + Zoho draft-only plan
3. **Route Hot Warm NotFit** — Switch with unexpected-tier fallback
4. Branch markers (Hot alert / Warm / Not a fit / Unexpected)
5. **Combine Routed Leads** (append, 4 inputs)
6. **Upsert Lead By Idempotency Key** — Data Table upsert; retry on fail
7. **Build Run Summary** — imported/processed/excluded/failed/completed + overlays

## Safety / failure handling

- Zoho: draft-only dry-run (`zoho_status=dry_run_queued|skipped|blocked`). No send path.
- Gemini in n8n: **not credentialed** → recoverable `GEMINI_DEFERRED_IN_N8N` + template fallback (CTA `myntmore.com/founder-meeting`, &lt;120 words).
- Engine Code node: `onError=continueErrorOutput` + retry → **Log Engine Failure** → merge → summary (`disposition=failed`).
- Data Table upsert: retryOnFail (3 tries) on `idempotency_key` match.
- Prompt injection cannot force Hot (score capped; routed not_a_fit).
- Make.com: **not configured**.

## Verified run summary (execution 3)

`imported=20 processed=20 excluded=6 failed=0 completed=14 duplicate=1 drafted=14 fallbackDrafts=14 hot=12 warm=2 not_a_fit=6 primary_sum=20`

## Engine source of truth in repo

- `workflows/n8n-code/process-leads.js` — embedded Code logic (20 leads)
- `workflows/fixtures/leads.dry-run.json` — fixture export from root `leads.csv`
- Local CLI parity: `npm run process:csv`

## Retest

Re-run manually in n8n, or MCP `test_workflow` with pinData on `CSV Dry-Run Trigger`: `[{"json":{}}]`.
