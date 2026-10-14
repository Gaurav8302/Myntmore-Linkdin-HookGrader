-- Ensure webhook outbox payload.session_id matches the inserted session row.
-- Applied remotely as fix_outbox_payload_session_id; kept in repo for parity.

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
  v_payload JSONB;
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

  v_payload := jsonb_set(
    COALESCE(p_payload, '{}'::jsonb),
    '{session_id}',
    to_jsonb(v_session_id::text),
    true
  );

  INSERT INTO webhook_outbox (session_id, idempotency_key, payload, status, next_retry_at)
  VALUES (v_session_id, p_idempotency_key, v_payload, 'pending', NOW());

  RETURN v_session_id;
END;
$$;
