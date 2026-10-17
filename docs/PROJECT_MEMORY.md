# Project Memory — Myntmore Assignment

**Created:** 2026-10-14  
**Last Updated:** 2026-10-14 (ownership transfer + implementation audit)  
**Current Phase:** Audit complete — Cursor sole implementer; next = Priority 1 Hook Grader test repair + Human credentials  
**Next Action:** Human approve `docs/COMPLETION_PLAN.md` then begin Priority 1 incremental fixes (no rebuild)

---

## Verified Decisions

| Date | Decision | Rationale | Agents Involved |
|------|----------|-----------|-----------------|
| 2026-10-14 | **Ownership transfer:** Cursor is sole active owner of Task 1, Task 2, and Make.com bridge; OpenCode work preserved | User directive; avoid concurrent agents on same files | Cursor + Human |
| 2026-10-14 | **n8n** is Task 1 runtime; Make.com is Task 2→1 only | Assignment allows n8n for automation; Task 02 text requires Make.com webhook | Cursor (clarified) |
| 2026-10-14 | Task 02 (Hook Grader) is primary focus; Task 01 integration via Make.com webhook | Assignment emphasizes Task 02 deployment; Task 01 webhook is explicit requirement | OpenCode (planning) |
| 2026-10-14 | Scoring engine: 4–6 deterministic rules in code, no AI | Assignment: "Score the hook with code, not AI" | OpenCode |
| 2026-10-14 | Gemini: 3 rewrites as structured JSON via `responseSchema` | Assignment: "Get 3 rewrites from Gemini as structured JSON (responseSchema)" | OpenCode |
| 2026-10-14 | Each session = one Supabase row (contact + hook + score + rewrites) | Assignment: "Save each session as one row in Supabase" | OpenCode |
| 2026-10-14 | Make.com webhook (not Zapier/n8n) for Task 2 → Task 1 | Task 02 explicitly: "send it to your Task 01 scenario through a Make.com webhook" | OpenCode |
| 2026-10-14 | Next.js App Router on Vercel, single-page flow | Assignment: "Build it in Next.js on Vercel: a landing screen, a contact form... One plain page is enough" | OpenCode |
| 2026-10-14 | ~~OpenCode owns Task 2, Cursor owns Task 1~~ → **superseded**: Cursor owns both | Ownership transfer 2026-10-14 | Cursor + Human |
| 2026-10-14 | API contract is provisional until both agents approve | Prevents integration mismatches | OpenCode (proposed) |
| 2026-10-14 | Durable webhook delivery via outbox pattern + Vercel Cron | Fire-and-forget loses deliveries; assignment requires reliable Task 1 integration | OpenCode (revised per review) |
| 2026-10-14 | Idempotency key: `hook_grader_<session_id>` for Task 1 deduplication | Prevents duplicate leads on retry; required for reliable delivery | OpenCode (revised per review) |
| 2026-10-14 | Gemini failures return 200 with `fallback=true` (not 503) | Session saved = success; fallback is degraded but usable result | OpenCode (revised per review) |
| 2026-10-14 | 500 only for persistence failures | Clear semantics: 200 = session saved, 500 = session not saved | OpenCode (revised per review) |
| 2026-10-14 | Max 5 webhook retries (minute-aligned: ~1m, ~5m, ~15m, ~30m, ~60m) then dead_letter | Vercel Cron runs every minute; sub-minute precision UNVERIFIED | OpenCode (revised per review) |
| 2026-10-14 | Atomic persistence: session + outbox in single PostgreSQL RPC | Partial write must not leave saved session without delivery record | OpenCode (revised per review) |
| 2026-10-14 | Safe fallback rewrites: echo submitted hook dynamically, no fabricated claims | Fallback must not invent metrics, ARR, customers, results | OpenCode (revised per review) |
| 2026-10-14 | MAKE_WEBHOOK_URL used exactly as provided, no path appended | Prevents misconfiguration | OpenCode (revised per review) |
| 2026-10-14 | All integrations marked UNVERIFIED until tested with real credentials | Honest reporting per AGENTS.md | OpenCode (revised per review) |

---

## Constraints (From Assignment)

