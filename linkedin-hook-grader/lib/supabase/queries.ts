/**
 * Supabase Query Helpers
 * All database operations for Hook Grader
 */

import { supabase } from './server'
import type {
  HookGraderSession,
  WebhookOutbox,
  WebhookDelivery,
  WebhookPayload,
  InsertHookGraderSessionParams,
  InsertHookGraderSessionResult,
} from './types'

/**
 * Insert session and outbox atomically via RPC function
 * This is the primary write operation - single transaction
 */
export async function insertSessionAtomic(params: InsertHookGraderSessionParams): Promise<InsertHookGraderSessionResult> {
  const { data, error } = await supabase.get().rpc('insert_hook_grader_session', {
    p_name: params.name,
    p_designation: params.designation,
    p_email: params.email,
    p_original_hook: params.original_hook,
    p_score: params.score,
    p_failed_rules: params.failed_rules,
    p_passed_rules: params.passed_rules,
    p_rewrite_1: params.rewrite_1,
    p_rewrite_1_reason: params.rewrite_1_reason,
    p_rewrite_2: params.rewrite_2,
    p_rewrite_2_reason: params.rewrite_2_reason,
    p_rewrite_3: params.rewrite_3,
    p_rewrite_3_reason: params.rewrite_3_reason,
    p_ip_hash: params.ip_hash,
    p_user_agent: params.user_agent,
    p_processing_ms: params.processing_ms,
    p_idempotency_key: params.idempotency_key,
    p_payload: params.payload,
  })

  if (error) {
    throw new Error(`Failed to insert session: ${error.message}`)
  }

  if (!data) {
    throw new Error('RPC returned no session ID')
  }

  return { id: data }
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<HookGraderSession | null> {
  const { data, error } = await supabase.get()
    .from('hook_grader_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    throw new Error(`Failed to get session: ${error.message}`)
  }

  return data
}

/**
 * Get pending webhook outbox entries for processing
 */
export async function getPendingWebhooks(): Promise<WebhookOutbox[]> {
  const { data, error } = await supabase.get()
    .from('webhook_outbox')
    .select('*')
    .eq('status', 'pending')
    .lte('next_retry_at', new Date().toISOString())
    .lt('attempt', 5) // max_attempts is 5
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to get pending webhooks: ${error.message}`)
  }

  return data || []
}

/**
 * Mark webhook as delivered
 */
export async function markWebhookDelivered(outboxId: string, statusCode: number, responseBody: string): Promise<void> {
  const { error } = await supabase.get()
    .from('webhook_outbox')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', outboxId)

  if (error) {
    throw new Error(`Failed to mark webhook delivered: ${error.message}`)
  }

  // Log delivery attempt
  await logWebhookAttempt({
    outbox_id: outboxId,
    attempt: 1, // This will be the final successful attempt
    status_code: statusCode,
    success: true,
    error: null,
    response_body: responseBody,
  })
}

/**
 * Mark webhook as failed and schedule retry
 */
export async function markWebhookFailed(outboxId: string, attempt: number, statusCode: number | null, errorMessage: string, responseBody: string | null): Promise<void> {
  const isLastAttempt = attempt >= 5 // max_attempts

  const { error } = await supabase.get()
    .from('webhook_outbox')
    .update({
      status: isLastAttempt ? 'dead_letter' : 'pending',
      attempt,
      last_error: errorMessage,
      next_retry_at: isLastAttempt ? null : calculateNextRetryAt(attempt),
      updated_at: new Date().toISOString(),
    })
    .eq('id', outboxId)

  if (error) {
    throw new Error(`Failed to mark webhook failed: ${error.message}`)
  }

  // Log delivery attempt
  await logWebhookAttempt({
    outbox_id: outboxId,
    attempt,
    status_code: statusCode,
    success: false,
    error: errorMessage,
    response_body: responseBody,
  })
}

/**
 * Log webhook delivery attempt
 */
export async function logWebhookAttempt(params: {
  outbox_id: string
  attempt: number
  status_code: number | null
  success: boolean
  error: string | null
  response_body: string | null
}): Promise<void> {
  const { error } = await supabase.get().from('webhook_deliveries').insert(params)

  if (error) {
    // Log but don't throw - delivery logging shouldn't break the main flow
    console.error('Failed to log webhook attempt:', error.message)
  }
}

/**
 * Calculate next retry time based on attempt number
 * Minute-aligned schedule: 1m, 5m, 15m, 30m, 60m
 */
function calculateNextRetryAt(attempt: number): string {
  const now = new Date()
  const minutes = [1, 5, 15, 30, 60]
  const delayMinutes = minutes[Math.min(attempt, minutes.length - 1)]
  now.setMinutes(now.getMinutes() + delayMinutes)
  return now.toISOString()
}

/**
 * Get session with webhook delivery status
 */
export async function getSessionWithDeliveryStatus(sessionId: string): Promise<{
  session: HookGraderSession | null
  outbox: WebhookOutbox | null
  deliveries: WebhookDelivery[]
} | null> {
  const session = await getSession(sessionId)
  if (!session) return null

  const { data: outbox, error: outboxError } = await supabase.get()
    .from('webhook_outbox')
    .select('*')
    .eq('session_id', sessionId)
    .single()

  if (outboxError && outboxError.code !== 'PGRST116') {
    throw new Error(`Failed to get outbox: ${outboxError.message}`)
  }

  const { data: deliveries, error: deliveriesError } = await supabase.get()
    .from('webhook_deliveries')
    .select('*')
    .eq('outbox_id', outbox?.id)
    .order('created_at', { ascending: true })

  if (deliveriesError) {
    throw new Error(`Failed to get deliveries: ${deliveriesError.message}`)
  }

  return {
    session,
    outbox: outbox || null,
    deliveries: deliveries || [],
  }
}