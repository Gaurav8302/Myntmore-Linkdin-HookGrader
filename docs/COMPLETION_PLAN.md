# Completion Plan — Post Ownership Audit (2026-10-14)

> **Note (2026-10-17):** Much of this checklist is historical. For current verified test counts, live URL, Loom, and lead tiers, use the root [`README.md`](../README.md). Make bridge and Zoho draft evidence: [`MAKE_BRIDGE_STATUS.md`](./MAKE_BRIDGE_STATUS.md), [`../automation/docs/ZOHO_DRAFT_CAPABILITY.md`](../automation/docs/ZOHO_DRAFT_CAPABILITY.md). `leads.csv` is already tracked (gitignore conflict resolved).

**Basis:** Repository inspection + non-destructive test runs. Assignment DOCX/TXT takes precedence over older planning notes that split ownership or treated Task 1 as Make-primary.

---

## Priority 0 — Unblock (Human)

1. Supabase project URL + anon + **service role** keys  
2. Gemini API key with usable quota (assignment model `gemini-2.5-flash`; new keys may need `GEMINI_MODEL` override — document honestly)  
3. Approve replacing placeholder `supabase/migrations/002_task1_leads_schema.sql` with `automation/docs/SCHEMA_PROPOSAL.md` (`idempotency_key TEXT UNIQUE`, not UUID)  
4. Approve root `.gitignore` one-line fix so fictional `leads.csv` can be committed  
5. Zoho CRM access for **draft-only** demo (see Zoho note below)  
6. Make.com account (webhook URL created by Cursor after contract verification — do not invent URLs)  
7. Vercel + GitHub for Hook Grader deploy  

## Priority 1 — Hook Grader (preserve OpenCode app)

1. Fix failing unit tests (8 failures / 65): scoring fixture expectations vs current weights; Gemini fallback exports; Make signature when secret unset; outbox dead-letter counters  
2. Fix `tsc` errors in tests (exports / payload types) — production `next build` already succeeds  
3. Add `.env.local` (gitignored) and smoke `POST /api/grade-hook` locally with mocks or live Supabase  
4. Verify scoring determinism (already true for sample hook) and that Gemini path uses `responseSchema` for exactly 3 rewrites — live Gemini still UNVERIFIED without key  
5. Apply `001_hook_grader_schema.sql` to real Supabase; verify atomic RPC insert  
6. Remove or quarantine scratch files later (`debug-score.js`, `test-specificity.*`) without deleting until confirmed unused  
7. Deploy Vercel when build + env ready  

## Priority 2 — Task 1 / n8n (preserve Cursor work)

1. Keep workflow `RPh6nEfzP2mq7GFj` as orchestrator; extend beyond CSV dry-run  
2. Wire real Supabase upsert (replace interim n8n Data Table once migration approved)  
3. Add Gemini credential/path in n8n or HTTP call into supporting code; keep template fallback  
4. Implement Zoho **draft-only** creation with verified API/capability (MCP today: records CRUD only — **no proven email-draft tool**)  
5. Add webhook/manual trigger for Make.com payloads (`idempotency_key`) without breaking CSV path  
6. Re-verify 20/20 accounting after each change  

## Priority 3 — Make.com bridge (last)

1. Diff `API_CONTRACT.md` vs `grade-hook` + `buildWebhookPayload` + Task 1 expected fields  
2. Create Make scenario: Hook outbox → transform → n8n webhook  
3. Prove: submit Hook Grader → Supabase session → outbox delivered → Task 1 lead → Zoho draft-only  
4. Idempotent retries; no duplicate drafts  

## Priority 4 — Ops judgement + submission

1. Task 03 written answers (3a constraint bug; 3b AI search table)  
2. Loom + PDF links  

---

## Explicit non-goals for the next implementation iteration until approved

- Do not rebuild either app from scratch  
- Do not edit `.gitignore` or shared migrations without Human approval  
- Do not invent Make.com URLs or configure Make until contract verified  
- Do not auto-send email  
