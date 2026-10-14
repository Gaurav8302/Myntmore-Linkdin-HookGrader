# Make.com Task 2 → Task 1 bridge status (2026-10-14 integration fix)

## Live scenario

| Item | Value |
|------|--------|
| Scenario | `Myntmore Task2→Task1 Hook Grader Bridge` |
| Scenario ID | `7960198` |
| Team | `3180839` |
| Webhook URL | Hook Grader `.env.local` → `MAKE_WEBHOOK_URL` (not committed) |
| Status | **Active** (re-activated after URL/JSON fixes) |

## Modules

1. `gateway:CustomWebHook` — Hook Grader outbox shape
2. `http:MakeRequest` — POST → n8n `/webhook/myntmore-hook-grader` via public localtunnel

## Reachability diagnosis and fix

| Check | Result |
|-------|--------|
| Local n8n `RPh6nEfzP2mq7GFj` | Running; webhook `POST /webhook/myntmore-hook-grader` → `{"ok":true}` |
| Prior Make URL | `https://small-signs-go.loca.lt/...` → **503 Tunnel Unavailable** |
| Fix | Started new localtunnel to port `5678`, updated Make HTTP URL to the live hostname, added `bypass-tunnel-reminder: true` |
| JSON body failures | Make `jsonString` body broke on literal newlines in `hook.original` (`Enter valid JSON in the request body`) |
| JSON fix | `{{replace(1.hook.original; newline; space)}}` and safe score default in the HTTP body template |

**Current tunnel hostname changes whenever localtunnel restarts.** Make’s HTTP URL must be updated to match. Prefer Cloudflare Tunnel for a stable hostname if available.

## Controlled E2E (fictional) — verified

| Step | Evidence |
|------|----------|
| Make accepts payload | HTTP 200 Accepted (×2 same idempotency key) |
| Make → n8n | Executions `c788fbabd8db4fb8966a63611bedc1c8` and `1736b75de5614b879b5593b3313c1309` **success** |
| n8n ingest | Workflow `RPh6nEfzP2mq7GFj` executions **25** and **26** **success** |
| Supabase lead | `idempotency_key=idem-e2e-1792006653-0c699510` → lead `7a2d3f63-0326-4669-9956-1b6d050e6192` (hot / score mapped / `zoho_draft_status=dry_run_queued`) |
| Idempotency | Retry produced **1** `leads` row for that key |
| Emails sent | **None** (draft status dry-run only) |

## Remaining dependency

n8n stays **local**. Make requires a **live public tunnel**. When the tunnel dies, Make returns Bad Gateway / scenario may enter `error` until the URL is refreshed and the scenario is re-activated.

### Shortest restore command

```bash
npx localtunnel --port 5678
# Then set Make module "Forward to n8n Task1 ingest" URL to:
# https://<printed-host>/webhook/myntmore-hook-grader
# Re-activate scenario 7960198 if status is error.
```
