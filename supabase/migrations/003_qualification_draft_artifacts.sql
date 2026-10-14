-- Expand Task 1 service allow-list to seven Myntmore services + draft artifacts.
-- Safe additive migration; does not touch Hook Grader tables.

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_service_check;

ALTER TABLE leads ADD CONSTRAINT leads_service_check CHECK (
  service IS NULL OR service = ANY (ARRAY[
    'personal_branding',
    'linkedin_outreach',
    'cold_email',
    'lead_generation',
    'icp_mapping',
    'ai_lead_generation',
    'account_based_marketing',
    'gtm_strategy'
  ]::text[])
);

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_email_draft_source_check;

ALTER TABLE leads ADD CONSTRAINT leads_email_draft_source_check CHECK (
  email_draft_source IS NULL OR email_draft_source = ANY (ARRAY[
    'gemini',
    'nvidia',
    'template_fallback'
  ]::text[])
);

CREATE TABLE IF NOT EXISTS email_draft_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  draft_id TEXT NOT NULL UNIQUE,
  lead_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  artifact JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft_only' CHECK (status = 'draft_only'),
  send_attempted BOOLEAN NOT NULL DEFAULT FALSE CHECK (send_attempted = FALSE)
);

CREATE INDEX IF NOT EXISTS idx_email_draft_artifacts_lead ON email_draft_artifacts(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_draft_artifacts_idem ON email_draft_artifacts(idempotency_key);
