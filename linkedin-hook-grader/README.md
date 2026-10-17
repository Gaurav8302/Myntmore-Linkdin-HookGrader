# LinkedIn Hook Grader (Task 2)

Next.js app that grades LinkedIn post hooks with deterministic rules and generates three AI-powered rewrites. Sessions persist in Supabase; Make.com receives durable webhook deliveries for Task 1.

**Live URL:** https://myntmore-linkedin-hook-grader.vercel.app  
**Walkthrough:** https://www.loom.com/share/39ce810ae73d4f318bd3fbf4691f0bc3 (repo Loom — not this app’s URL)

## Features

- **Deterministic scoring** — 6 explicit rules, same input → same score (0–100); score is never from the model
- **AI rewrites** — exactly 3 structured rewrites from **NVIDIA NIM** (`meta/llama-3.2-11b-vision-instruct`)
- **Supabase persistence** — atomic session + outbox insert via PostgreSQL RPC
- **Durable Make.com delivery** — outbox pattern + Vercel Cron; `idempotency_key = hook_grader_<session_id>`
- **Safe fallbacks** — NVIDIA failures return 200 with `fallback: true` and original hook echoed
- **Gemini** — abandoned after observed HTTP 404 / quota — see [`../docs/AI_PROVIDER_FAILURES.md`](../docs/AI_PROVIDER_FAILURES.md)

## Quick start

```bash
cd linkedin-hook-grader
npm install
cp .env.example .env.local
# Edit .env.local with your credentials
npm run dev
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for server |
| `NVIDIA_API_KEY` | Yes | NVIDIA API key (server-only) |
| `NVIDIA_MODEL` | No | Default `meta/llama-3.2-11b-vision-instruct` |
| `MAKE_WEBHOOK_URL` | Yes | Exact Make.com webhook URL (Hook Grader → Make) |
| `MAKE_WEBHOOK_SECRET` | Optional | HMAC secret for verification |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL |
| `WEBHOOK_CRON_SECRET` | Yes | Vercel Cron auth secret |

Never put secrets in `NEXT_PUBLIC_*`.

## Project structure

```
linkedin-hook-grader/
├── app/
│   ├── api/
│   │   ├── grade-hook/route.ts
│   │   └── cron/process-webhooks/route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
├── lib/
│   ├── scoring/          # Deterministic 0–100 score
│   ├── gemini/           # Path kept; NVIDIA NIM rewrite client
│   ├── supabase/
│   └── webhook/          # Make.com client + outbox processor
├── docs/
├── e2e/
├── vercel.json           # Cron schedule (Hobby: daily)
└── package.json
```

## Scoring rules

| Rule | Weight | Description |
|------|--------|-------------|
| Length | 20% | 80–160 chars optimal |
| Curiosity Gap | 20% | `?` or curiosity words |
| Specificity | 20% | Numbers, timeframes, proper nouns |
| Authority | 17 pts | First-person + outcome verb |
| Action | 17 pts | Imperative / playbook / reader-focused CTA |
| Clickbait Penalty | −10% | ALL CAPS, excessive `!`, clickbait phrases |

Full detail: [`docs/SCORING_SPEC.md`](docs/SCORING_SPEC.md).

## API (summary)

`POST /api/grade-hook` with `{ name, designation?, email, hook }` → `{ sessionId, score, failedRules, passedRules, rewrites[3], fallback }`.

On AI failure: still **200** with `fallback: true`. Persistence failure: **500**.

Full contract: [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## Commands

```bash
npm run dev          # Dev server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Unit tests (Vitest)
npm run test:watch   # Watch mode
npm run test:e2e     # Playwright e2e
```

### Latest verification (2026-10-17)

| Check | Result |
|-------|--------|
| `npm test` | **108/108** passed |
| `npm run lint` | Clean |
| `npm run build` | Succeeded |
| Live site HTTP | **200** |

## Database

Apply migrations in Supabase SQL editor (shared repo folder):

- `../supabase/migrations/001_hook_grader_schema.sql` — sessions, outbox, deliveries, RPC
- Later migrations for Task 1 / outbox fixes as needed

## Deployment

1. Connect GitHub repo in Vercel
2. Set **Root Directory** to `linkedin-hook-grader/`
3. Add environment variables (including server-only `NVIDIA_API_KEY` and `MAKE_WEBHOOK_URL`)
4. Deploy

Cron: `vercel.json` schedules `/api/cron/process-webhooks` at `0 12 * * *` (Vercel Hobby daily). In-request outbox flush is also used so Make can receive grades without waiting for cron.

## Integration with Task 1

Outbox posts to `MAKE_WEBHOOK_URL`. Make.com scenario `7960198` forwards to local n8n via a public tunnel. Task 1 deduplicates on `idempotency_key`.

- Bridge ops: [`../docs/MAKE_BRIDGE_STATUS.md`](../docs/MAKE_BRIDGE_STATUS.md)
- Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## UI note

Light Myntmore tool-page pattern (white canvas, black type, yellow `#ffc247` CTAs) aligned with [LinkedIn Profile Optimizer](https://www.myntmore.com/tools/linkedin-optimizer).
