# API Contract — Myntmore Hook Grader (Task 02)

**Status:** Provisional — awaiting approval from both agents  
**Version:** 1.2-draft  
**Base URL:** `https://<vercel-deployment>.vercel.app` (production) / `http://localhost:3000` (local)

---

## POST /api/grade-hook

Grades a LinkedIn hook, generates rewrites, persists session atomically with outbox entry, returns results.

### Request

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "name": "string (1-100 chars, required)",
  "designation": "string (0-100 chars, optional)",
  "email": "string (valid email, required)",
  "hook": "string (2-500 chars, required)"
}
```

**Validation Rules:**
| Field | Required | Min | Max | Pattern |
|-------|----------|-----|-----|---------|
| name | Yes | 1 | 100 | `.+` |
| designation | No | 0 | 100 | — |
| email | Yes | 5 | 254 | RFC 5322 (loose) |
| hook | Yes | 2 | 500 | `.{2,}` |

### Success Response (200) — Normal Result

```json
{
  "sessionId": "uuid-v4",
  "score": 87,
  "failedRules": [
    "No question or curiosity gap detected"
  ],
  "passedRules": [
    "Optimal length (80-160 chars)",
    "Contains specific numbers/timeframes",
    "First-person authority signal present",
    "Action-oriented language"
  ],
  "rewrites": [
    {
      "hook": "How I took ARR from 0 to 1M in 12 months — the exact playbook",
      "reason": "Adds curiosity gap with 'How' while keeping the specific outcome"
    },
    {
      "hook": "0 to 1M ARR in 12 months: the 3-channel strategy that worked",
      "reason": "Leads with specific outcome, promises structured breakdown"
    },
    {
      "hook": "My 12-month roadmap to 1M ARR (steal this)",
      "reason": "Direct, action-oriented, implies generosity and reproducibility"
    }
  ],
  "fallback": false
}
```

### Success Response (200) — Fallback Result (Gemini Failed, Session Saved)

```json
{
  "sessionId": "uuid-v4",
  "score": 87,
  "failedRules": [
    "No question or curiosity gap detected"
  ],
  "passedRules": [
    "Optimal length (80-160 chars)",
    "Contains specific numbers/timeframes",
    "First-person authority signal present",
    "Action-oriented language"
  ],
  "rewrites": [
    {
      "hook": "<submitted-hook-text>",
      "reason": "AI unavailable — original hook shown"
    },
    {
      "hook": "<submitted-hook-text>",
      "reason": "AI unavailable — original hook shown"
    },
    {
      "hook": "<submitted-hook-text>",
      "reason": "AI unavailable — original hook shown"
    }
  ],
  "fallback": true,
  "fallbackReason": "GEMINI_TIMEOUT|GEMINI_SCHEMA_ERROR|GEMINI_RATE_LIMIT|GEMINI_UNAVAILABLE"
}
```

**Field Guarantees:**
| Field | Type | Constraints |
|-------|------|-------------|
| sessionId | string | UUID v4 |
| score | integer | 0–100 inclusive |
| failedRules | string[] | 0–6 items, each non-empty, one line |
| passedRules | string[] | 0–6 items, each non-empty, one line |
| rewrites | object[] | Exactly 3 items |
| rewrites[].hook | string | 1–280 chars |
| rewrites[].reason | string | 1–200 chars |
| fallback | boolean | `true` = Gemini failed, submitted hook echoed; `false` = normal |
| fallbackReason | string | Present only when `fallback=true`: `GEMINI_TIMEOUT`, `GEMINI_SCHEMA_ERROR`, `GEMINI_RATE_LIMIT`, `GEMINI_UNAVAILABLE` |

**Semantics:**
- **200 + `fallback=false`**: Normal success, all systems operational
- **200 + `fallback=true`**: Session saved atomically with outbox, Gemini failed → safe fallback returned (submitted hook echoed, no fabricated claims)
- **500**: Persistence failed (atomic transaction failed), no session created
- **400**: Validation failed, no session created

> **Safe fallback guarantee:** Fallback rewrites echo the **submitted hook text dynamically**. They never fabricate metrics, ARR, customer counts, results, or business claims.

### Error Responses

#### 400 Bad Request — Validation Failed
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request body",
  "details": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "hook", "message": "Hook must be at least 2 characters" }
  ]
}
```

#### 429 Too Many Requests — Rate Limited
```json
{
  "error": "RATE_LIMITED",
  "message": "Too many requests. Try again in 60 seconds.",
  "retryAfter": 60
}
```

#### 500 Internal Server Error — Persistence Failed
```json
{
  "error": "PERSISTENCE_FAILED",
  "message": "Failed to save session. Please try again.",
  "requestId": "uuid-v4"
}
```

