# Architecture — LinkedIn Hook Grader (Task 2)

**Status:** Implemented and deployed  
**Live URL:** https://myntmore-linkedin-hook-grader.vercel.app

---

## System overview

```
User (landing + form)
       │
       ▼
POST /api/grade-hook
       │
       ├─▶ Deterministic scoring (lib/scoring) → score 0–100
       ├─▶ NVIDIA NIM (lib/gemini path) → exactly 3 rewrites or fallback
       └─▶ Supabase RPC: session + webhook_outbox (atomic)
       │
       ▼
200 JSON to browser (score + rewrites)

Background / flush:
webhook_outbox → MAKE_WEBHOOK_URL (Make.com scenario 7960198)
       → tunnel → n8n Task 1 webhook
```

Make.com is **mandatory** for Task 2 → Task 1. Do not replace with direct n8n calls or shared app imports.

---

## Components

### 1. Next.js application (Vercel)

| Route | Purpose |
|-------|---------|
| `/` | Landing + contact form + hook input + results |
| `POST /api/grade-hook` | Score, rewrite, persist, return results |
| `GET /api/cron/process-webhooks` | Drain pending outbox (auth via cron secret) |

**Deployment root:** `linkedin-hook-grader/`  
**Cron:** `vercel.json` → `0 12 * * *` (Hobby daily). In-request outbox flush also used so deliveries are not blocked on daily cron alone.

### 2. Scoring engine (deterministic)

**Location:** `lib/scoring/` (pure functions, no AI)

Rules: length, curiosity gap, specificity, authority, action, clickbait penalty.  
Same input → same score. See [`SCORING_SPEC.md`](./SCORING_SPEC.md).

### 3. NVIDIA rewrites

**Location:** `lib/gemini/` (directory name retained; client calls NVIDIA NIM)

- Model (live-tested): `meta/llama-3.2-11b-vision-instruct`
- Exactly 3 `{ hook, reason }` objects after validation
- On failure: HTTP 200, `fallback: true`, original hook echoed

Gemini was abandoned after observed 404/quota — [`../../docs/AI_PROVIDER_FAILURES.md`](../../docs/AI_PROVIDER_FAILURES.md).

### 4. Supabase persistence

Tables (see `supabase/migrations/001_hook_grader_schema.sql` and follow-ups):

- `hook_grader_sessions`
- `webhook_outbox`
- `webhook_deliveries`

Atomic RPC inserts session + outbox row with `idempotency_key = hook_grader_<session_id>`.

### 5. Make.com durable delivery

- Env: `MAKE_WEBHOOK_URL` (exact Custom Webhook URL)
- Payload contract: [`API_CONTRACT.md`](./API_CONTRACT.md)
- Task 1 deduplicates on `idempotency_key`
- Bridge ops / tunnel: [`../../docs/MAKE_BRIDGE_STATUS.md`](../../docs/MAKE_BRIDGE_STATUS.md)

---

## Failure handling

| Failure | User impact | Recovery |
|---------|-------------|----------|
| Invalid input | 400 | Fix form fields |
| NVIDIA error | 200 + `fallback: true` | Retry later; session still saved when persistence OK |
| Supabase insert fail | 500 | Retry; no silent success |
| Make delivery fail | None to browser | Outbox retries / cron; session kept |

---

## Environment variables

See [`.env.example`](../.env.example) and the app README. Secrets are server-only except public Supabase URL/anon and `NEXT_PUBLIC_APP_URL`.

---

## Integration status (honest)

| Integration | Notes |
|-------------|-------|
| Vercel deploy | Live URL above (HTTP 200 checked 2026-10-17) |
| Unit tests | 108/108 (2026-10-17) |
| Make.com bridge | Documented E2E 2026-10-15 — requires live tunnel + local n8n |
| NVIDIA | Production path; falls back when unavailable |

Do not claim a full Make → n8n → Zoho path is live unless tunnel, n8n, and bridge server are running.
