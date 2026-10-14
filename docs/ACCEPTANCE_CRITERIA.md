# Acceptance Criteria — Myntmore Assignment

**Status:** Proposed — awaiting approval  
**Convention:** ✅ = Must pass (explicit requirement) | 🔧 = Should pass (engineering practice) | ❌ = Not tested / N/A

---

## Task 02: LinkedIn Hook Grader (Primary Focus)

### 2.1 User Flow

| ID | Criterion | Type | Test Method | Status |
|----|-----------|------|-------------|--------|
| 2.1.1 | Landing page loads at `/` | ✅ | `curl -I /` → 200 | ❌ |
| 2.1.2 | Contact form requires name, email | ✅ | Submit empty → validation errors | ❌ |
| 2.1.3 | Hook input accepts two lines of text | ✅ | Paste two lines → accepted | ❌ |
| 2.1.4 | Results show score (0–100) | ✅ | Submit valid → score displayed | ❌ |
| 2.1.5 | Results show 3 rewrites with reasons | ✅ | Submit valid → 3 cards visible | ❌ |
| 2.1.6 | Results show failed rules (one line each) | ✅ | Submit valid → list visible | ❌ |
| 2.1.7 | Single page, no navigation required | ✅ | Visual inspection | ❌ |
| 2.1.8 | Mobile responsive (375px, 768px, 1440px) | 🔧 | Playwright viewport tests | ❌ |
| 2.1.9 | Accessible: labels, contrast, keyboard nav | 🔧 | axe-core / manual | ❌ |

### 2.2 Scoring Engine (Deterministic, In-Code)

| ID | Criterion | Type | Test Method | Status |
|----|-----------|------|-------------|--------|
| 2.2.1 | 4–6 explicit rules implemented | ✅ | Code review: `lib/scoring/rules.ts` | ❌ |
| 2.2.2 | Same hook → same score (deterministic) | ✅ | Unit test: 100 runs, same input | ❌ |
| 2.2.3 | Score range 0–100 inclusive | ✅ | Unit test: boundary inputs | ❌ |
| 2.2.4 | Each failed rule returns one-line reason | ✅ | Unit test: `failedRules` array format | ❌ |
| 2.2.5 | Rules are configurable constants (not hardcoded magic numbers) | 🔧 | Code review | ❌ |
| 2.2.6 | No AI used in scoring | ✅ | Code review: no Gemini import in scoring | ❌ |
| 2.2.7 | Rules cover: length, curiosity, specificity, authority, action, clickbait penalty | ✅ | Code review + test fixtures | ❌ |

### 2.3 Gemini Rewrites (Structured JSON)

| ID | Criterion | Type | Test Method | Status |
|----|-----------|------|-------------|--------|
| 2.3.1 | Exactly 3 rewrites returned | ✅ | Integration test: mock Gemini → count | ❌ |
| 2.3.2 | Response validates against `responseSchema` | ✅ | Integration test: schema validation | ❌ |
| 2.3.3 | Each rewrite has `hook` + `reason` | ✅ | Integration test: object shape | ❌ |
| 2.3.4 | Rewrites follow Task 01 writing rules | ✅ | Manual review: no jargon, no em dashes, no invented numbers, <120 words, only myntmore.com/founder-meeting link | ❌ |
| 2.3.5 | Fallback on Gemini failure returns 200 with `fallback=true` | ✅ | Mock Gemini timeout → verify 200, fallback=true, original hook echoed | ❌ |
| 2.3.6 | Fallback rewrites never invent claims/numbers | ✅ | Mock Gemini failure → verify fallback reason says "AI unavailable" | ❌ |
| 2.3.7 | Retry once on schema violation before fallback | 🔧 | Mock schema error → retry → succeed or fallback | ❌ |
| 2.3.8 | `fallbackReason` indicates failure type (TIMEOUT, SCHEMA_ERROR, RATE_LIMIT, UNAVAILABLE) | ✅ | Mock each failure type → verify reason | ❌ |

### 2.4 Supabase Persistence

| ID | Criterion | Type | Test Method | Status |
|----|-----------|------|-------------|--------|
| 2.4.1 | One row per session in `hook_grader_sessions` | ✅ | Submit → `SELECT COUNT(*)` = 1 | ❌ |
| 2.4.2 | Row contains: contact, hook, score, failed_rules, passed_rules, 3 rewrites + reasons, metadata | ✅ | Inspect inserted row | ❌ |
| 2.4.3 | `created_at` auto-populated | ✅ | Verify timestamp | ❌ |
| 2.4.4 | RLS: only service role can insert | 🔧 | Anon key insert → 403 | ❌ |
| 2.4.5 | Indexes on email, created_at | 🔧 | `\d hook_grader_sessions` | ❌ |
| 2.4.6 | Session persists even when webhook delivery fails | ✅ | Submit → kill webhook → verify session row exists | ❌ |
| 2.4.7 | Outbox row created with `status='pending'` after session insert | ✅ | Submit → check `webhook_outbox` | ❌ |

