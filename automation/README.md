# Task 1 — Lead Follow-up Automation

Cursor-owned Myntmore lead engine. **n8n is the Task 1 runtime.** TypeScript under `src/` is the shared rules engine, test harness, and local CSV dry-run CLI.

Make.com Task 2→1 bridge is live (scenario `7960198`); see [`docs/MAKE_BRIDGE_STATUS.md`](../docs/MAKE_BRIDGE_STATUS.md).

## Quick start (local CLI dry-run)

```bash
cd automation
npm install
cp .env.example .env.local   # NVIDIA key optional; template fallback without it
npm test
PIPELINE_MODE=dry_run npm run process:csv
```

Outputs (gitignored):

- `automation/output/pipeline-result.json`
- `automation/output/email_drafts.json` — Hot/Warm JSON draft artifacts only

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
- **NVIDIA** is used only for ambiguous multi-service ties; output is validated against the seven names.
- Insufficient/conflicting evidence → `needs_review` (no invented certainty).
- Every CSV row gets a recorded outcome (including duplicates and messy rows).

## Email drafts (JSON artifacts)

Email drafts are generated and persisted as JSON artifacts. They are not sent, and Zoho's email composer draft API remains permission-blocked.

- Hot → personalised follow-up draft + alert path  
- Warm → personalised nurture draft  
- Not-fit → reason recorded, **no draft**  
- Fields include `draft_id`, `status: draft_only`, `send_attempted: false`, CTA `https://myntmore.com/founder-meeting`  
- Durable store: Supabase `email_draft_artifacts` (upsert on `draft_id`)  
- Visible in n8n execution item JSON as `draft_artifact`

Do **not** claim a JSON artifact is a genuine Zoho Email Drafts composer item.

## n8n runtime

| Item | Value |
|------|-------|
| Workflow | [Myntmore Task1 Lead Follow-up](http://localhost:5678/workflow/RPh6nEfzP2mq7GFj) |
| ID | `RPh6nEfzP2mq7GFj` |
| Engine | `workflows/n8n-code/process-leads.js` |

**Demo a successful execution:** open the latest success → `Import Clean Score Route Draft` → inspect item JSON for `qualification_*`, `routing_tier`, and `draft_artifact` (Hot/Warm only).

See `workflows/n8n-lead-followup.md`.

## Integration status

| Integration | Status |
|-------------|--------|
| Cleaning / scoring / routing / qualification | Unit + CSV dry-run + n8n execution `28` |
| Email JSON artifacts | Generated, validated, visible in n8n; persisted in Supabase `email_draft_artifacts` |
| NVIDIA live drafts | Used when key present; template fallback on failure |
| Supabase leads | Live upserts when credentials allow; CLI dry-run without service role |
| Zoho | Qualification block in Lead Description; Email Drafts API still blocked |
| Make.com Task2→1 | Controlled E2E passed; tunnel hostname is temporary |

## Bonus enrichment

Three real B2B companies (research only, no CRM contacts): [`docs/enrichment/real_company_enrichment.json`](docs/enrichment/real_company_enrichment.json) (checked 2026-10-14).

## Docs

| Doc | Contents |
|-----|----------|
| [docs/QUALIFICATION_RUBRIC.md](docs/QUALIFICATION_RUBRIC.md) | Seven services, rules vs NVIDIA, draft schema |
| [docs/SCORING_RULES.md](docs/SCORING_RULES.md) | Score and routing thresholds |
| [docs/CLEANING_RULES.md](docs/CLEANING_RULES.md) | Per-row accounting |
| [docs/ZOHO_DRAFT_CAPABILITY.md](docs/ZOHO_DRAFT_CAPABILITY.md) | Zoho permission blocker + JSON-artifact path |
| [docs/SCHEMA_PROPOSAL.md](docs/SCHEMA_PROPOSAL.md) | Leads + draft artifacts |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Runtime layout |
