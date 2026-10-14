# Cursor Agent Instructions — LinkedIn Hook Grader (Task 2)

## Scope

**Cursor** is the sole active owner of Task 2: the LinkedIn Hook Grader Next.js application under `/linkedin-hook-grader/`.

OpenCode previously scaffolded and implemented much of this app. Treat that work as **existing code to audit, preserve, and complete** — do not replace it with a fresh scaffold.

Cursor also owns Task 1 (`/automation/`) and the Make.com Task 2 → Task 1 bridge (see root `AGENTS.md`).

## Preserve

- Keep the current Next.js App Router structure, scoring engine, Gemini rewrite path, Supabase queries, outbox/webhook client, UI components, and tests.
- Repair failing tests and gaps incrementally.
- Do not delete OpenCode artifacts without confirming they are unused scratch files.

## Requirements (assignment)

1. Deterministic scoring: 4–6 rules in code, 0–100, same input → same score.
2. Exactly 3 Gemini rewrites via structured JSON / `responseSchema`, Task 1 writing rules.
3. One Supabase session row per grade (contact, hook, score, rewrites).
4. Durable Make.com delivery via outbox + Vercel Cron; idempotency `hook_grader_<session_id>`.
5. Gemini failure → 200 with `fallback=true`; persistence failure → 500.
6. Safe fallbacks: echo submitted hook; never invent metrics/claims.
7. Secrets only in env; never in Git or client bundles.

## Shared / deferred

- Do not apply shared Supabase migrations or invent Make webhook URLs until the contract is verified and Human has approved schema/credentials.
- Coordinate Task 1 `leads` schema (`idempotency_key` TEXT) with Hook Grader outbox payload.
