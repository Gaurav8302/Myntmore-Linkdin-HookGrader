/**
 * Make.com Webhook Delivery Client
 * Called by Vercel Cron, not inline in API response
 * Lazy initialization to avoid build-time errors
 */

import type { WebhookOutbox } from '@/lib/supabase/types'

export type { WebhookPayload, WebhookPayloadMetadata } from '@/lib/supabase/types'

const WEBHOOK_TIMEOUT_MS = 10000 // 10 seconds

/**
 * Get the Make.com webhook URL, throwing if not configured.
 * Read from env on each call so tests can stub/clear secrets reliably.
 */
function getMakeWebhookUrl(): string {
  const url = process.env.MAKE_WEBHOOK_URL
  if (!url) {
    throw new Error('MAKE_WEBHOOK_URL environment variable is required')
  }
  return url
}

/**
 * Get the Make.com webhook secret (optional).
 * Empty string is treated as unset (no HMAC header).
 */
function getMakeWebhookSecret(): string | undefined {
  const secret = process.env.MAKE_WEBHOOK_SECRET
  return secret && secret.length > 0 ? secret : undefined
}

/**
 * Generate HMAC signature for webhook verification
 */
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return 'sha256=' + Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Deliver webhook to Make.com
 */
export async function deliverWebhook(outbox: WebhookOutbox): Promise<{ success: boolean; statusCode: number; error?: string; responseBody?: string }> {
  if (!getMakeWebhookUrl()) {
    throw new Error('MAKE_WEBHOOK_URL environment variable is required')
  }

  const payload = outbox.payload
  const payloadString = JSON.stringify(payload)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Myntmore-Timestamp': Math.floor(Date.now() / 1000).toString(),
    'X-Myntmore-Idempotency-Key': outbox.idempotency_key,
  }

  // Add HMAC signature if secret is configured
  const secret = getMakeWebhookSecret()
  if (secret) {
    headers['X-Myntmore-Signature'] = await generateSignature(payloadString, secret)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)

  try {
    const response = await fetch(getMakeWebhookUrl()!, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const responseBody = await response.text().catch(() => '')

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        error: `HTTP ${response.status}: ${responseBody || response.statusText}`,
        responseBody,
      }
    }

    return {
      success: true,
      statusCode: response.status,
      responseBody,
    }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        success: false,
        statusCode: 0,
        error: 'Webhook timeout (10s)',
      }
    }

    return {
      success: false,
      statusCode: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Build webhook payload for Make.com
 */
export function buildWebhookPayload(
  sessionId: string,
  idempotencyKey: string,
  contact: { name: string; designation: string | null; email: string },
  hook: { original: string; score: number; failed_rules: string[]; passed_rules: string[] },
  rewrites: Array<{ hook: string; reason: string }>,
  metadata: { ip_hash: string | null; user_agent: string | null; processing_ms: number }
): { 
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
  metadata: {
    ip_hash: string | null
    user_agent: string | null
    processing_ms: number
  }
} {
  return {
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    idempotency_key: idempotencyKey,
    source: 'hook_grader',
    contact: {
      name: contact.name,
      designation: contact.designation,
      email: contact.email,
    },
    hook: {
      original: hook.original,
      score: hook.score,
      failed_rules: hook.failed_rules,
      passed_rules: hook.passed_rules,
    },
    rewrites: rewrites.map(r => ({ hook: r.hook, reason: r.reason })),
    metadata,
  }
}