| Constraint | Source | Impact |
|------------|--------|--------|
| Stack: Next.js, Supabase, Gemini 2.5 Flash, Vercel, Make.com, GitHub | Page 1 | No alternatives for these core tools |
| Automation platform: Make, Zapier, n8n permitted generally | Page 1 | But Task 02 locks to Make.com |
| Never send email/message to real person | Page 1 | Drafts only in Zoho CRM |
| No API keys/passwords in repo, screenshots, video | Page 1 | Secrets via env vars only |
| Deterministic scoring (same hook = same score) | Task 02 | Pure functions, no randomness |
| 4–6 explicit scoring rules | Task 02 | Documented, testable |
| Gemini rewrites follow Task 01 writing rules | Task 02 | No jargon, no em dashes, <120 words, only myntmore.com/founder-meeting |
| Every odd row in leads.csv handled on purpose | Task 01, Page 3 | No silent drops |
| Loom: 5–7 min, camera on, 4 segments in order | Page 3 | Human responsibility |
| Submission: PDF with 3 links (Loom, Live URL, GitHub) | Page 3 | Drive links: "Anyone with link can view" |

---

## Unresolved Questions (Require Human Decision)

| # | Question | Context | Default Assumption | Decision Needed By |
|---|----------|---------|-------------------|-------------------|
| 1 | What are the exact 4–6 scoring rules and their weights? | Task 02 | Per `linkedin-hook-grader/docs/SCORING_SPEC.md` | Phase 1 start |
| 2 | Rate limiting: 10 req/min/IP? Stricter? | API protection | 10 req/min | Phase 1 start |
| 3 | Block disposable emails? | Lead quality | No (validate format only) | Phase 1 start |
| 4 | Task 01 `leads` table schema — need to align webhook payload | Integration | OpenCode will provide mapping; Human confirms | Phase 3 |
| 5 | Zoho CRM field mapping for Task 01 | Task 01 demo | Human provides | Phase 1 |
| 6 | Analytics/tracking (PostHog, Vercel Analytics, none)? | Observability | None for MVP | Phase 2 |
| 7 | Myntmore brand colors / design tokens | Frontend | Extract from myntmore.com | Phase 2 |
| 8 | Scoring rule thresholds (e.g., optimal length 80–160?) | Scoring engine | Per SCORING_SPEC.md | Phase 1 |
| 9 | Hook input max length? | Validation | 500 chars | Phase 1 |
| 10 | Contact form: designation required or optional? | UX | Optional | Phase 2 |

---

## Known Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `leads.csv` not available / messy | High | Blocks Task 01 | Human must provide; OpenCode reads every row first |
| Supabase/Vercel/Make.com auth delays | Medium | Blocks all phases | Human completes Phase 0 before Phase 1 |
| Gemini API quota / latency | Low | Fallback rewrites shown | Retry once, fallback to original hook |
| Make.com webhook misconfiguration | Medium | Task 02→01 integration fails | OpenCode provides exact payload spec; Human tests |
| Zoho CRM access not granted | Medium | Task 01 demo incomplete | Human provides early |
| Loom recording issues | Low | Submission incomplete | Human records early, re-records if needed |
| GitHub repo permissions | Low | Collaboration blocked | Human creates repo, adds both agents |
| Cursor MCP servers not green after restart | Low | Frontend tooling limited | Restart Cursor, verify each MCP |
| Vercel Cron sub-minute retry precision | Medium | Retry schedule not as designed | Document as UNVERIFIED; consider dedicated worker if needed |

---

## Phase Progress Tracker

| Phase | Status | Started | Completed | Blockers |
|-------|--------|---------|-----------|----------|
| 0: Prerequisites | 🟡 Partial | 2026-10-14 | — | Supabase/Vercel/Make/Zoho keys; `.gitignore` approval |
| 1–2: Hook Grader (full app exists) | 🟡 Implemented, tests red | 2026-10-14 | — | 8 failing unit tests; no `.env.local`; live Supabase/Gemini UNVERIFIED |
| Task 1 n8n + rules | 🟡 Dry-run green | 2026-10-14 | — | Live Supabase/Zoho; Gemini quota; Make ingest |
| 3: Make.com integration | ⏳ Not Started | — | — | Contract verify + credentials |
| 4: Deploy | ⏳ Not Started | — | — | Green tests + Vercel env |
| 5: Loom/Submit | ⏳ Not Started | — | — | Deploy + Task 03 |

