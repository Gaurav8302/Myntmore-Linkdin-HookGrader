# Cursor Agent Instructions — Lead Follow-up Automation (Task 1)

**Owner:** Cursor  
**Directory:** `/automation/` (Cursor also owns Task 2 and Make.com — see root `AGENTS.md`)

## Scope

- Task 1 lead follow-up engine
- **n8n as the Task 1 runtime** (orchestrates import → clean → score → route → draft → persist → Zoho draft-only)
- Supporting TypeScript for rules, tests, and local CSV dry-run CLI
- **Make.com Task 2 → Task 1 bridge** (Cursor-owned; configure only after Hook Grader contract verified)

## Rules

- Do not auto-send emails or messages (Zoho drafts only).
- Do not modify `leads.csv`.
- Do not change root `.gitignore` or shared `/supabase/` migrations without Human approval.
- Do not invent Make.com webhook URLs.
- Do not claim live Supabase/Zoho/Gemini/Make work without evidence.
- Preserve OpenCode’s Hook Grader work when coordinating contracts; do not rebuild Task 2 from scratch.

## Runtime

- Primary orchestrator: n8n workflow `RPh6nEfzP2mq7GFj`
- Rules/tests/CLI: `automation/src` + `npm test` / `npm run process:csv`
- Idempotency: `csv_<lead_id>` for CSV; `hook_grader_<session_id>` for Task 2 (via Make.com)
- Interim persistence: n8n Data Table until approved Supabase `leads` migration is applied