> **Note:** Gemini failures no longer return 503. They return 200 with `fallback=true`. Only Supabase atomic persistence failures return 500.

#### 503 Service Unavailable — Service Overloaded (Rare)
```json
{
  "error": "SERVICE_UNAVAILABLE",
  "message": "Service temporarily overloaded. Please try again.",
  "retryAfter": 30
}
```

---

## Webhook: Task 02 → Task 01 (Make.com) — Durable Delivery

**Endpoint:** `MAKE_WEBHOOK_URL` environment variable (**exact URL from Make.com, no path appended**)

**Configured in:** Make.com scenario (Human)  
**Called by:** Vercel Cron background processor (every 1 minute), NOT inline in request

### Request Payload

```json
{
  "session_id": "uuid-v4",
  "timestamp": "2026-10-14T12:34:56.789Z",
  "idempotency_key": "hook_grader_<session_id>",
  "source": "hook_grader",
  "contact": {
    "name": "John Doe",
    "designation": "Founder & CEO",
    "email": "john@example.com"
  },
  "hook": {
    "original": "I grew my ARR from 0 to 1M in 12 months. Here's how.",
    "score": 87,
    "failed_rules": [
      "No question or curiosity gap detected"
    ],
    "passed_rules": [
      "Optimal length (80-160 chars)",
      "Contains specific numbers/timeframes",
      "First-person authority signal present",
      "Action-oriented language"
    ]
  },
  "rewrites": [
    {
      "hook": "How I took ARR from 0 to 1M in 12 months — the exact playbook",
      "reason": "Adds curiosity gap with 'How' while keeping the specific outcome"
    },
    {
      "hook": "0 to 1M ARR in 12 months: the 3-channel strategy that worked",
      "reason": "Leads with specific outcome, promises structured breakdown"
    },
    {
      "hook": "My 12-month roadmap to 1M ARR (steal this)",
      "reason": "Direct, action-oriented, implies generosity and reproducibility"
    }
  ],
  "metadata": {
    "ip_hash": "sha256-hex",
    "user_agent": "Mozilla/5.0...",
    "processing_ms": 1247
  }
}
```

### Delivery Mechanism
- **Not inline**: Webhook is NOT fired in the API request path
- **Atomic outbox**: Session + outbox row inserted in single PostgreSQL RPC transaction
- **Vercel Cron**: Runs every minute (`* * * * *`), processes pending outbox rows
- **Retry schedule (minute-aligned, UNVERIFIED for sub-minute precision):**
  - Attempt 1: ~1 minute after creation
  - Attempt 2: ~5 minutes after creation
  - Attempt 3: ~15 minutes after creation
  - Attempt 4: ~30 minutes after creation
  - Attempt 5: ~60 minutes after creation
  - *Note: Sub-minute retries (1s, 5s, 30s) are NOT achievable with Vercel Cron alone. A dedicated worker or queue service would be needed for true exponential backoff.*
- **Max attempts**: 5 (configurable via `max_attempts` column)
- **Idempotency key**: `hook_grader_<session_id>` — Task 1 MUST deduplicate on this

### Expected Response (Make.com)
- **2xx** — Success, outbox marked `delivered`, logged to `webhook_deliveries`
- **4xx/5xx** — Retry per policy (max 5 attempts, minute-aligned schedule)
- **Timeout (10s)** — Retry
- **After 5 failures** — Outbox marked `dead_letter`, alert triggered

### Headers
```
Content-Type: application/json
X-Myntmore-Signature: sha256=<hmac-of-body>  // If MAKE_WEBHOOK_SECRET set
X-Myntmore-Timestamp: 1728912000
X-Myntmore-Idempotency-Key: hook_grader_<session_id>
```

### Task 1 Deduplication (Make.com Responsibility)
- Check `idempotency_key` against existing leads (e.g., `leads.external_id` or dedicated table)
- If exists: return 200 OK, no new lead created
- If new: proceed with cleaning → scoring → email → routing pipeline

---

## Environment Variables

| Variable | Scope | Required | Example |
|----------|-------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Yes | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Yes | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Yes | `eyJ...` |
| `GEMINI_API_KEY` | Server only | Yes | `AIza...` |
| `MAKE_WEBHOOK_URL` | Server only | Yes | **Exact Make.com webhook URL** (no path appended) |
| `MAKE_WEBHOOK_SECRET` | Server only | No | `whsec_...` (for HMAC) |
| `NEXT_PUBLIC_APP_URL` | Client + Server | Yes | `https://myntmore-hook-grader.vercel.app` |
| `RATE_LIMIT_MAX` | Server only | No | `10` (req/window) |
| `RATE_LIMIT_WINDOW_MS` | Server only | No | `60000` (1 min) |
| `WEBHOOK_CRON_SECRET` | Server only | Yes | `vercel-cron-secret` (for Vercel Cron auth) |