### 2.5 Make.com Webhook (Task 02 → Task 01) — Durable Delivery

| ID | Criterion | Type | Test Method | Status |
|----|-----------|------|-------------|--------|
| 2.5.1 | Session saved to Supabase before webhook enqueued | ✅ | Submit → verify session row exists, outbox row created | ❌ |
| 2.5.2 | Webhook enqueued to `webhook_outbox` with `status='pending'` | ✅ | Inspect outbox row after submit | ❌ |
| 2.5.3 | Payload includes `idempotency_key` = `hook_grader_<session_id>` | ✅ | Compare JSON | ❌ |
| 2.5.4 | Vercel Cron processes pending outbox every minute | 🔧 | Wait 60s → check outbox status updated | ❌ |
| 2.5.5 | Retry up to 5x with exponential backoff (1s, 5s, 30s, 2m, 10m) | 🔧 | Mock failing webhook → check attempt count & timing | ❌ |
| 2.5.6 | Each attempt logged to `webhook_deliveries` with status code | 🔧 | Check delivery log table | ❌ |
| 2.5.7 | After 5 failures → `dead_letter` status, alert triggered | 🔧 | Mock persistent failure → verify dead_letter | ❌ |
| 2.5.8 | Webhook failure never erases saved session | ✅ | Verify session row persists after webhook failures | ❌ |
| 2.5.9 | User receives 200 response before webhook delivery | ✅ | Measure response time vs webhook delivery | ❌ |
| 2.5.10 | **Uses Make.com (not Zapier/n8n) for Task 02→01** | ✅ | Verify webhook URL domain | ❌ |
| 2.5.11 | Make.com scenario deduplicates on `idempotency_key` | ✅ | Send duplicate → verify no double lead in Task 1 | ❌ |

---

## Task 01: Lead Follow-Up Engine (Integration Requirements)

| ID | Criterion | Type | Test Method | Status |
|----|-----------|------|-------------|--------|
| 1.1 | `leads.csv` imported to Supabase `leads` table | ✅ | Count rows = 20 | ❌ |
| 1.2 | Messy rows handled: duplicates, test entries, non-buyers tagged with reason | ✅ | Inspect `leads` table: no silent drops, `clean_reason` populated | ❌ |
| 1.3 | Each lead scored 1–10 for one of 4 services with one-line reason | ✅ | Check `score`, `service`, `score_reason` columns | ❌ |
| 1.4 | Scoring rules vs Gemini parts documented | ✅ | Document exists | ❌ |
| 1.5 | Follow-up email generated by Gemini follows writing rules | ✅ | Manual review: no jargon, no em dashes, <120 words, only myntmore.com/founder-meeting | ❌ |
| 1.6 | Routing: Hot (draft + alert), Warm (nurture draft), Not a fit (tagged, no email) | ✅ | Check `status` column + email drafts | ❌ |
| 1.7 | Hook Grader webhook creates lead in Task 01 pipeline | ✅ | Submit Hook Grader → verify Task 01 lead created | ❌ |

---

## Task 03: Ops Judgement (Written)

| ID | Criterion | Type | Test Method | Status |
|----|-----------|------|-------------|--------|
| 3.1 | 3a: Identifies missing sources in check constraint (`battle_card`, `case_study`) | ✅ | Written answer review | ❌ |
| 3.2 | 3a: Fixes by adding sources to constraint + transaction/ordering fix | ✅ | Written answer review | ❌ |
| 3.3 | 3a: Prevention: observability (alert on error), idempotency, dead letter queue | ✅ | Written answer review | ❌ |
| 3.4 | 3b: 5 questions × 3 AIs = 15 rows completed | ✅ | Table filled | ❌ |
| 3.5 | 3b: 3 website changes proposed with rationale | ✅ | Table filled | ❌ |

---

## Loom Video

| ID | Criterion | Type | Test Method | Status |
|----|-----------|------|-------------|--------|
| L.1 | Duration 5–7 minutes | ✅ | Video length | ❌ |
| L.2 | Camera on | ✅ | Visual | ❌ |
| L.3 | Segment 1: Task 01 working on leads.csv → Zoho CRM | ✅ | Video content | ❌ |
| L.4 | Segment 2: Task 02 Hook Grader demo as visitor | ✅ | Video content | ❌ |
| L.5 | Segment 3: Architecture walkthrough, rules vs Gemini | ✅ | Video content | ❌ |
| L.6 | Segment 4: What's missing, next steps | ✅ | Video content | ❌ |

