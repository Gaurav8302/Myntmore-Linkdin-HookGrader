# Architecture — Myntmore LinkedIn Hook Grader (Task 02) + Task 01 Integration

**Status:** Proposed — awaiting approval before implementation  
**Scope:** Task 02 (primary) with explicit Task 01 integration via Make.com webhook

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        USER FLOW (Task 02)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐   │
│  │ Landing │───▶│ Contact Form │───▶│ Hook Grader │───▶│   Results    │   │
│  │  Page   │    │ (name, title,│    │  (2 lines)  │    │ (score + 3   │   │
│  └─────────┘    │  email)      │    └──────┬──────┘    │  rewrites)   │   │
│                 └──────────────┘           │           └──────┬───────┘   │
│                                            │                  │           │
│                                            ▼                  ▼           │
│                                   ┌──────────────┐    ┌──────────────┐   │
│                                   │  Scoring     │    │   Gemini     │   │
│                                   │  Engine      │    │  (3 rewrites │   │
│                                   │  (4-6 rules,  │    │  as JSON)    │   │
│                                   │  deterministic)│   └──────────────┘   │
│                                   └──────┬───────┘           │           │
│                                          │                   │           │
│                                          ▼                   ▼           │
│                                 ┌─────────────────────────────────┐    │
│                                 │  Atomic Supabase Transaction    │    │
│                                 │  (session + outbox in one RPC)  │    │
│                                 └──────────────┬──────────────────┘    │
│                                                │                        │
│                                                ▼                        │
│                                 ┌─────────────────────────────────┐    │
│                                 │  Make.com Webhook (Task 01)     │    │
│                                 │  POST to MAKE_WEBHOOK_URL       │    │
│                                 └─────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Next.js Application (Vercel)

| Route | Purpose | Method |
|-------|---------|--------|
| `/` | Landing + contact form + hook input + results | GET/POST |
| `/api/grade-hook` | Score hook, call Gemini, save to Supabase atomically, return results | POST |
| `/api/cron/process-webhooks` | Vercel Cron: process pending webhook outbox | GET |

**Deployment:** Vercel (project root = `linkedin-hook-grader/`)

### 2. Scoring Engine (Deterministic, In-Code)

**Location:** `lib/scoring.ts` (pure functions, no external deps)

**Rules (4–6, configurable):**
1. **Hook length** — Optimal range (e.g., 80–160 chars for two lines)
2. **Question or curiosity gap** — Contains `?` or curiosity-triggering words
3. **Specificity** — Contains numbers, names, timeframes, or concrete outcomes
4. **Authority signal** — "I", "we", "my team", "my company" + result/claim
5. **Action orientation** — Starts with verb or implies reader action
6. **Negative rule (penalty)** — Clickbait patterns, all caps, excessive punctuation

**Output:**
```typescript
interface ScoreResult {
  score: number;           // 0-100
  failedRules: string[];   // One line per failed rule
  passedRules: string[];   // For transparency
}
```

**Determinism guarantee:** Same input → same score. No randomness, no AI.

### 3. Gemini Integration (Structured Output)

**Model:** `gemini-2.5-flash` (Google AI Studio free tier)

**Prompt template:** Follows Task 01 writing rules:
- No jargon, no em dashes
- No invented numbers/claims
- Under 120 words per rewrite
- Only `myntmore.com/founder-meeting` as CTA link

**Response schema (enforced via `responseSchema`):**
```json
{
  "type": "object",
  "properties": {
    "rewrites": {
      "type": "array",
      "minItems": 3,
      "maxItems": 3,
      "items": {
        "type": "object",
        "properties": {
          "hook": { "type": "string" },
          "reason": { "type": "string" }
        },
        "required": ["hook", "reason"]
      }
    }
  },
  "required": ["rewrites"]
}
```

**Error handling:** Retry once on schema violation. Fallback: return original hook with "AI unavailable" note.

### 4. Supabase Persistence (Atomic Transaction)

**Tables:** `hook_grader_sessions` + `webhook_outbox`

```sql
-- Hook Grader sessions
CREATE TABLE hook_grader_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Contact info
  name TEXT NOT NULL,
  designation TEXT,
  email TEXT NOT NULL,
  
  -- Hook input
  original_hook TEXT NOT NULL,
  
  -- Scoring
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  failed_rules TEXT[],
  passed_rules TEXT[],
  
  -- Gemini rewrites (or fallback)
  rewrite_1 TEXT NOT NULL,
  rewrite_1_reason TEXT NOT NULL,
  rewrite_2 TEXT NOT NULL,
  rewrite_2_reason TEXT NOT NULL,
  rewrite_3 TEXT NOT NULL,
  rewrite_3_reason TEXT NOT NULL,
  
  -- Metadata
  ip_hash TEXT,
  user_agent TEXT,
  processing_ms INTEGER
);

CREATE INDEX idx_hook_grader_email ON hook_grader_sessions(email);
CREATE INDEX idx_hook_grader_created ON hook_grader_sessions(created_at DESC);

-- Webhook outbox (durable delivery queue)
CREATE TABLE webhook_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  session_id UUID NOT NULL REFERENCES hook_grader_sessions(id),
  idempotency_key TEXT NOT NULL UNIQUE,  -- e.g., 'hook_grader_<session_id>'
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'dead_letter')),
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_webhook_outbox_status ON webhook_outbox(status, next_retry_at);
CREATE INDEX idx_webhook_outbox_session ON webhook_outbox(session_id);

-- Webhook delivery log (per-attempt)
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  outbox_id UUID NOT NULL REFERENCES webhook_outbox(id),
  attempt INTEGER NOT NULL,
  status_code INTEGER,
  success BOOLEAN NOT NULL,
  error TEXT,
  response_body TEXT
);

CREATE INDEX idx_webhook_deliveries_outbox ON webhook_deliveries(outbox_id);
```