---

## Supabase Schema (Reference)

### `hook_grader_sessions`
```sql
CREATE TABLE hook_grader_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  designation TEXT,
  email TEXT NOT NULL,
  original_hook TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  failed_rules TEXT[],
  passed_rules TEXT[],
  rewrite_1 TEXT NOT NULL,
  rewrite_1_reason TEXT NOT NULL,
  rewrite_2 TEXT NOT NULL,
  rewrite_2_reason TEXT NOT NULL,
  rewrite_3 TEXT NOT NULL,
  rewrite_3_reason TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  processing_ms INTEGER
);

CREATE INDEX idx_hook_grader_email ON hook_grader_sessions(email);
CREATE INDEX idx_hook_grader_created ON hook_grader_sessions(created_at DESC);
```

### `webhook_outbox` (Durable Delivery Queue)
```sql
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
```

### `webhook_deliveries` (Per-Attempt Log)
```sql
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

### Atomic RPC Function
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

---

## Task 01 Compatibility (Make.com → Task 1 Bridge)

The Make.com scenario receives the webhook and bridges into Task 1's automation (which may use n8n, Make, or Zapier). The webhook **must use Make.com** per Task 02 explicit requirement.

### Make.com Scenario Responsibilities
1. **Receive** webhook at the configured URL with `idempotency_key`
2. **Deduplicate** on `idempotency_key` (check `leads.external_id` or dedicated table)
3. **Transform** payload to Task 1 lead format
4. **Forward** to Task 1 automation (n8n webhook, Make.com scenario, or Zapier catch hook)

### Payload Transformation (Hook Grader → Task 1 Lead)

| Hook Grader Payload | Task 1 Lead Format |
|---------------------|-------------------|
| `session_id` | `external_id` = `session_id` |
| `idempotency_key` | `idempotency_key` (for Task 1 deduplication) |
| `timestamp` | `created_at` |
| `source` | `source` = `'hook_grader'` |
| `contact.name` | `name` |
| `contact.designation` | `designation` |
| `contact.email` | `email` |
| `hook.original` | `input_data->>'hook'` |
| `hook.score` | `input_data->>'hook_score'` |
| `hook.failed_rules` | `input_data->>'failed_rules'` |
| `hook.passed_rules` | `input_data->>'passed_rules'` |
| `rewrites` | `output_data->'rewrites'` |
| `metadata` | `metadata` |

### If Task 1 Uses n8n
- Make.com scenario calls n8n webhook endpoint with transformed payload
- n8n handles cleaning → scoring → email → routing → Zoho CRM + Supabase
- **Make.com remains the required bridge** — Task 02 webhook hits Make.com first

### If Task 1 Uses Make.com
- Make.com scenario routes to next scenario in same Make.com account
- Same transformation, internal routing

### If Task 1 Uses Zapier
- Make.com scenario calls Zapier catch hook URL
- **Make.com remains the required bridge** — Task 02 webhook hits Make.com first

**OpenCode provides:** This mapping spec and sample payload.  
**Human configures:** Make.com scenario + Task 1 automation connection.  
**Cursor tests:** End-to-end flow verification.

---

## Integration Status (UNVERIFIED)

| Integration | Status | Notes |
|-------------|--------|-------|
| Supabase (PostgreSQL + RPC) | UNVERIFIED | Requires project + keys + SQL execution |
| Google Gemini 2.5 Flash | UNVERIFIED | Requires API key |
| Make.com webhook | UNVERIFIED | Requires Make.com scenario + URL |
| Vercel Cron | UNVERIFIED | Requires Vercel project + deploy |
| Atomic RPC transaction | UNVERIFIED | Requires Supabase SQL execution |
| End-to-end flow | UNVERIFIED | Requires all above |

> **Do not claim any integration is working until tested with real credentials.**

---

## Versioning & Changes

| Version | Date | Changes | Approved By |
|---------|------|---------|-------------|
| 1.0-draft | 2026-10-14 | Initial contract | — |
| 1.1-draft | 2026-10-14 | Durable webhook delivery, fallback semantics, idempotency keys, outbox pattern | — |
| 1.2-draft | 2026-10-14 | Atomic RPC, minute-aligned retries, safe fallback, MAKE_WEBHOOK_URL exact, UNVERIFIED status | — |

**Change process:** Both agents must approve any breaking changes. Add version to URL if needed (`/api/v2/grade-hook`).