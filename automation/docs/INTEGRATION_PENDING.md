# Integration requirements still pending from OpenCode / Human

## Ownership clarification

- **Cursor** owns Task 1 (`automation/`) **and** the mandatory Make.com Task 2 → Task 1 bridge.
- Make.com configuration remains **deferred** until OpenCode completes the Hook Grader and confirms the integration contract.
- **n8n** is the Task 1 automation runtime (orchestrates end-to-end). Supporting TypeScript under `automation/src/` is the rules engine and local dry-run CLI.

## Deferred (do not implement yet)

- Make.com scenario or webhook URL for Task 2 → Task 1
- Live Hook Grader outbox delivery testing
- Any code under `linkedin-hook-grader/`

## Needed from OpenCode (when Hook Grader works)

Do **not** invent these values. Wait for confirmation:

1. **Confirmed webhook payload** matching `linkedin-hook-grader/docs/API_CONTRACT.md` (still provisional).
2. **Sample real payload** from a successful grade-hook + outbox enqueue.
3. **Final `idempotency_key` format** confirmation (`hook_grader_<session_id>` expected).
4. **HMAC headers** (`X-Myntmore-Signature` etc.) — required or optional?
5. **Stable field names** for Make.com → Task 1 / n8n transform.
6. Notification when `/api/grade-hook` + cron outbox processor pass tests.
7. Exact Make.com webhook URL will be created by **Cursor** after contract confirmation (not guessed now).

## Needed from Human

1. Approve `docs/SCHEMA_PROPOSAL.md` migration text for `002_task1_leads_schema.sql`.
2. Supabase project URL + service role key (for live persistence beyond n8n Data Table).
3. Zoho CRM OAuth/token with **draft-only** permission.
4. Optional: n8n credential for Gemini HTTP Request (today’s n8n path uses validated template fallback; local CLI can use `automation/.env.local` with `GEMINI_MODEL` override — assignment `gemini-2.5-flash` returns 404 for new Google AI Studio keys; `gemini-3.8-flash` works but may 503 under load).
5. Approve smallest root `.gitignore` fix so `leads.csv` can be submitted publicly (see `GITIGNORE_CONFLICT.md`).
6. Rotate the Gemini API key after this chat (it was pasted in chat history).

## What Task 1 already accepts independently

- n8n workflow: CSV dry-run → clean → score → route → draft → Data Table upsert → summary
- Local CLI: `npm run process:csv` against root `leads.csv`
- Separable future Make.com → n8n webhook adapter (same fields / `idempotency_key`)
