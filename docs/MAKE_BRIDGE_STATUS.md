# Make.com Task 2 → Task 1 bridge status (Cloudflare tunnel verify)

## Live scenario

| Item | Value |
|------|--------|
| Scenario | `Myntmore Task2→Task1 Hook Grader Bridge` |
| Scenario ID | `7960198` |
| Team | `3180839` |
| Hook Grader production | `https://myntmore-linkedin-hook-grader.vercel.app` |
| Make webhook (Hook Grader → Make) | `MAKE_WEBHOOK_URL` in Hook Grader / automation `.env.local` (not committed) |
| n8n workflow | `RPh6nEfzP2mq7GFj` (local, active) |
| n8n webhook path | `/webhook/myntmore-hook-grader` |
| Local tunnel base reference | `N8N_PUBLIC_BASE_URL` in `automation/.env.local` |

## Two different URLs (do not confuse)

| Variable / store | Direction | Who owns it |
|------------------|-----------|-------------|
| `MAKE_WEBHOOK_URL` | Hook Grader outbox → Make Custom Webhook | Vercel + local `.env.local` |
| Make module **Forward to n8n Task1 ingest** URL | Make → public tunnel → local n8n | **Make.com scenario only** |
| `N8N_PUBLIC_BASE_URL` + `N8N_WEBHOOK_PATH` | Local reference for the Make→n8n URL | `automation/.env.local` (gitignored) |

Changing `N8N_PUBLIC_BASE_URL` does **not** update Make.com. There is no sync job.

Constructed ingest URL:

```text
${N8N_PUBLIC_BASE_URL}${N8N_WEBHOOK_PATH}
# e.g. https://hash-schema-nyc-lamps.trycloudflare.com/webhook/myntmore-hook-grader
```

Print locally:

```bash
cd automation && npm run print:n8n-ingest-url
```

## Modules

1. `gateway:CustomWebHook` — Hook Grader outbox payload
2. `http:MakeRequest` — POST → `${N8N_PUBLIC_BASE_URL}/webhook/myntmore-hook-grader` + `bypass-tunnel-reminder: true`

## Hostname update procedure (Quick Tunnel changed)

When Cloudflare Quick Tunnel prints a new `https://….trycloudflare.com` host:

1. Edit `automation/.env.local`:
   ```bash
   N8N_PUBLIC_BASE_URL=https://NEW-HOST.trycloudflare.com
   N8N_WEBHOOK_PATH=/webhook/myntmore-hook-grader
   ```
2. Confirm: `cd automation && npm run print:n8n-ingest-url`
3. In Make scenario `7960198`, open module **Forward to n8n Task1 ingest** and set URL to that printed value (keep JSON body + headers). Save / keep scenario **active**.
4. Verify (do not restart services):
   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5678/healthz
   curl -sS -X POST "$N8N_PUBLIC_BASE_URL/webhook/myntmore-hook-grader" \
     -H 'Content-Type: application/json' \
     -H 'bypass-tunnel-reminder: true' \
     -d '{"probe":true,"idempotency_key":"probe_hostname_check"}'
   ```
5. Replay a known Make execution (idempotent lead upsert) or submit one labelled Hook Grader test. Confirm Make success → n8n success → one Supabase `leads` row → Zoho Description only (no `sendMail`).

## Verified 2026-10-15 (Cloudflare Quick Tunnel)

| Check | Result |
|-------|--------|
| n8n `127.0.0.1:5678/healthz` | **200** `{"status":"ok"}` |
| `cloudflared tunnel --url http://127.0.0.1:5678` | running (not restarted) |
| Public host `hash-schema-nyc-lamps.trycloudflare.com` | webhook POST → `{"ok":true}` |
| n8n workflow `RPh6nEfzP2mq7GFj` | **active**; path `myntmore-hook-grader` |
| Make forward URL (before) | **mismatch** → `few-cases-tap.loca.lt` (dead localtunnel) |
| Make forward URL (after) | `https://hash-schema-nyc-lamps.trycloudflare.com/webhook/myntmore-hook-grader` |
| Make replay of E2E payload | exec `ac6c3aa7540e413f926fe1800ccb1c27` **success** (replay of `e05df120…`) |
| n8n webhook run | exec **39** **success**; `Host: hash-schema-nyc-lamps.trycloudflare.com`, `User-Agent: Make/production` |
| Supabase `leads` | **1** row `962ef040-…` for `hook_grader_73e5b2ea-…` (idempotent) |
| Zoho Lead | `1445645000000553002` Description qualification block; **no sendMail** |

## Safety

- Draft-only / qualification display in Zoho Description.
- Never call Zoho `sendMail` / send endpoints.
- Retries upsert on `idempotency_key`.
