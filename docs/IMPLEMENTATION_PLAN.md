# Implementation Plan — Myntmore Assignment

**Status:** Partially superseded by ownership transfer + audit — see `docs/COMPLETION_PLAN.md` for current priorities  
**Phases:** 0 (Setup) → 1 (Backend/API) → 2 (Frontend) → 3 (Integration) → 4 (Deploy) → 5 (Loom/Submit)  
**Agents (updated 2026-10-14):** **Cursor** = Task 1 + Task 2 + Make.com bridge; OpenCode = prior Task 2 author (preserve work); Human = auth/accounts/Loom  
**Note:** Older phase tables below still describe *what* to build. Do **not** rebuild from scratch — complete existing `linkedin-hook-grader/` and `automation/` incrementally.

---

## Phase 0: Prerequisites & Setup (Human + OpenCode)

| Task | Owner | Dependencies | Completion Criteria |
|------|-------|--------------|---------------------|
| Obtain `leads.csv` from email | Human | — | File in repo (gitignored) |
| Create Supabase project | Human | — | Project URL + keys in 1Password |
| Create Vercel project + link GitHub | Human | GitHub repo exists | Vercel dashboard shows project |
| Create Make.com account + scenario stub | Human | — | Webhook URL generated |
| Generate Gemini API key (Google AI Studio) | Human | — | Key in 1Password |
| Create GitHub repository | Human | — | Repo URL, OpenCode + Cursor access |
| Configure `.env.local` (OpenCode) | OpenCode | All keys above | `npm run dev` connects to Supabase |
| Configure Vercel env vars | Human | Vercel project | Preview deployment works |

**Deliverable:** All external accounts ready, env vars set, `npm run dev` runs locally.

---

## Phase 1: Hook Grader Backend — API & Scoring Engine (OpenCode)

### 1.1 Project Scaffold
| File | Description |
|------|-------------|
| `linkedin-hook-grader/package.json` | Next.js 14, TypeScript, Tailwind, Supabase client, Google Generative AI SDK |
| `linkedin-hook-grader/tsconfig.json` | Strict mode, path aliases |
| `linkedin-hook-grader/next.config.js` | Standard Next.js config |
| `linkedin-hook-grader/.eslintrc.json` | Airbnb + Prettier |
| `linkedin-hook-grader/.gitignore` | Standard + `.env.local` |

### 1.2 Scoring Engine (Pure Functions)
| File | Description |
|------|-------------|
| `linkedin-hook-grader/lib/scoring/types.ts` | `ScoreResult`, `Rule` interfaces |
| `linkedin-hook-grader/lib/scoring/rules.ts` | 4–6 rule implementations (pure, tested) |
| `linkedin-hook-grader/lib/scoring/index.ts` | `scoreHook(hook: string): ScoreResult` |
| `linkedin-hook-grader/lib/scoring/__tests__/rules.test.ts` | Unit tests: each rule, determinism, edge cases |
| `linkedin-hook-grader/lib/scoring/constants.ts` | Configurable weights, thresholds, patterns |

**Rules to implement (configurable constants):**
1. `lengthRule` — 80–160 chars optimal, penalty outside
2. `curiosityRule` — `?` or curiosity words (how, why, what, secret, mistake)
3. `specificityRule` — Numbers, timeframes, proper nouns, metrics
4. `authorityRule` — First-person + outcome/claim
5. `actionRule` — Starts with verb or imperative
6. `clickbaitPenalty` — ALL CAPS, excessive `!`, "you won't believe"

**Tests required:**
- Same input → same score (determinism)
- Each rule fires correctly on fixtures
- Score bounds 0–100
- Failed rules array matches expectations

