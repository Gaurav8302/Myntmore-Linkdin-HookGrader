# n8n Task 1 runtime — Lead Follow-up

**Status:** Active local workflow.  
**Workflow:** [Myntmore Task1 Lead Follow-up](http://localhost:5678/workflow/RPh6nEfzP2mq7GFj) (`RPh6nEfzP2mq7GFj`)  
**Engine:** `workflows/n8n-code/process-leads.js` (service_rubric_v1 + draft JSON artifacts)

## Ownership

- Cursor owns Task 1 and the Make.com Task 2→1 bridge.
- n8n orchestrates the end-to-end Task 1 CSV flow.
- Supporting TypeScript in `automation/src/` mirrors the same rules for local CLI/tests.

## Flow (CSV dry-run)

1. **CSV Dry-Run Trigger** (manual)
2. **Import Clean Score Route Draft** — clean → qualify (7 services) → score → route → Hot/Warm `draft_artifact` JSON → Zoho draft-only plan
3. **Build Run Summary** — imported / processed / excluded / Hot / Warm / Not-fit counts

Hook Grader webhook path (Make → n8n) remains separate and must stay intact.

## What to show in a Loom execution

Open a **success** execution (e.g. `28`) → node **Import Clean Score Route Draft**:

1. Qualification result (`service`, `qualification_status`, `qualification_method`, reason)
2. Hot / Warm / Not-fit routing (`routing_tier`)
3. `draft_artifact` object for Hot and Warm only
4. `validation_ok` / `validation_errors` on the artifact
5. Persistence markers / upsert outcomes in summary
6. Explicit `status: draft_only` and `send_attempted: false`
7. Error details when draft generation fails (template fallback still produces an artifact)

Not-fit rows have **no** `draft_artifact`.

## Safety

- Draft-only: no `sendMail` path. Native Zoho `__email_drafts` when OAuth + live bridge are configured — see [`../docs/ZOHO_DRAFT_CAPABILITY.md`](../docs/ZOHO_DRAFT_CAPABILITY.md).
- Qualification / Description updates remain available as CRM visibility without sending mail.
- Retries upsert on stable `draft_id` / idempotency key.
- Prompt injection cannot force Hot.

## Verified run (execution 28 + CLI dry-run)

| Metric | Count |
|--------|-------|
| Rows accounted | 20 |
| Hot | 12 |
| Warm | 2 |
| Not-fit | 6 |
| Draft artifacts | 14 |
| Not-fit with draft | 0 |
| Emails sent | 0 |

Primary services (n8n exec 28): linkedin_outreach=5, icp_mapping=4, cold_email=2, personal_branding=6, ai_lead_generation=3.

## Retest

Re-run manually in n8n, or MCP `test_workflow` / `execute_workflow` on `RPh6nEfzP2mq7GFj`. Local CLI: `PIPELINE_MODE=dry_run npm run process:csv`.
