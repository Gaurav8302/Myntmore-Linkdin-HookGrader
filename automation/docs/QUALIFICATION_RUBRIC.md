# Service qualification rubric (Task 1)

Grounded in Myntmore’s seven service pages (`myntmore.com/services` and each `/services/*` page). Version: `service_rubric_v1`.

## Seven services

| ID | Official name |
|----|---------------|
| `linkedin_outreach` | LinkedIn Outreach & Automation |
| `cold_email` | Cold Email Infrastructure |
| `icp_mapping` | ICP Mapping & Lead Scoring |
| `ai_lead_generation` | AI Lead Generation |
| `account_based_marketing` | Account-Based Marketing |
| `personal_branding` | Personal Branding |
| `gtm_strategy` | GTM Strategy |

## Rules vs NVIDIA

| Decision | Method |
|----------|--------|
| Numeric lead score 1–10 | **Rules only** (never NVIDIA) |
| Hot / Warm / Not-fit | **Rules only** (score thresholds + hard exclusions) |
| Primary / secondary service fit | **Rules** on submitted tool input/output + modest tool prior |
| Ambiguous multi-service ties | Optional NVIDIA pick **validated against the seven names**; otherwise `needs_review` |
| Hard exclusions (test, non-buyer, injection, malformed) | **Override** any model output → `qualification_status=excluded` |

## Exclusions and review

- Every CSV row gets an outcome (`processed`, `excluded`, `duplicate_retained`, or `failed`).
- Duplicates keep an outcome and reference the canonical email session.
- Insufficient or conflicting service evidence → `needs_review` (do not invent certainty).
- ABM is **not** assigned merely because someone wants “more leads”; named/target-account evidence is required.

## Routing (unchanged thresholds)

- Hot: score ≥ 8 and email-eligible → draft + alert  
- Warm: score 5–7 and email-eligible → nurture draft  
- Not fit: blocked flags, incomplete session, or score ≤ 4 → **no draft**

## Email drafts (JSON artifacts)

Email drafts are generated and persisted as JSON artifacts. They are not sent, and Zoho's email composer draft API remains permission-blocked (`Crm_Implied_Create_EmailDrafts`).

- Hot/Warm only; Not-fit → no artifact  
- Schema fields: `draft_id`, `lead_id`, `lead_temperature`, services, `subject`, `recipient`, `body`, `cta_url` (`https://myntmore.com/founder-meeting`), `status: draft_only`, `send_attempted: false`, validation flags  
- Durable store: Supabase `email_draft_artifacts` (upsert on `draft_id`)  
- Local demo file: `automation/output/email_drafts.json` (gitignored generated output)  
- Visible in n8n item JSON as `draft_artifact`

## Zoho CRM display

Write a concise qualification block into Lead Notes / Description (supported APIs). Do **not** claim this is a Zoho Email Drafts composer item.

## Real-company enrichment (bonus)

Separate from the 20 fictional CSV sessions. See [`enrichment/real_company_enrichment.json`](enrichment/real_company_enrichment.json) and `.csv` (checked **2026-10-14**): Postman, Chargebee, Razorpay — company-level public sources only; no CRM leads for real people.

## How to demonstrate

1. Run n8n workflow `RPh6nEfzP2mq7GFj` (CSV Dry-Run Trigger).
2. Open execution → `Import Clean Score Route Draft` → inspect `draft_artifact` on Hot/Warm items.
3. Confirm Supabase `email_draft_artifacts` rows with `send_attempted=false`.
4. Open Zoho Lead Description for the fictional test lead (qualification block).
