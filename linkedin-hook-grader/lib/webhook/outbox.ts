/**
 * Webhook Outbox Processor
 * Called by Vercel Cron every minute to process pending deliveries
 */

import { getPendingWebhooks, markWebhookDelivered, markWebhookFailed, logWebhookAttempt } from '@/lib/supabase/queries'
import { deliverWebhook, buildWebhookPayload } from './make'

/**
 * Process all pending webhook outbox entries
 * Called by Vercel Cron (GET /api/cron/process-webhooks)
 */
export async function processOutbox(): Promise<{
  processed: number
  delivered: number
  failed: number
  deadLetter: number
  errors: string[]
}> {
  const results = {
    processed: 0,
    delivered: 0,
    failed: 0,
    deadLetter: 0,
    errors: [] as string[],
  }

  try {
    const pendingWebhooks = await getPendingWebhooks()

    for (const outbox of pendingWebhooks) {
      results.processed++

      try {
        const payload = outbox.payload as unknown as Record<string, unknown>

        const deliveryResult = await deliverWebhook(outbox)

        if (deliveryResult.success) {
          await markWebhookDelivered(outbox.id, deliveryResult.statusCode, deliveryResult.responseBody ?? '')
          results.delivered++
        } else {
          const nextAttempt = outbox.attempt + 1
          // attempt is prior count; nextAttempt is the attempt just completed.
          // Dead-letter once we've used all allowed attempts (inclusive).
          const isDeadLetter = nextAttempt >= outbox.max_attempts

          await markWebhookFailed(
            outbox.id,
            nextAttempt,
            deliveryResult.statusCode,
            deliveryResult.error || 'Unknown error',
            deliveryResult.responseBody ?? null
          )

          if (isDeadLetter) {
            results.deadLetter++
            // Log alert for dead letter
            console.error(`DEAD LETTER: Webhook ${outbox.id} failed after ${outbox.max_attempts} attempts. Last error: ${deliveryResult.error}`)
          } else {
            results.failed++
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.errors.push(`Outbox ${outbox.id}: ${errorMessage}`)
        console.error(`Error processing outbox ${outbox.id}:`, errorMessage)

        // Try to mark as failed
        try {
          await markWebhookFailed(
            outbox.id,
            outbox.attempt + 1,
            0,
            errorMessage,
            null
          )
        } catch (markError) {
          console.error(`Failed to mark outbox ${outbox.id} as failed:`, markError)
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    results.errors.push(`Batch error: ${errorMessage}`)
    console.error('Batch outbox processing error:', errorMessage)
  }

  return results
}

/**
 * Manually trigger outbox processing (for testing)
 */
export async function triggerOutboxProcessing(): Promise<ReturnType<typeof processOutbox>> {
  return processOutbox()
}