# Make.com Task 2 → Task 1 bridge status (2026-10-14)

## Live scenario

| Item | Value |
|------|--------|
| Scenario | `Myntmore Task2→Task1 Hook Grader Bridge` |
| Scenario ID | `7960198` |
| Team | `3180839` |
| Webhook URL | Hook Grader `.env.local` → `MAKE_WEBHOOK_URL` (not committed) |
| Status | **Active** |

## Modules

1. `gateway:CustomWebHook` — learned Hook Grader outbox shape
2. `http:MakeRequest` — POST → n8n `/webhook/myntmore-hook-grader` (via public tunnel)

## Verified end-to-end (fictional)

| Step | Evidence |
|------|----------|
| Make accepts Hook Grader payload | HTTP 200 Accepted |
| Make → n8n | Execution `39553a106c46407c9899325b86b49369` **success** |
| n8n ingest | Workflow `RPh6nEfzP2mq7GFj` execution **13** success |
| Supabase lead | `hook_grader_72737bbb-…` hot / score 9 / `zoho_draft_status=dry_run_queued` |
| Hook Grader outbox → Make | Cron delivered 2 pending outbox rows (`processed:2, delivered:2`) |

Earlier failures: broken `SetVariables` (removed); localtunnel Bad Gateway when tunnel died (URL must be refreshed).

## Durability blocker

n8n is local + **localtunnel**. Tunnel hostname changes on restart; update Make HTTP URL (or replace with stable Cloudflare Tunnel / hosted n8n) before treating the bridge as production-stable.

## Re-check 2026-10-14 (final UI iteration)

| Check | Result |
|-------|--------|
| n8n workflow `RPh6nEfzP2mq7GFj` | Active; webhook `POST /webhook/myntmore-hook-grader` returns 200 locally |
| Make module HTTP URL | `https://small-signs-go.loca.lt/webhook/myntmore-hook-grader` |
| Tunnel reachability | **503 Tunnel Unavailable** — Make cannot reach n8n until a new public tunnel is started and the Make URL is updated |
| Controlled Make→n8n E2E this pass | **Not run** (blocked by dead tunnel) |
