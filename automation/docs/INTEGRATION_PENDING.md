# Integration notes (status vs pending)

**Updated:** 2026-10-17 — superseded the older “Make deferred / wait for OpenCode” framing.

## Ownership

- **Cursor** owns Task 1 (`automation/`) and the Make.com Task 2 → Task 1 bridge.
- **n8n** is the Task 1 automation runtime.
- Supporting TypeScript under `automation/src/` is the rules engine and local dry-run CLI.

## Done (with evidence links)

| Item | Evidence |
|------|----------|
| Make.com scenario Task2→1 | [`../../docs/MAKE_BRIDGE_STATUS.md`](../../docs/MAKE_BRIDGE_STATUS.md) — scenario `7960198` |
| Hook Grader → Make outbox | Deployed app + outbox/cron; unit tests 108/108 |
| n8n webhook ingest path | `/webhook/myntmore-hook-grader` |
| Zoho native draft-only (OAuth) | [`ZOHO_DRAFT_CAPABILITY.md`](./ZOHO_DRAFT_CAPABILITY.md) |
| CSV dry-run accounting | Hot 12 / Warm 2 / Not a fit 6 (2026-10-17 CLI) |

## Still operationally fragile / pending

1. **Tunnel hostname** — Cloudflare Quick Tunnel / localtunnel URLs change; Make forward URL must be edited manually (no sync from `.env.local`).
2. **Incoming bridge process** — `npm run process:incoming:server` must be running for Make → n8n → Zoho native drafts.
3. **Automation typecheck** — duplicate `processIncomingLead` export in `src/index.ts`.
4. **One unit test** — Zoho Notes-mode fallback expects `created`, gets `skipped`.
5. **Hobby Cron** — outbox cron is daily (`0 12 * * *`); rely on in-request flush for demo latency.

## Human checklist

1. Keep secrets in gitignored `.env.local` only.
2. Refresh Make → n8n URL after tunnel restart (`npm run print:n8n-ingest-url`).
3. Do not enable Zoho auto-send workflows.
4. Rotate any keys that were ever pasted into chat history.

## What Task 1 accepts independently

- n8n CSV dry-run → clean → score → route → draft → upsert → summary
- Local CLI: `PIPELINE_MODE=dry_run npm run process:csv` against root `leads.csv`
- Make → n8n webhook adapter with `idempotency_key` (`hook_grader_<session_id>`)
