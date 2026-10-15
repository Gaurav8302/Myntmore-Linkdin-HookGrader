/**
 * API Route: POST /api/grade-hook
 * Grades a LinkedIn hook, generates rewrites, persists session atomically
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { scoreHook } from '@/lib/scoring'
import { generateRewrites, type RewriteResult } from '@/lib/gemini/rewrite'
import { insertSessionAtomic } from '@/lib/supabase/queries'
import { buildWebhookPayload } from '@/lib/webhook/make'
import { processOutbox } from '@/lib/webhook/outbox'
import { randomUUID } from 'crypto'

// Request validation schema
const requestSchema = z.object({
  name: z.string().min(1).max(100),
  designation: z.string().max(100).optional().nullable(),
  email: z.string().email(),
  hook: z.string().min(2).max(500),
})

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Parse and validate request
    const body = await request.json()
    const validation = requestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: validation.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      )
    }

    const { name, designation, email, hook } = validation.data

    // Step 1: Deterministic scoring
    const scoreResult = scoreHook(hook)

    // Step 2: Generate rewrites via NVIDIA (score remains deterministic)
    const rewriteResult = await generateRewrites(hook, scoreResult.score, scoreResult.failedRules)

    // Step 3: Prepare rewrites for storage / response.
    // Do not echo the original hook as fake rewrite options when generation fails.
    const rewrites = rewriteResult.rewrites
    const emptySlotReason =
      rewriteResult.fallbackReason === 'INSUFFICIENT_ALTERNATIVES' ||
      rewriteResult.fallbackReason === 'NO_IMPROVED_REWRITE'
        ? 'No valid rewrite alternative generated within retry limit'
        : 'Rewrite unavailable'
    const rewriteSlot = (index: number) => ({
      hook: rewrites[index]?.hook ?? '',
      reason: rewrites[index]?.reason ?? emptySlotReason,
    })
    const slot1 = rewriteSlot(0)
    const slot2 = rewriteSlot(1)
    const slot3 = rewriteSlot(2)

    // Step 4: Build webhook payload for outbox.
    // session_id is set by insert_hook_grader_session RPC to the canonical row id.
    const idempotencyKey = `hook_grader_${randomUUID()}`
    const webhookPayload = buildWebhookPayload(
      '',
      idempotencyKey,
      { name, designation: designation || null, email },
      {
        original: hook,
        score: scoreResult.score,
        failed_rules: scoreResult.failedRules,
        passed_rules: scoreResult.passedRules,
      },
      rewrites,
      {
        ip_hash: request.headers.get('x-forwarded-for')
          ? Buffer.from(request.headers.get('x-forwarded-for') || '').toString('base64').slice(0, 64)
          : null,
        user_agent: request.headers.get('user-agent') || null,
        processing_ms: Date.now() - startTime,
      }
    )

    // Step 5: Atomic insert session + outbox (RPC returns canonical session id
    // and rewrites payload.session_id to match).
    const inserted = await insertSessionAtomic({
      name,
      designation: designation || null,
      email,
      original_hook: hook,
      score: scoreResult.score,
      failed_rules: scoreResult.failedRules,
      passed_rules: scoreResult.passedRules,
      rewrite_1: slot1.hook,
      rewrite_1_reason: slot1.reason,
      rewrite_2: slot2.hook,
      rewrite_2_reason: slot2.reason,
      rewrite_3: slot3.hook,
      rewrite_3_reason: slot3.reason,
      ip_hash: webhookPayload.metadata.ip_hash as string | null,
      user_agent: webhookPayload.metadata.user_agent as string | null,
      processing_ms: webhookPayload.metadata.processing_ms as number,
      idempotency_key: idempotencyKey,
      payload: webhookPayload,
    })
    const sessionId = inserted.id

    // Best-effort immediate outbox flush so delivery does not wait solely on cron.
    // Failures are non-blocking; cron remains the durable retry path.
    void processOutbox().catch((err) => {
      console.error('Immediate outbox flush failed:', err instanceof Error ? err.message : err)
    })

    // Step 6: Return response
    const response = {
      sessionId,
      score: scoreResult.score,
      failedRules: scoreResult.failedRules,
      passedRules: scoreResult.passedRules,
      rewrites: rewrites.map(r => ({
        hook: r.hook,
        reason: r.reason,
        score: r.score,
        scoreDelta: r.scoreDelta,
      })),
      fallback: rewriteResult.fallback,
      fallbackReason: rewriteResult.fallbackReason,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error grading hook:', errorMessage)

    // Check if it's a persistence error
    if (errorMessage.includes('insert session') || errorMessage.includes('RPC') || errorMessage.includes('database')) {
      return NextResponse.json(
        {
          error: 'PERSISTENCE_FAILED',
          message: 'Failed to save session. Please try again.',
          requestId: randomUUID(),
        },
        { status: 500 }
      )
    }

    // Generic server error
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again.',
        requestId: randomUUID(),
      },
      { status: 500 }
    )
  }
}