### 1.3 Gemini Integration
| File | Description |
|------|-------------|
| `linkedin-hook-grader/lib/gemini/client.ts` | Configured `GoogleGenerativeAI` client |
| `linkedin-hook-grader/lib/gemini/prompt.ts` | System prompt + user template (Task 01 rules) |
| `linkedin-hook-grader/lib/gemini/schema.ts` | `responseSchema` JSON object |
| `linkedin-hook-grader/lib/gemini/rewrite.ts` | `generateRewrites(hook: string, score: number): Rewrite[]` |
| `linkedin-hook-grader/lib/gemini/__tests__/rewrite.test.ts` | Mock tests: schema validation, fallback |

**Error handling:** 1 retry on schema parse failure → fallback rewrites.

### 1.4 Supabase Client & Types
| File | Description |
|------|-------------|
| `linkedin-hook-grader/lib/supabase/server.ts` | Service-role client for API routes |
| `linkedin-hook-grader/lib/supabase/client.ts` | Anon client for browser (if needed) |
| `linkedin-hook-grader/lib/supabase/types.ts` | Generated from Supabase CLI or manual `HookGraderSession` type |
| `linkedin-hook-grader/lib/supabase/queries.ts` | `insertSessionAtomic()`, `getSession()`, `getPendingWebhooks()`, `markWebhookDelivered()`, `markWebhookDeadLetter()`, `logWebhookAttempt()` helpers |

### 1.5 Make.com Webhook Client (Durable Delivery)
| File | Description |
|------|-------------|
| `linkedin-hook-grader/lib/webhook/make.ts` | `deliverWebhook(payload: HookGraderPayload): Promise<void>` — called by Cron, not inline |
| `linkedin-hook-grader/lib/webhook/outbox.ts` | `processOutbox(): Promise<void>` — picks pending, delivers, updates status |
| `linkedin-hook-grader/lib/webhook/__tests__/make.test.ts` | Mock fetch, retry logic, HMAC signing, idempotency |
| `linkedin-hook-grader/lib/webhook/__tests__/outbox.test.ts` | Outbox processing, retry scheduling, dead letter |

**Retry policy:** Max 5 attempts, minute-aligned schedule (~1m, ~5m, ~15m, ~30m, ~60m). Called by Vercel Cron, not from API response. Sub-minute precision UNVERIFIED with Vercel Cron.

### 1.6 API Route
| File | Description |
|------|-------------|
| `linkedin-hook-grader/app/api/grade-hook/route.ts` | POST handler: validate → score → Gemini → Supabase atomic insert → respond (200 or 500) |
| `linkedin-hook-grader/app/api/grade-hook/__tests__/route.test.ts` | Integration test with mocked dependencies |

### 1.7 Vercel Cron Job
| File | Description |
|------|-------------|
| `linkedin-hook-grader/app/api/cron/process-webhooks/route.ts` | GET handler: auth via `WEBHOOK_CRON_SECRET`, calls `processOutbox()` |
| `linkedin-hook-grader/vercel.json` | Cron schedule: `* * * * *` (every minute) |

**Request body:**
```json
{
  "name": "string",
  "designation": "string",
  "email": "string",
  "hook": "string"
}
```

**Response (200) — Normal:**
```json
{
  "sessionId": "uuid",
  "score": 87,
  "failedRules": ["..."],
  "passedRules": ["..."],
  "rewrites": [
    { "hook": "...", "reason": "..." },
    { "hook": "...", "reason": "..." },
    { "hook": "...", "reason": "..." }
  ],
  "fallback": false
}
```

**Response (200) — Fallback (Gemini failed, session saved):**
```json
{
  "sessionId": "uuid",
  "score": 87,
  "failedRules": ["..."],
  "passedRules": ["..."],
  "rewrites": [
    { "hook": "<original>", "reason": "AI unavailable — original hook shown" },
    { "hook": "<original>", "reason": "AI unavailable — original hook shown" },
    { "hook": "<original>", "reason": "AI unavailable — original hook shown" }
  ],
  "fallback": true,
  "fallbackReason": "GEMINI_TIMEOUT|GEMINI_SCHEMA_ERROR|GEMINI_RATE_LIMIT|GEMINI_UNAVAILABLE"
}
```

**Error responses:** 400 (validation), 500 (persistence failed), 429 (rate limited)

