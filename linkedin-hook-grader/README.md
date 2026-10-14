# LinkedIn Hook Grader (Task 2)

A Next.js application that grades LinkedIn post hooks deterministically and generates AI-powered rewrites.

## Features

- **Deterministic Scoring**: 6 explicit rules, same input = same score (0-100)
- **AI Rewrites**: 3 structured rewrites from **NVIDIA NIM** (`meta/llama-3.2-11b-vision-instruct`, live-tested)
- **Supabase Persistence**: Atomic session + outbox insert via PostgreSQL RPC
- **Durable Webhook Delivery**: Outbox pattern + Vercel Cron (minute-aligned retries)
- **Safe Fallbacks**: NVIDIA failures return 200 with `fallback: true` and original hook echoed
- **Vercel Ready**: Deploy with project root `linkedin-hook-grader/`
- **Gemini**: abandoned after observed HTTP 404 / quota — see `/docs/AI_PROVIDER_FAILURES.md`

## Quick Start

```bash
cd linkedin-hook-grader
npm install
cp .env.example .env.local
# Edit .env.local with your credentials
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for server |
| `NVIDIA_API_KEY` | Yes | NVIDIA API key (server-only) |
| `NVIDIA_MODEL` | No | Default `meta/llama-3.2-11b-vision-instruct` |
| `MAKE_WEBHOOK_URL` | Yes | Exact Make.com webhook URL |
| `MAKE_WEBHOOK_SECRET` | Optional | HMAC secret for verification |
| `NEXT_PUBLIC_APP_URL` | Yes | Vercel deployment URL |
| `WEBHOOK_CRON_SECRET` | Yes | Vercel Cron auth secret |

## Project Structure

```
linkedin-hook-grader/
├── app/
│   ├── api/
│   │   ├── grade-hook/route.ts          # Main grading endpoint
│   │   └── cron/process-webhooks/route.ts # Vercel Cron processor
│   ├── layout.tsx
│   ├── page.tsx                          # Main UI (landing + form + results)
│   └── globals.css
├── components/
│   ├── HookGraderForm.tsx
│   ├── HookGraderResults.tsx
│   ├── RewriteCard.tsx
│   └── LoadingState.tsx
├── lib/
│   ├── scoring/
│   │   ├── constants.ts      # Configurable weights & thresholds
│   │   ├── rules.ts          # 6 pure rule functions
│   │   ├── index.ts          # Main scoreHook() entry point
│   │   └── __tests__/rules.test.ts
│   ├── gemini/               # (path kept) NVIDIA NIM rewrite client
│   │   ├── client.ts         # NVIDIA chat completions client
│   │   ├── prompt.ts         # System prompt + user template
│   │   ├── rewrite.ts        # Generate rewrites + fallback
│   │   └── __tests__/rewrite.test.ts
│   ├── supabase/
│   │   ├── server.ts         # Service-role client
│   │   ├── types.ts          # TypeScript interfaces
│   │   └── queries.ts        # Atomic RPC + outbox helpers
│   └── webhook/
│       ├── make.ts           # Make.com delivery client
│       ├── outbox.ts         # Cron processor
│       └── __tests__/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API_CONTRACT.md
│   └── SCORING_SPEC.md
├── e2e/
│   └── hook-grader.spec.ts
├── vercel.json               # Cron schedule
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

## Scoring Rules

| Rule | Weight | Description |
|------|--------|-------------|
| Length | 20% | 80-160 chars optimal |
| Curiosity Gap | 20% | ? or curiosity words |
| Specificity | 20% | Numbers, timeframes, proper nouns |
| Authority | 15% | First-person + outcome verb |
| Action | 15% | Imperative or action phrases |
| Clickbait Penalty | -10% | ALL CAPS, excessive !, clickbait phrases |

## API Contract

### POST /api/grade-hook

**Request:**
```json
{
  "name": "string",
  "designation": "string",
  "email": "string",
  "hook": "string"
}
```

**Response (200):**
```json
{
  "sessionId": "uuid",
  "score": 87,
  "failedRules": ["..."],
  "passedRules": ["..."],
  "rewrites": [{"hook": "...", "reason": "..."}, ...],
  "fallback": false
}
```

**Fallback Response (200):**
```json
{
  "fallback": true,
  "fallbackReason": "GEMINI_TIMEOUT|GEMINI_SCHEMA_ERROR|GEMINI_RATE_LIMIT|GEMINI_UNAVAILABLE",
  "rewrites": [{"hook": "<original>", "reason": "AI unavailable — original hook shown"}, ...]
}
```

**Errors:**
- 400: Validation failed
- 429: Rate limited
- 500: Persistence failed (atomic transaction)

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Unit tests (vitest)
npm run test:watch   # Watch mode
npm run test:e2e     # E2E tests (Playwright)
```

## Database Setup

Run the migration in Supabase SQL editor:

```sql
-- See supabase/migrations/001_hook_grader_schema.sql
-- Creates: hook_grader_sessions, webhook_outbox, webhook_deliveries
-- Creates: insert_hook_grader_session() RPC function
```

## Deployment

1. Push to GitHub
2. Import in Vercel (root directory: `linkedin-hook-grader/`)
3. Add environment variables in Vercel dashboard
4. Deploy - Vercel Cron runs automatically every minute

## Integration with Task 1

The webhook payload is sent to `MAKE_WEBHOOK_URL` via the outbox pattern.
Make.com must deduplicate on `idempotency_key` (`hook_grader_<session_id>`).
See `docs/API_CONTRACT.md` for full payload specification.

## Testing

All external integrations are **UNVERIFIED** until tested with real credentials:
- Supabase (PostgreSQL + RPC)
- Google Gemini 2.5 Flash
- Make.com webhook
- Vercel Cron
- End-to-end flow

Run tests with `npm run test` and `npm run test:e2e`.