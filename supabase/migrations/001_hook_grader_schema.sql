-- Hook Grader Schema (Task 2)
-- Migration: 001_hook_grader_schema.sql
-- Description: Creates tables and RPC function for LinkedIn Hook Grader session persistence and durable webhook delivery

-- Hook Grader sessions table
CREATE TABLE IF NOT EXISTS hook_grader_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Contact info
  name TEXT NOT NULL,
  designation TEXT,
  email TEXT NOT NULL,
  
  -- Hook input
  original_hook TEXT NOT NULL,
  
  -- Scoring
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  failed_rules TEXT[],
  passed_rules TEXT[],
  
  -- Gemini rewrites (or fallback)
  rewrite_1 TEXT NOT NULL,
  rewrite_1_reason TEXT NOT NULL,
  rewrite_2 TEXT NOT NULL,
  rewrite_2_reason TEXT NOT NULL,
  rewrite_3 TEXT NOT NULL,
  rewrite_3_reason TEXT NOT NULL,
  
  -- Metadata
  ip_hash TEXT,
  user_agent TEXT,
  processing_ms INTEGER
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_hook_grader_email ON hook_grader_sessions(email);
CREATE INDEX IF NOT EXISTS idx_hook_grader_created ON hook_grader_sessions(created_at DESC);

-- Webhook outbox table (durable delivery queue)
CREATE TABLE IF NOT EXISTS webhook_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  session_id UUID NOT NULL REFERENCES hook_grader_sessions(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'dead_letter')),
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  delivered_at TIMESTAMPTZ
);

-- Indexes for outbox processing
CREATE INDEX IF NOT EXISTS idx_webhook_outbox_status ON webhook_outbox(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_webhook_outbox_session ON webhook_outbox(session_id);

-- Webhook delivery log (per-attempt)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  outbox_id UUID NOT NULL REFERENCES webhook_outbox(id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL,
  status_code INTEGER,
  success BOOLEAN NOT NULL,
  error TEXT,
  response_body TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_outbox ON webhook_deliveries(outbox_id);

-- Atomic RPC function: insert session + outbox in single transaction
CREATE OR REPLACE FUNCTION insert_hook_grader_session(
  p_name TEXT,
  p_designation TEXT,
  p_email TEXT,
  p_original_hook TEXT,
  p_score INTEGER,
  p_failed_rules TEXT[],
  p_passed_rules TEXT[],
  p_rewrite_1 TEXT,
  p_rewrite_1_reason TEXT,
  p_rewrite_2 TEXT,
  p_rewrite_2_reason TEXT,
  p_rewrite_3 TEXT,
  p_rewrite_3_reason TEXT,
  p_ip_hash TEXT,
  p_user_agent TEXT,
  p_processing_ms INTEGER,
  p_idempotency_key TEXT,
  p_payload JSONB
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO hook_grader_sessions (
    name, designation, email, original_hook, score,
    failed_rules, passed_rules,
    rewrite_1, rewrite_1_reason,
    rewrite_2, rewrite_2_reason,
    rewrite_3, rewrite_3_reason,
    ip_hash, user_agent, processing_ms
  ) VALUES (
    p_name, p_designation, p_email, p_original_hook, p_score,
    p_failed_rules, p_passed_rules,
    p_rewrite_1, p_rewrite_1_reason,
    p_rewrite_2, p_rewrite_2_reason,
    p_rewrite_3, p_rewrite_3_reason,
    p_ip_hash, p_user_agent, p_processing_ms
  ) RETURNING id INTO v_session_id;

  INSERT INTO webhook_outbox (session_id, idempotency_key, payload, status, next_retry_at)
  VALUES (v_session_id, p_idempotency_key, p_payload, 'pending', NOW());

  RETURN v_session_id;
END;
$$;

-- Row Level Security (optional: enable if needed)
-- ALTER TABLE hook_grader_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE webhook_outbox ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Grant usage to service role (for API route)
-- GRANT USAGE ON SCHEMA public TO service_role;
-- GRANT ALL ON hook_grader_sessions TO service_role;
-- GRANT ALL ON webhook_outbox TO service_role;
-- GRANT ALL ON webhook_deliveries TO service_role;