**Atomic persistence (RPC function):**
```sql
-- Single transaction: insert session + outbox row
CREATE OR REPLACE FUNCTION insert_hook_grader_session(
  p_name TEXT,
  p_designation TEXT,
  p_email TEXT,
  p_original_hook TEXT,
  p_score INTEGER,
  p_failed_rules TEXT[],
  p_passed_rules TEXT[],
  p_rewrite_1 TEXT,
  p_rewrite_1_reason TEXT,
  p_rewrite_2 TEXT,
  p_rewrite_2_reason TEXT,
  p_rewrite_3 TEXT,
  p_rewrite_3_reason TEXT,
  p_ip_hash TEXT,
  p_user_agent TEXT,
  p_processing_ms INTEGER,
  p_idempotency_key TEXT,
  p_payload JSONB
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO hook_grader_sessions (
    name, designation, email, original_hook, score,
    failed_rules, passed_rules,
    rewrite_1, rewrite_1_reason,
    rewrite_2, rewrite_2_reason,
    rewrite_3, rewrite_3_reason,
    ip_hash, user_agent, processing_ms
  ) VALUES (
    p_name, p_designation, p_email, p_original_hook, p_score,
    p_failed_rules, p_passed_rules,
    p_rewrite_1, p_rewrite_1_reason,
    p_rewrite_2, p_rewrite_2_reason,
    p_rewrite_3, p_rewrite_3_reason,
    p_ip_hash, p_user_agent, p_processing_ms
  ) RETURNING id INTO v_session_id;

  INSERT INTO webhook_outbox (session_id, idempotency_key, payload, status, next_retry_at)
  VALUES (v_session_id, p_idempotency_key, p_payload, 'pending', NOW());

  RETURN v_session_id;
END;
$$;
```

**Row = one complete session** (contact + hook + score + 3 rewrites) with guaranteed outbox entry.

### 5. Make.com Webhook (Task 02 → Task 01) — Durable Delivery

**Endpoint:** `MAKE_WEBHOOK_URL` environment variable (exact URL from Make.com, no path appended)

**Trigger:** Vercel Cron processes `webhook_outbox` every minute

**Payload:**
```json
{
  "session_id": "uuid",
  "timestamp": "2026-10-14T12:00:00Z",
  "idempotency_key": "hook_grader_<session_id>",
  "contact": {
    "name": "John Doe",
    "designation": "Founder",
    "email": "john@example.com"
  },
  "hook": {
    "original": "I grew my ARR from 0 to 1M in 12 months. Here's how.",
    "score": 87,
    "failed_rules": ["No question or curiosity gap"],
    "passed_rules": ["Specificity", "Authority signal", "Action orientation"]
  },
  "rewrites": [
    { "hook": "How I took ARR from 0 to 1M in 12 months — the exact playbook", "reason": "Adds curiosity gap with 'how'" },
    { "hook": "0 to 1M ARR in 12 months: the 3-channel strategy that worked", "reason": "Leads with specific outcome, promises structure" },
    { "hook": "My 12-month roadmap to 1M ARR (steal this)", "reason": "Direct, action-oriented, implies generosity" }
  ]
}
```

**Durable delivery mechanism (Vercel-compatible):**
- **Outbox pattern**: Atomic RPC inserts session + outbox row with `status = 'pending'`
- **Background processor**: Vercel Cron Job runs every minute (`* * * * *`), picks up pending deliveries
- **Retry schedule (minute-aligned, UNVERIFIED for sub-minute precision):**
  - Attempt 1: ~1 minute after creation
  - Attempt 2: ~5 minutes after creation
  - Attempt 3: ~15 minutes after creation
  - Attempt 4: ~30 minutes after creation
  - Attempt 5: ~60 minutes after creation
  - *Note: Sub-minute retries (1s, 5s, 30s) are NOT achievable with Vercel Cron alone. A dedicated worker or queue service would be needed for true exponential backoff.*
- **Idempotency key**: `hook_grader_<session_id>` sent in payload; Task 1 deduplicates on this key
- **Persistent attempt records**: Every attempt logged to `webhook_deliveries` with timestamp, status code, error
- **Dead letter**: After 5 failures, mark `status = 'dead_letter'`; alert via Supabase Realtime/webhook to monitoring