---

## Phase 2: Hook Grader Frontend — UI (Cursor)

### 2.1 Pages & Components
| File | Description |
|------|-------------|
| `linkedin-hook-grader/app/page.tsx` | Single-page flow: landing → form → grader → results |
| `linkedin-hook-grader/components/HookGraderForm.tsx` | Contact fields + hook textarea |
| `linkedin-hook-grader/components/HookGraderResults.tsx` | Score display, failed rules, 3 rewrites |
| `linkedin-hook-grader/components/ScoreBreakdown.tsx` | Visual score + rule pass/fail list |
| `linkedin-hook-grader/components/RewriteCard.tsx` | Individual rewrite display |
| `linkedin-hook-grader/components/LoadingState.tsx` | Skeleton/spinner during grading |

### 2.2 State Management
- React `useState` for multi-step form (no router needed, single page)
- Form validation: Zod schema shared with API

### 2.3 Styling
- Tailwind CSS, responsive, accessible
- Myntmore brand colors (extract from website)
- Mobile-first, clean, "one plain page"

### 2.4 Testing (Cursor)
| File | Description |
|------|-------------|
| `linkedin-hook-grader/e2e/hook-grader.spec.ts` | Playwright: full flow, score determinism, results display |
| `linkedin-hook-grader/components/__tests__/HookGraderForm.test.tsx` | React Testing Library: validation, submission |

---

## Phase 3: Integration & Task 1 Connectivity (OpenCode + Human)

### 3.1 Make.com Scenario (Human configures, OpenCode documents)
| Step | Description |
|------|-------------|
| Webhook catch | `POST /hook-grader` receives payload with `idempotency_key` |
| Deduplicate | Check `idempotency_key` against `leads.external_id` or dedicated table |
| Transform | Map to Task 1 lead format (see `linkedin-hook-grader/docs/API_CONTRACT.md`) |
| Forward to Task 1 | Call Task 1 automation (n8n webhook / Make.com scenario / Zapier catch hook) |
| Log result | Success/failure visible in Make.com history |

**OpenCode delivers:** Webhook payload spec, sample payload, idempotency key format, transformation mapping.
**Human configures:** Make.com scenario + Task 1 automation connection.
**Cursor tests:** End-to-end flow verification.

### 3.2 Task 01 Lead Table Compatibility
- Ensure `hook_grader_sessions` webhook payload matches Task 01 `leads` table schema
- Document transforms needed in Make.com
- **Make.com remains the required bridge** — Task 02 webhook hits Make.com first, regardless of Task 1 platform

---

## Phase 4: Deployment & Verification (OpenCode + Cursor + Human)

| Task | Owner | Criteria |
|------|-------|----------|
| Push to GitHub main | OpenCode | CI passes (lint, typecheck, tests) |
| Vercel auto-deploy | Human | Preview URL works |
| Production deploy | Human | Live URL accessible |
| Smoke test: full flow | Cursor | Submit hook → see results → verify Supabase row |
| Verify webhook delivery | OpenCode | Check Make.com scenario history + Supabase `webhook_deliveries` |
| Load test (optional) | Cursor | 10 concurrent submissions, all succeed |

---

## Phase 5: Loom Recording & Submission (Human)

| Task | Owner | Criteria |
|------|-------|----------|
| Record Loom (5–7 min, camera on) | Human | 4 segments in order (Task 01, Task 02, architecture walkthrough, gaps) |
| Fill submission doc | Human | PDF with 3 links (Loom, Live URL, GitHub) |
| Email submission | Human | Reply to original thread with PDF |

---

## Dependencies Graph

```
Phase 0 (Human)
    │
    ├──→ Phase 1.1-1.4 (OpenCode) ──→ Phase 1.5-1.7 (OpenCode)
    │                                    │
    │                                    └──→ Phase 2 (Cursor) ◄── Parallel after 1.1
    │                                             │
    └─────────────────────────────────────────────┘
                              │
                              ▼
                       Phase 3 (Human configures Make.com)
                              │
                              ▼
                       Phase 4 (All)
                              │
                              ▼
                       Phase 5 (Human)
```

