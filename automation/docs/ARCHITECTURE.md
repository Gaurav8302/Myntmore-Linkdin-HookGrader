# Task 1 Architecture — Lead Follow-up Engine

## Runtime (authoritative)

**n8n** orchestrates Task 1. Supporting TypeScript mirrors the same rules for tests and CLI.

### CSV dry-run (n8n)

```
n8n Manual Trigger (CSV dry-run)
    │
    ▼
Code: Import Clean Score Route Draft
  (20 CSV rows; clean → qualify → score → route → draft artifact → Zoho plan)
    │                    └── onError → Log Engine Failure ──┐
    ▼                                                       │
Switch: Hot / Warm / Not a fit / Unexpected                 │
    │                                                       │
    ▼                                                       │
Merge (append) ←────────────────────────────────────────────┘
    │
    ▼
Upsert (Supabase / interim Data Table) → Build Run Summary
```

Workflow ID: `RPh6nEfzP2mq7GFj`. Engine source: `workflows/n8n-code/process-leads.js`.

### Make.com Task 2 → Task 1 (mandatory bridge)

```
Hook Grader outbox → MAKE_WEBHOOK_URL (Make scenario 7960198)
    → HTTP forward → public tunnel → n8n /webhook/myntmore-hook-grader
    → local bridge POST http://127.0.0.1:8791/process-incoming
    → processIncomingLead() → Supabase + Zoho draft-only
```

Details and dated E2E evidence: [`../../docs/MAKE_BRIDGE_STATUS.md`](../../docs/MAKE_BRIDGE_STATUS.md).

Tunnel hostnames are temporary. Updating `N8N_PUBLIC_BASE_URL` in `.env.local` does **not** update Make — edit the scenario module URL.

## Supporting TypeScript (`automation/src`)

```
leads.csv → import/csv → clean/classify → qualify → score/rules → route
                              │
                              ▼
                     email (NVIDIA + validator + template fallback)
                              │
                              ▼
              adapters/supabase + adapters/zoho (draft-only, never sendMail)
```

CLI: `npm run process:csv`. Incoming: `npm run process:incoming` / `process:incoming:server`.

Rules must stay aligned with `workflows/n8n-code/process-leads.js`.

## Routing

| Tier | Behaviour |
|------|-----------|
| Hot | Score ≥ 8, email-eligible → draft + alert path |
| Warm | Score 5–7 → one nurture draft |
| Not a fit | No email draft; reason recorded |

Verified CSV dry-run (2026-10-17): Hot **12** / Warm **2** / Not a fit **6**.

## Safety

- `ZOHO_SEND_MODE` must remain `draft`.
- No send API.
- Not-a-fit leads never get email drafts.
- Prompt-injection content cannot raise scores or force Hot.
- Failures surface as `errors[]` / `disposition=failed` vs expected `excluded`.
- Zoho native draft capability: [`ZOHO_DRAFT_CAPABILITY.md`](./ZOHO_DRAFT_CAPABILITY.md).
