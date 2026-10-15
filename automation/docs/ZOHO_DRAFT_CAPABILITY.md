# Zoho draft-only capability (re-checked 2026-10-15)

## Live-tested this pass (refresh-token OAuth)

- **Accounts URL**: `https://accounts.zoho.in`
- **API domain**: `https://www.zohoapis.in` (from token response)
- **Auth**: Self Client → one-time authorization code → `ZOHO_REFRESH_TOKEN` in gitignored `automation/.env.local` (mode 600). Access tokens refreshed via `grant_type=refresh_token` and cached in-memory until expiry.
- **Shared entry**: `processIncomingLead()` → `createZohoDraft()` (never `sendMail`).
- **CRM Lead (controlled)**: `1445645000000557001`
- **Native draft verified**: `c5658b813e7e38dde3c89b1d61c3ac7c92d8f6ef2afceda0915f1851f1a3d5b4`
- **Source / idempotency**: `myntmore_task1_idem_hook_grader_oauth_live_1792050943085`
- **From**: allowed CRM from-address / Owner path (not a guessed `@myntmore.com`).
- **Replay**: same draft id reused; no duplicate draft.
- **n8n**: Make ingest calls local bridge `POST http://127.0.0.1:8791/process-incoming` (`npm run process:incoming:server`) because Execute Command is unavailable on this n8n instance.

## Integration path (shared pipeline)

Hot/Warm leads in `processLead` / `processIncomingLead` (CSV and Hook Grader via Make→n8n→bridge):

1. Generate personalized email draft (template/NVIDIA) under 120 words, CTA `myntmore.com/founder-meeting`.
2. Persist JSON artifact in Supabase `email_draft_artifacts` (audit/fallback).
3. When `PIPELINE_MODE=live` and Zoho OAuth is configured (`ZOHO_CLIENT_ID` + `ZOHO_CLIENT_SECRET` + `ZOHO_REFRESH_TOKEN`): create **native** Zoho email draft via `__email_drafts`, then verify via GET list.
4. From-address resolution order: `ZOHO_FROM_EMAIL` → `settings/emails/actions/from_addresses` → Lead Owner email.
5. Never call `sendMail` / `/actions/send_mail`.

## Remaining human setup

1. Keep `automation/.env.local` gitignored; never commit refresh/access tokens.
2. Ensure `npm run process:incoming:server` is running whenever Make→n8n should create Zoho drafts.
3. Optionally set `ZOHO_FROM_EMAIL` to a preferred allowed from-address.
4. Do **not** enable auto-send workflows.
