# Task 1 Architecture — Lead Follow-up Engine

## Runtime (authoritative)

```
n8n Manual Trigger (CSV dry-run)
    │
    ▼
Code: Import Clean Score Route Draft
  (20 CSV rows embedded; clean → score → route → template draft → Zoho plan)
    │                    └── onError → Log Engine Failure ──┐
    ▼                                                       │
Switch: Hot / Warm / Not a fit / Unexpected                 │
    │                                                       │
    ▼                                                       │
Merge (append) ←────────────────────────────────────────────┘
    │
    ▼
Data Table upsert on idempotency_key → Build Run Summary
```

Make.com Task 2→1 bridge is **out of band** and deferred. When ready, Make.com will forward Hook Grader payloads into an n8n webhook trigger (same clean/score/route path).

## Supporting TypeScript (`automation/src`)

```
leads.csv → import/csv → clean/classify → score/rules → route
                              │
                              ▼
                     email/gemini (+ validator + fallback)
                              │
                              ▼
              adapters/supabase (dry-run) + adapters/zoho (draft-only)
```

Used for unit tests and `npm run process:csv`. Rules must stay aligned with `workflows/n8n-code/process-leads.js`.

## Safety

- `ZOHO_SEND_MODE` must be `draft` (CLI) / Zoho nodes draft-only (n8n).
- No send API.
- Not-a-fit leads never get email drafts.
- Prompt-injection content cannot raise scores or force Hot.
- Failures are visible as `errors[]` / `disposition=failed` vs expected `excluded`.
