# Make.com Task 2 → Task 1 bridge status (2026-10-14 live E2E)

## Live scenario

| Item | Value |
|------|--------|
| Scenario | `Myntmore Task2→Task1 Hook Grader Bridge` |
| Scenario ID | `7960198` |
| Team | `3180839` |
| Hook Grader production | `https://myntmore-linkedin-hook-grader.vercel.app` |
| Make webhook | Hook Grader `MAKE_WEBHOOK_URL` (Vercel + local `.env.local`, not committed) |
| n8n workflow | `RPh6nEfzP2mq7GFj` (local) |
| Status | Make scenario **active**; n8n forward URL must match a **live** public tunnel |

## Modules

1. `gateway:CustomWebHook` — Hook Grader outbox payload (`session_id`, `timestamp`, `idempotency_key`, `source`, `contact`, `hook`, `rewrites`, `metadata`)
2. `http:MakeRequest` — POST → n8n `/webhook/myntmore-hook-grader` via public tunnel + `bypass-tunnel-reminder: true`

## Field mapping (explicit)

| Source | Destination |
|--------|-------------|
| `contact.name` | `leads.full_name` (+ split `first_name` / `last_name`) |
| `contact.email` | `leads.email` (required) |
| `contact.designation` | `leads.designation` |
| company | **Not collected** by Hook Grader form → `leads.company=null` (noted in metadata) |
| `hook.original` | `leads.tool_input` |
| `hook.score` (0–100) | mapped to Task1 `score` 1–10 + `routing_tier` |
| `idempotency_key` | `leads.idempotency_key` (unique upsert) |
| `session_id` | `leads.external_session_id` + metadata |
| `timestamp` | `metadata.submitted_at` |
| `source` | `leads.source` (`hook_grader`) |

## Controlled E2E (labelled test lead) — traced 2026-10-14

Test contact: `E2E HookGrader Test` / `e2e.hookgrader.20261014T205658Z@example.invalid` (fictional — do not contact).

| Stage | Result | Evidence |
|-------|--------|----------|
| Vercel `POST /api/grade-hook` | **200** | session `6ea0afb5-f8a9-4a9c-9fa9-386a1d21ff0b`, score **83** |
| Supabase `hook_grader_sessions` | **row present** | email + designation + score stored |
| Supabase `webhook_outbox` | **delivered** | idempotency `hook_grader_73e5b2ea-…`; payload `session_id` matches RPC rewrite |
| Make accepts webhook | **Accepted** | execution `e05df120ee26481e804774e1ce7f3c24` received full contact/hook payload |
| Make → n8n (tunnel) | **Blocked / flaky** | Forward module hit **Bad Gateway** / **Too Many Requests** when localtunnel was overloaded or unavailable |
| n8n ingest (local webhook) | **success** | executions **35** / **36**; Normalize + Upsert Lead Supabase |
| Supabase `leads` | **1 row** | idempotent retry kept a single row; contact fields populated |
| Zoho Lead | **created** | `1445645000000553002` Description = qualification block; **no sendMail** |

### Honest end-to-end verdict

- **Production Hook Grader → Supabase session/outbox → Make webhook receive:** verified.
- **Make → local n8n over public tunnel:** **not reliably verified** in this pass (localtunnel 502/503/429 under burst). Payload was completed into n8n/Supabase/Zoho via the same n8n webhook path Make uses (`POST /webhook/myntmore-hook-grader`).
- Until a **stable** tunnel (prefer Cloudflare Tunnel) is pointed in Make module 3, production form submits can queue in Make as pending/error even after Make accepts the Hook Grader webhook.

## Tunnel restore (required for live Make→n8n)

```bash
# Keep n8n on :5678, then:
npx localtunnel --port 5678
# Copy printed host, then set Make module "Forward to n8n Task1 ingest" URL to:
# https://<host>/webhook/myntmore-hook-grader
# Keep header bypass-tunnel-reminder: true
# Prefer: cloudflared tunnel --url http://127.0.0.1:5678
```

Do **not** burst-process large outbox backlogs through free localtunnel; drain pending Make runs after the tunnel is healthy.

## Safety

- Draft-only / qualification display in Zoho Description.
- Never call Zoho `sendMail` / send endpoints.
- Retries upsert on `idempotency_key`.
