# Task 1 — Lead Follow-up Automation

Cursor-owned Myntmore lead engine. **n8n is the Task 1 runtime.** TypeScript under `src/` is the shared rules engine, test harness, and local CSV dry-run CLI.

**Make.com** is the mandatory Task 2 → Task 1 bridge (scenario `7960198`). See [`../docs/MAKE_BRIDGE_STATUS.md`](../docs/MAKE_BRIDGE_STATUS.md).

## Quick start (local CLI dry-run)

```bash
cd automation
npm install
cp .env.example .env.local   # NVIDIA key optional; template fallback without it
npm test
PIPELINE_MODE=dry_run npm run process:csv
```

Outputs (gitignored under `output/` when present):

- `automation/output/pipeline-result.json`
- `automation/output/email_drafts.json` — Hot/Warm JSON draft artifacts only

### Latest dry-run (2026-10-17)

| Metric | Count |
|--------|-------|
| Rows accounted | 20 |
| Hot | 12 |
| Warm | 2 |
| Not a fit | 6 |
| Draft artifacts | 14 |
| Emails sent | 0 |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm test` | Vitest unit suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Compile TypeScript |
| `npm run process:csv` | Run pipeline on root `leads.csv` |
| `npm run process:incoming` | Process one Hook Grader / Make payload (CLI) |
| `npm run process:incoming:server` | HTTP bridge for n8n Make ingest (`127.0.0.1:8791`) |
| `npm run print:n8n-ingest-url` | Print Make → n8n URL from env |
| `npm run zoho:draft` | Controlled Zoho draft helper |

## Qualification (seven services)

Grounded in Myntmore service pages. Rubric version `service_rubric_v1`. Full signals: [`docs/QUALIFICATION_RUBRIC.md`](docs/QUALIFICATION_RUBRIC.md).

| ID | Official name |
|----|---------------|
| `linkedin_outreach` | LinkedIn Outreach & Automation |
| `cold_email` | Cold Email Infrastructure |
| `icp_mapping` | ICP Mapping & Lead Scoring |
| `ai_lead_generation` | AI Lead Generation |
| `account_based_marketing` | Account-Based Marketing |
| `personal_branding` | Personal Branding |
| `gtm_strategy` | GTM Strategy |

- **Rules** decide score (1–10), Hot/Warm/Not-fit, hard exclusions, and primary service when evidence is clear.
- **NVIDIA** is used only for ambiguous multi-service ties and email draft generation; output is validated.
- Insufficient/conflicting evidence → `needs_review` (no invented certainty).
- Every CSV row gets a recorded outcome (including duplicates and messy rows).

## Email drafts and Zoho

1. Hot/Warm drafts are generated as JSON artifacts (`status: draft_only`, `send_attempted: false`, CTA `https://myntmore.com/founder-meeting`).
2. Artifacts persist to Supabase `email_draft_artifacts` when credentials allow.
3. When `PIPELINE_MODE=live` and Zoho OAuth refresh credentials are set, the pipeline creates a **native** Zoho email draft via `__email_drafts` (plain text: `rich_text: false` + `plainTextContent`). See [`docs/ZOHO_DRAFT_CAPABILITY.md`](docs/ZOHO_DRAFT_CAPABILITY.md).
4. **Never** call `sendMail` / send endpoints.
5. Not-fit → reason recorded, **no** email draft.

For Make → n8n → Zoho drafts, keep `npm run process:incoming:server` running while testing.

## n8n runtime

| Item | Value |
|------|-------|
| Workflow | [Myntmore Task1 Lead Follow-up](http://localhost:5678/workflow/RPh6nEfzP2mq7GFj) |
| ID | `RPh6nEfzP2mq7GFj` |
| Engine | `workflows/n8n-code/process-leads.js` |

**Demo a successful execution:** open a success run → `Import Clean Score Route Draft` → inspect item JSON for `qualification_*`, `routing_tier`, and `draft_artifact` (Hot/Warm only).

See [`workflows/n8n-lead-followup.md`](workflows/n8n-lead-followup.md).

## Integration status

| Integration | Status |
|-------------|--------|
| Cleaning / scoring / routing / qualification | Unit tests + CSV dry-run (2026-10-17: Hot 12 / Warm 2 / Not a fit 6) + n8n executions documented in workflow notes |
| Email JSON artifacts | Generated, validated; persisted when Supabase credentials allow |
| NVIDIA live drafts | Used when key present; template fallback on failure (`source: template_fallback`) |
| Supabase leads | Live upserts when credentials allow; CLI dry-run works without service role |
| Zoho native drafts | Documented live OAuth path in `ZOHO_DRAFT_CAPABILITY.md`; requires live mode + credentials + incoming server |
| Make.com Task2→1 | Controlled E2E recorded 2026-10-15; tunnel hostname is temporary |

## Tests (2026-10-17)

- **56/57** Vitest tests passed.
- Failure: Zoho adapter “qualification Notes mode as fallback” expects `created`, received `skipped`.
- `npm run typecheck` / `npm run build` fail on duplicate `processIncomingLead` export in `src/index.ts` (known; Vitest still runs).

## Bonus enrichment

Three real B2B companies (research only, no CRM contacts): [`docs/enrichment/real_company_enrichment.json`](docs/enrichment/real_company_enrichment.json) (checked 2026-10-14).

## Docs

| Doc | Contents |
|-----|----------|
| [docs/ZOHO_DRAFT_CAPABILITY.md](docs/ZOHO_DRAFT_CAPABILITY.md) | Authoritative Zoho draft-only status |
| [docs/QUALIFICATION_RUBRIC.md](docs/QUALIFICATION_RUBRIC.md) | Seven services, rules vs NVIDIA, draft schema |
| [docs/SCORING_RULES.md](docs/SCORING_RULES.md) | Score and routing thresholds |
| [docs/CLEANING_RULES.md](docs/CLEANING_RULES.md) | Per-row accounting |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Runtime layout |
| [docs/SCHEMA_PROPOSAL.md](docs/SCHEMA_PROPOSAL.md) | Leads + draft artifacts |
| [docs/GITIGNORE_CONFLICT.md](docs/GITIGNORE_CONFLICT.md) | `leads.csv` Git status (resolved) |
| [../docs/MAKE_BRIDGE_STATUS.md](../docs/MAKE_BRIDGE_STATUS.md) | Make.com bridge |