**Failure handling:**
- Webhook failure **never erases** the successfully saved Hook Grader session
- User response returned immediately after atomic Supabase transaction (webhook is async)
- Retry logic runs independently of request/response cycle
- Delivery considered "reliable" only after successful 2xx response confirmed in logs

**Task 1 deduplication behavior:**
- Make.com scenario checks `idempotency_key` against existing `leads.external_id` or dedicated `idempotency_keys` table
- If duplicate: return 200 OK, no new lead created
- If new: proceed with cleaning → scoring → email → routing pipeline

### 6. Task 01 Integration (Receiving Side)

**Make.com scenario** (owned by Task 01):
- Receives webhook at the configured Make.com webhook URL
- Treats as new lead with `source = 'hook_grader'`
- Runs same cleaning → scoring → email → routing pipeline
- Output: Zoho CRM entry + Supabase lead row

**Contract:** Task 02 webhook payload must match Task 01 expected lead format. See `API_CONTRACT.md`.

---

## Data Flow Summary

```
User submits hook
       │
       ▼
┌──────────────────┐
│ Validate contact │──Fail──▶ Return 400
│ + hook input     │
└────────┬─────────┘
         │ OK
         ▼
┌──────────────────┐
│ Deterministic    │
│ Scoring Engine   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Gemini (3        │──Fail──▶ Fallback rewrites (still 200 OK)
│ rewrites, JSON)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│ Atomic Supabase RPC:         │──Fail──▶ Return 500, log error
│ session + outbox in one txn  │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Return results to user (200) │
└──────────────────────────────┘

Background (Vercel Cron, every 1 min):
┌──────────────────────────────┐
│ Pick pending from outbox     │
│ (status=pending, next_retry  │
│  <= NOW)                     │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ POST to MAKE_WEBHOOK_URL     │──Fail──▶ Increment attempt,
│ with idempotency_key         │         update next_retry_at,
│                              │         log to webhook_deliveries
└──────────────┬───────────────┘
               │ 2xx
               ▼
┌──────────────────────────────┐
│ Mark outbox delivered        │
│ Log delivery success         │
└──────────────────────────────┘
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side inserts (API route) |
| `GEMINI_API_KEY` | Yes | Google AI Studio key |
| `MAKE_WEBHOOK_URL` | Yes | **Exact Make.com webhook URL** (no path appended) |
| `MAKE_WEBHOOK_SECRET` | Optional | HMAC secret for verification |
| `NEXT_PUBLIC_APP_URL` | Yes | Vercel deployment URL |
| `WEBHOOK_CRON_SECRET` | Yes | Vercel Cron authentication secret |

---

## Failure Handling Matrix

| Failure Point | User Impact | Recovery | Monitoring |
|---------------|-------------|----------|------------|
| Invalid input | 400 error, inline message | Re-enter | Log validation errors |
| Scoring engine bug | 500 error | Code fix + deploy | Unit tests, error tracking |
| Gemini API error | Fallback rewrites shown (200 OK with `fallback=true`) | Retry once, then fallback | Alert on repeated failures |
| Supabase atomic insert fail | 500 error | Retry, alert on-call | PagerDuty/Slack alert |
| Webhook outbox write fail | Impossible (atomic with session) | N/A | N/A |
| Make webhook delivery fail | None (async, bounded retries) | Retry up to 5x (minute-aligned) | `webhook_deliveries` table, dead letter alert |
| Vercel deploy fail | N/A | GitHub Actions check | Deployment status |

---

## Security Considerations

- **No secrets in client bundle** — All API keys server-side only
- **Supabase RLS** — `hook_grader_sessions` insert via service role key in API route only (RPC)
- **Rate limiting** — Vercel Edge middleware or Supabase rate limit (e.g., 10 req/min/IP)
- **Input sanitization** — Hook text trimmed, max 500 chars, XSS-safe rendering
- **Email validation** — RFC 5322 compliant, no disposable domains (optional)
- **PII** — IP hashed, no raw storage; email stored for lead follow-up only

---

## Integration Status (UNVERIFIED)

| Integration | Status | Notes |
|-------------|--------|-------|
| Supabase (PostgreSQL) | UNVERIFIED | Requires project + keys |
| Google Gemini 2.5 Flash | UNVERIFIED | Requires API key |
| Make.com webhook | UNVERIFIED | Requires Make.com scenario + URL |
| Vercel Cron | UNVERIFIED | Requires Vercel project + deploy |
| Atomic RPC function | UNVERIFIED | Requires Supabase SQL execution |
| End-to-end flow | UNVERIFIED | Requires all above |

> **Do not claim any integration is working until tested with real credentials.**

---

## Distinction Flag: Make.com vs Alternatives

| Context | Specification |
|---------|---------------|
| General stack (page 1) | "Make, Zapier, n8n, etc." — alternatives permitted |
| Task 02 requirement (page 2) | "**Send it to your Task 01 scenario through a Make.com webhook**" — explicit |

**Decision:** Implement Make.com webhook as specified. Document that Task 01 automation platform choice is independent. **The Make.com bridge is mandatory and must not be replaced by n8n or direct imports.**