---

## Deployment & Submission

| ID | Criterion | Type | Test Method | Status |
|----|-----------|------|-------------|--------|
| D.1 | Live Hook Grader URL accessible (Vercel) | ✅ | `curl -I <url>` → 200 | ❌ |
| D.2 | GitHub repo public, contains all source | ✅ | Browse repo | ❌ |
| D.3 | No secrets in repo (API keys, webhook secrets) | ✅ | `git log --all --full-history -- "**/.env*"` → empty | ❌ |
| D.4 | Submission PDF with 3 links (Loom, Live URL, GitHub) | ✅ | PDF inspection | ❌ |
| D.5 | Drive links set to "Anyone with link can view" | ✅ | Incognito test | ❌ |

---

## Engineering Practices (Recommended, Not Graded)

| ID | Criterion | Type | Test Method | Status |
|----|-----------|------|-------------|--------|
| E.1 | TypeScript strict mode, no `any` | 🔧 | `tsc --noEmit` | ❌ |
| E.2 | ESLint + Prettier pass | 🔧 | `npm run lint` | ❌ |
| E.3 | Unit test coverage > 80% on scoring + Gemini | 🔧 | `npm test -- --coverage` | ❌ |
| E.4 | E2E test covers happy path + validation errors | 🔧 | `npm run test:e2e` | ❌ |
| E.5 | Error boundaries / graceful degradation | 🔧 | Code review | ❌ |
| E.6 | Structured logging (request ID, timing) | 🔧 | Code review | ❌ |
| E.7 | Rate limiting on `/api/grade-hook` | 🔧 | Load test | ❌ |
| E.8 | CSP headers, security headers | 🔧 | `securityheaders.com` scan | ❌ |

---

## Evaluation Weight Mapping

| Evaluation Category (Assignment) | Acceptance Criteria IDs | Weight |
|----------------------------------|-------------------------|--------|
| End-to-end working (25%) | 2.1.1–2.1.7, 2.4.1, 2.4.6, 2.5.1, 2.5.8, 2.5.9, 1.1–1.7, D.1 | 25% |
| Follow-up quality (15%) | 1.5, 2.3.4 | 15% |
| Built to reuse (15%) | 2.2.5, 1.4, E.1–E.3 | 15% |
| Hook Grader (15%) | 2.1–2.5 (all ✅) | 15% |
| Messy data (10%) | 1.2 | 10% |
| Judgement (10%) | 3.1–3.5 | 10% |
| Initiative & communication (10%) | L.1–L.6, D.4–D.5, E.5–E.8 | 10% |

---

## Test Execution Commands

```bash
# Unit tests (scoring, Gemini, webhook)
npm test

# E2E tests (Playwright)
npm run test:e2e

# Lint + typecheck
npm run lint && npx tsc --noEmit

# Manual smoke test
npm run dev
# Open http://localhost:3000, submit form, verify results
```

## Required Integration Tests (Unverified Until Implemented)

| Test Scenario | Criterion IDs | Status |
|---------------|---------------|--------|
| Gemini timeout → 200 with fallback=true | 2.3.5, 2.3.6, 2.3.8 | ❌ Unverified |
| Gemini schema error → retry once → fallback | 2.3.7, 2.3.8 | ❌ Unverified |
| Gemini rate limit → 200 with fallback=true | 2.3.5, 2.3.8 | ❌ Unverified |
| Supabase insert failure → 500 PERSISTENCE_FAILED | 2.4.1, 2.4.6 | ❌ Unverified |
| Webhook timeout → retry with backoff | 2.5.5, 2.5.6 | ❌ Unverified |
| Webhook 5xx → retry up to 5x → dead_letter | 2.5.5, 2.5.6, 2.5.7 | ❌ Unverified |
| Webhook 4xx → retry up to 5x → dead_letter | 2.5.5, 2.5.7 | ❌ Unverified |
| Duplicate webhook delivery (same idempotency_key) → Task 1 dedupes | 2.5.11 | ❌ Unverified |
| Session saved, webhook fails → session persists | 2.4.6, 2.5.8 | ❌ Unverified |
| Vercel Cron processes outbox → delivery logged | 2.5.4, 2.5.6 | ❌ Unverified |

> **All external service integrations (Supabase, Gemini, Make.com, Vercel Cron) are marked UNVERIFIED until tested with real credentials.**

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| OpenCode (Backend) | | | |
| Cursor (Frontend) | | | |
| Human (Approver) | | | |