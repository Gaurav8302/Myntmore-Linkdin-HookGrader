/**
 * Supabase Type Definitions
 * Generated from database schema
 */

export interface HookGraderSession {
  id: string
  created_at: string
  name: string
  designation: string | null
  email: string
  original_hook: string
  score: number
  failed_rules: string[]
  passed_rules: string[]
  rewrite_1: string
  rewrite_1_reason: string
  rewrite_2: string
  rewrite_2_reason: string
  rewrite_3: string
  rewrite_3_reason: string
  ip_hash: string | null
  user_agent: string | null
  processing_ms: number | null
}

export interface WebhookPayloadMetadata {
  ip_hash: string | null
  user_agent: string | null
  processing_ms: number
}

export interface WebhookPayload {
  session_id: string
  timestamp: string
  idempotency_key: string
  source: 'hook_grader'
  contact: {
    name: string
    designation: string | null
    email: string
  }
  hook: {
    original: string
    score: number
    failed_rules: string[]
    passed_rules: string[]
  }
  rewrites: Array<{ hook: string; reason: string }>
  metadata: WebhookPayloadMetadata
}

export interface WebhookOutbox {
  id: string
  created_at: string
  updated_at: string
  session_id: string
  idempotency_key: string
  payload: WebhookPayload
  status: 'pending' | 'delivered' | 'dead_letter'
  attempt: number
  max_attempts: number
  next_retry_at: string | null
  last_error: string | null
  delivered_at: string | null
}

export interface WebhookDelivery {
  id: string
  created_at: string
  outbox_id: string
  attempt: number
  status_code: number | null
  success: boolean
  error: string | null
  response_body: string | null
}

export interface InsertHookGraderSessionParams {
  name: string
  designation: string | null
  email: string
  original_hook: string
  score: number
  failed_rules: string[]
  passed_rules: string[]
  rewrite_1: string
  rewrite_1_reason: string
  rewrite_2: string
  rewrite_2_reason: string
  rewrite_3: string
  rewrite_3_reason: string
  ip_hash: string | null
  user_agent: string | null
  processing_ms: number
  idempotency_key: string
  payload: WebhookPayload
}

export interface InsertHookGraderSessionResult {
  id: string
}