## Audit snapshot (2026-10-14)

- Hook Grader: `next build` OK; Vitest **57 pass / 8 fail**; `tsc` errors in tests; no local env; scoring code-based + deterministic sample check.
- Task 1 (2026-10-17 re-check): Vitest **56/57** (Notes-mode fallback failing); CSV dry-run **20/20** (Hot 12 / Warm 2 / Not a fit 6); Hook Grader Vitest **108/108**; Make bridge E2E documented 2026-10-15; Zoho native draft path documented in `ZOHO_DRAFT_CAPABILITY.md`. Older “36/36” / “75/75” figures are obsolete.
- Zoho MCP: module/record CRUD + workflows — **no dedicated email-draft tool proven**.
- Git: repo initialized, **no commits**; entire tree untracked; preserve all useful files.

---

## Document Inventory (This Session)

| Document | Path | Status | Version |
|----------|------|--------|---------|
| Assignment Analysis | `docs/ASSIGNMENT_ANALYSIS.md` | ✅ Complete | 1.0 |
| Architecture (Hook Grader) | `linkedin-hook-grader/docs/ARCHITECTURE.md` | ✅ Complete | 1.2 (atomic RPC, minute-aligned retries, UNVERIFIED) |
| Implementation Plan | `docs/IMPLEMENTATION_PLAN.md` | ✅ Complete | 1.2 (updated paths, atomic RPC) |
| Acceptance Criteria | `docs/ACCEPTANCE_CRITERIA.md` | ✅ Complete | 1.1 (webhook tests) |
| API Contract (Hook Grader) | `linkedin-hook-grader/docs/API_CONTRACT.md` | ✅ Complete (Provisional) | 1.2-draft (atomic RPC, minute-aligned, safe fallback) |
| Agent Handoff | `docs/AGENT_HANDOFF.md` | ✅ Complete | 1.1 (updated ownership) |
| Tooling Inventory | `docs/TOOLING_INVENTORY.md` | ✅ Complete | 2.1 (updated paths) |
| Project Memory | `docs/PROJECT_MEMORY.md` | ✅ Complete | 1.2 (updated paths, decisions) |
| Scoring Specification | `linkedin-hook-grader/docs/SCORING_SPEC.md` | ✅ Complete | 1.0 |

**Total: 9 documents** (8 shared + 1 Hook Grader-specific)

---

## Next Actions (Priority Order)

1. **Human:** Review all planning documents
2. **Human:** Approve or request changes to Architecture, Implementation Plan, API Contract
3. **Human:** Execute Phase 0 (create accounts, provide keys, `leads.csv`, GitHub repo)
4. **Cursor:** Restart IDE, complete `mcp_auth` for Supabase/Vercel plugins
5. **OpenCode:** Index project with codebase-memory MCP
6. **Both:** Confirm Phase 0 complete → Begin Phase 1 (Hook Grader Backend)

---

## Approval Gate

**Planning documents require Human approval before Phase 1 begins.**

| Document | Approved? | Notes |
|----------|-----------|-------|
| ASSIGNMENT_ANALYSIS.md | ⏳ | |
| ARCHITECTURE.md (Hook Grader) | ⏳ | Critical: atomic RPC, minute-aligned retries, UNVERIFIED status |
| IMPLEMENTATION_PLAN.md | ⏳ | |
| ACCEPTANCE_CRITERIA.md | ⏳ | |
| API_CONTRACT.md (Hook Grader) | ⏳ | **Both agents must approve** — atomic RPC, fallback semantics, idempotency |
| AGENT_HANDOFF.md | ⏳ | |
| TOOLING_INVENTORY.md | ⏳ | |
| PROJECT_MEMORY.md | ⏳ | |
| SCORING_SPEC.md | ⏳ | |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-10-14 | Initial creation of all planning documents | OpenCode |
| 2026-10-14 | Revision per review: durable webhook delivery, fallback semantics, idempotency, outbox pattern, test updates | OpenCode |
| 2026-10-14 | Repository preparation: folder structure, AGENTS.md, document moves, cross-reference fixes | OpenCode |