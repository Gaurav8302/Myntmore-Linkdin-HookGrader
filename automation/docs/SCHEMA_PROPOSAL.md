# Proposed Task 1 Supabase Schema

**Status:** Proposal only — **not applied** to `supabase/migrations/`.  
**Reason:** Shared migrations require coordinated approval per `AGENTS.md`.

## Problem with placeholder `002_task1_leads_schema.sql`

The placeholder suggests:

```sql
external_id UUID UNIQUE  -- for idempotency (e.g., hook_grader_<session_id>)
```

This conflicts with the provisional Hook Grader contract, where idempotency keys are **strings** like `hook_grader_<uuid>` and CSV keys are `csv_L01`. A UUID column cannot store those keys.

## Proposed replacement (for approval)

Replace the commented placeholder in `supabase/migrations/002_task1_leads_schema.sql` with:

```sql
-- Task 1 Leads Schema (proposed by Cursor — awaiting approval)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Idempotency: string, NOT uuid
  idempotency_key TEXT NOT NULL UNIQUE,
  -- Optional raw session id from source (csv lead_id or hook grader session uuid as text)
  external_session_id TEXT,

  source TEXT NOT NULL,
  source_tool TEXT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  designation TEXT,
  email TEXT,
  company TEXT,
  company_website TEXT,
  linkedin_url TEXT,
  tool_input TEXT,
  tool_output TEXT,

  clean_flags TEXT[] NOT NULL DEFAULT '{}',
  clean_reasons TEXT[] NOT NULL DEFAULT '{}',

  score INTEGER CHECK (score IS NULL OR score BETWEEN 1 AND 10),
  service TEXT CHECK (
    service IS NULL OR service IN (
      'personal_branding',
      'linkedin_outreach',
      'cold_email',
      'lead_generation'
    )
  ),
  score_reason TEXT,
  score_breakdown JSONB,

  routing_tier TEXT NOT NULL CHECK (routing_tier IN ('hot', 'warm', 'not_a_fit')),
  routing_reason TEXT NOT NULL,
  alert_required BOOLEAN NOT NULL DEFAULT FALSE,

  email_subject TEXT,
  email_draft TEXT,
  email_draft_source TEXT CHECK (
    email_draft_source IS NULL OR email_draft_source IN ('gemini', 'template_fallback')
  ),
  email_word_count INTEGER,

  zoho_draft_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_idempotency ON leads(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_leads_source_tool ON leads(source_tool);
CREATE INDEX IF NOT EXISTS idx_leads_routing_tier ON leads(routing_tier);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- Service role inserts/updates only (policy details with Human/OpenCode)
```

## Idempotency strategy

| Source | `idempotency_key` | Behavior |
|--------|-------------------|----------|
| CSV import | `csv_<lead_id>` | Upsert; retries safe |
| Hook Grader via Make.com (future) | `hook_grader_<session_id>` | Upsert; Make.com + Task 1 both dedupe |

Do **not** use UUID-typed `external_id` for the idempotency key.

### Collision / uniqueness analysis

| Concern | Assessment |
|---------|------------|
| `csv_L01` vs `hook_grader_<uuid>` | **No collision** — distinct prefixes |
| Same CSV row retried | Same `csv_<lead_id>` → upsert overwrites; no duplicate row |
| Same Hook Grader session retried | Same `hook_grader_<session_id>` → upsert; no duplicate lead |
| Duplicate **contacts** (L03/L11) | Different `lead_id` → different keys (`csv_L03`, `csv_L11`); both retained |
| Email uniqueness | **Not** unique — intentional; multiple tool sessions per person allowed |
| Draft retries | Zoho/n8n must key drafts by `idempotency_key` (or equivalent) so retries do not create duplicate CRM drafts |
| Data model | Keep `idempotency_key TEXT UNIQUE` as the only natural upsert key; store raw session id separately in `external_session_id` |

### Interim n8n persistence

Until shared Supabase migration is approved, the n8n Data Table `myntmore_task1_leads` upserts on `idempotency_key` for dry-run durability. This does **not** replace the approved Supabase schema.

## Exact coordinated change requested

1. Human/OpenCode approve this proposal.
2. Cursor (or agreed owner) replaces commented body of `supabase/migrations/002_task1_leads_schema.sql` with the SQL above.
3. Apply migration to the shared Supabase project.
4. Only then set `PIPELINE_MODE=live` with service-role credentials.

Until then, the automation runs in **dry-run** persistence mode.
