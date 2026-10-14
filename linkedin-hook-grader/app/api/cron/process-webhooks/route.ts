/**
 * Vercel Cron: GET /api/cron/process-webhooks
 * Processes pending webhook outbox entries
 * Authenticated via WEBHOOK_CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { processOutbox } from '@/lib/webhook/outbox'

const CRON_SECRET = process.env.WEBHOOK_CRON_SECRET

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const providedSecret = authHeader?.replace('Bearer ', '')

  if (!CRON_SECRET || providedSecret !== CRON_SECRET) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Invalid cron secret' },
      { status: 401 }
    )
  }

  try {
    const result = await processOutbox()

    return NextResponse.json({
      success: true,
      processed: result.processed,
      delivered: result.delivered,
      failed: result.failed,
      deadLetter: result.deadLetter,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Cron job error:', errorMessage)

    return NextResponse.json(
      { error: 'CRON_FAILED', message: errorMessage },
      { status: 500 }
    )
  }
}