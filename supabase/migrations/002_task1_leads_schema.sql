-- Task 1 Leads Schema
-- Migration: 002_task1_leads_schema.sql
-- Idempotency key is TEXT (csv_<lead_id> / hook_grader_<session_id>), not UUID.

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  idempotency_key TEXT NOT NULL UNIQUE,
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
  disposition TEXT,

  email_subject TEXT,
  email_draft TEXT,
  email_draft_source TEXT CHECK (
    email_draft_source IS NULL OR email_draft_source IN ('gemini', 'template_fallback')
  ),
  email_word_count INTEGER,

  zoho_draft_status TEXT,
  zoho_lead_id TEXT,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_idempotency ON leads(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_leads_source_tool ON leads(source_tool);
CREATE INDEX IF NOT EXISTS idx_leads_routing_tier ON leads(routing_tier);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Upsert helper for n8n / Task 1 retries
CREATE OR REPLACE FUNCTION upsert_task1_lead(p_row JSONB)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO leads (
    idempotency_key, external_session_id, source, source_tool,
    first_name, last_name, full_name, designation, email,
    company, company_website, linkedin_url, tool_input, tool_output,
    clean_flags, clean_reasons, score, service, score_reason, score_breakdown,
    routing_tier, routing_reason, alert_required, disposition,
    email_subject, email_draft, email_draft_source, email_word_count,
    zoho_draft_status, zoho_lead_id, errors, metadata, updated_at
  ) VALUES (
    p_row->>'idempotency_key',
    p_row->>'external_session_id',
    COALESCE(p_row->>'source', 'csv'),
    p_row->>'source_tool',
    p_row->>'first_name',
    p_row->>'last_name',
    p_row->>'full_name',
    p_row->>'designation',
    p_row->>'email',
    p_row->>'company',
    p_row->>'company_website',
    p_row->>'linkedin_url',
    p_row->>'tool_input',
    p_row->>'tool_output',
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_row->'clean_flags', '[]'::jsonb))), '{}'),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_row->'clean_reasons', '[]'::jsonb))), '{}'),
    NULLIF(p_row->>'score', '')::INTEGER,
    p_row->>'service',
    p_row->>'score_reason',
    p_row->'score_breakdown',
    COALESCE(p_row->>'routing_tier', 'not_a_fit'),
    COALESCE(p_row->>'routing_reason', 'unspecified'),
    COALESCE((p_row->>'alert_required')::BOOLEAN, FALSE),
    p_row->>'disposition',
    p_row->>'email_subject',
    p_row->>'email_draft',
    p_row->>'email_draft_source',
    NULLIF(p_row->>'email_word_count', '')::INTEGER,
    p_row->>'zoho_draft_status',
    p_row->>'zoho_lead_id',
    COALESCE(p_row->'errors', '[]'::jsonb),
    COALESCE(p_row->'metadata', '{}'::jsonb),
    NOW()
  )
  ON CONFLICT (idempotency_key) DO UPDATE SET
    external_session_id = EXCLUDED.external_session_id,
    source = EXCLUDED.source,
    source_tool = EXCLUDED.source_tool,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    full_name = EXCLUDED.full_name,
    designation = EXCLUDED.designation,
    email = EXCLUDED.email,
    company = EXCLUDED.company,
    company_website = EXCLUDED.company_website,
    linkedin_url = EXCLUDED.linkedin_url,
    tool_input = EXCLUDED.tool_input,
    tool_output = EXCLUDED.tool_output,
    clean_flags = EXCLUDED.clean_flags,
    clean_reasons = EXCLUDED.clean_reasons,
    score = EXCLUDED.score,
    service = EXCLUDED.service,
    score_reason = EXCLUDED.score_reason,
    score_breakdown = EXCLUDED.score_breakdown,
    routing_tier = EXCLUDED.routing_tier,
    routing_reason = EXCLUDED.routing_reason,
    alert_required = EXCLUDED.alert_required,
    disposition = EXCLUDED.disposition,
    email_subject = EXCLUDED.email_subject,
    email_draft = EXCLUDED.email_draft,
    email_draft_source = EXCLUDED.email_draft_source,
    email_word_count = EXCLUDED.email_word_count,
    zoho_draft_status = EXCLUDED.zoho_draft_status,
    zoho_lead_id = COALESCE(EXCLUDED.zoho_lead_id, leads.zoho_lead_id),
    errors = EXCLUDED.errors,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