---

## File Inventory (Expected)

```
myntmore-assignment/
├── .gitignore
├── AGENTS.md
├── README.md
├── leads.csv
├── docs/
│   ├── ASSIGNMENT_ANALYSIS.md
│   ├── ACCEPTANCE_CRITERIA.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── AGENT_HANDOFF.md
│   ├── TOOLING_INVENTORY.md
│   └── PROJECT_MEMORY.md
├── supabase/
│   └── migrations/
│       ├── 001_hook_grader_schema.sql
│       └── 002_task1_leads_schema.sql
├── linkedin-hook-grader/
│   ├── .env.example
│   ├── .gitignore
│   ├── vercel.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── .eslintrc.json
│   ├── README.md
│   ├── AGENTS.md
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── grade-hook/
│   │       │   ├── route.ts
│   │       │   └── __tests__/
│   │       │       └── route.test.ts
│   │       └── cron/
│   │           └── process-webhooks/
│   │               └── route.ts
│   ├── components/
│   │   ├── HookGraderForm.tsx
│   │   ├── HookGraderResults.tsx
│   │   ├── ScoreBreakdown.tsx
│   │   ├── RewriteCard.tsx
│   │   ├── LoadingState.tsx
│   │   └── __tests__/
│   │       └── HookGraderForm.test.tsx
│   ├── lib/
│   │   ├── scoring/
│   │   │   ├── types.ts
│   │   │   ├── rules.ts
│   │   │   ├── index.ts
│   │   │   ├── constants.ts
│   │   │   └── __tests__/
│   │   │       └── rules.test.ts
│   │   ├── gemini/
│   │   │   ├── client.ts
│   │   │   ├── prompt.ts
│   │   │   ├── schema.ts
│   │   │   ├── rewrite.ts
│   │   │   └── __tests__/
│   │   │       └── rewrite.test.ts
│   │   ├── supabase/
│   │   │   ├── server.ts
│   │   │   ├── client.ts
│   │   │   ├── types.ts
│   │   │   └── queries.ts
│   │   └── webhook/
│   │       ├── make.ts
│   │       ├── outbox.ts
│   │       └── __tests__/
│   │           ├── make.test.ts
│   │           └── outbox.test.ts
│   ├── e2e/
│   │   └── hook-grader.spec.ts
│   └── docs/
│       ├── ARCHITECTURE.md
│       ├── API_CONTRACT.md
│       └── SCORING_SPEC.md
└── automation/
    ├── workflows/
    ├── schemas/
    ├── tests/
    ├── docs/
    ├── README.md
    └── AGENTS.md
```

---

## Completion Criteria per Phase

| Phase | Criteria |
|-------|----------|
| 0 | All accounts created, env vars set, `npm run dev` starts |
| 1 | All unit tests pass (`npm test`), API route returns 200 on valid input (normal + fallback), Supabase session + outbox rows created atomically, Cron job processes outbox, webhook delivery logged |
| 2 | E2E test passes, UI matches design, responsive, accessible |
| 3 | Make.com scenario receives payload, deduplicates on idempotency_key, creates lead in Task 01 flow |
| 4 | Production URL live, smoke test passes, webhook delivery logged, dead letter alert tested |
| 5 | Loom recorded, PDF submitted, all links accessible |

---

## Open Questions (Require Human Decision)

1. **Scoring rule weights** — Equal weight? Configurable? (Default: per SCORING_SPEC.md)
2. **Rate limit** — 10 req/min/IP? Stricter?
3. **Disposable email blocking** — Use blocklist? (Default: no, just validate format)
4. **Task 01 Supabase schema** — Need to see actual `leads` table to align webhook payload
5. **Zoho CRM field mapping** — Human to provide
6. **Analytics/tracking** — PostHog, Vercel Analytics, or none? (Default: none for MVP)