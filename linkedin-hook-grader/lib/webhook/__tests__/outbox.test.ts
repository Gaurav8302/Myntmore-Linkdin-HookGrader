/**
 * Outbox Processor Unit Tests
 * Tests outbox processing, retry scheduling, and dead letter handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processOutbox } from '../outbox'
import { getPendingWebhooks, markWebhookDelivered, markWebhookFailed } from '@/lib/supabase/queries'
import { deliverWebhook } from '../make'
import type { WebhookOutbox } from '@/lib/supabase/types'

// Mock dependencies
vi.mock('@/lib/supabase/queries', () => ({
  getPendingWebhooks: vi.fn(),
  markWebhookDelivered: vi.fn(),
  markWebhookFailed: vi.fn(),
  logWebhookAttempt: vi.fn(),
}))

vi.mock('../make', () => ({
  deliverWebhook: vi.fn(),
}))

describe('Outbox Processor', () => {
  const sampleOutbox: WebhookOutbox = {
    id: 'outbox-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    session_id: 'session-1',
    idempotency_key: 'hook_grader_session-1',
    payload: {
      session_id: 'session-1',
      timestamp: new Date().toISOString(),
      idempotency_key: 'hook_grader_session-1',
      source: 'hook_grader',
      contact: { name: 'Test', designation: null, email: 'test@example.com' },
      hook: {
        original: 'Test hook',
        score: 50,
        failed_rules: [],
        passed_rules: [],
      },
      rewrites: [
        { hook: 'a', reason: 'r' },
        { hook: 'b', reason: 'r' },
        { hook: 'c', reason: 'r' },
      ],
      metadata: { ip_hash: null, user_agent: null, processing_ms: 1 },
    },
    status: 'pending',
    attempt: 0,
    max_attempts: 5,
    next_retry_at: new Date(Date.now() - 60000).toISOString(), // 1 min ago
    last_error: null,
    delivered_at: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('processOutbox', () => {
    it('processes no webhooks when none pending', async () => {
      vi.mocked(getPendingWebhooks).mockResolvedValue([])

      const result = await processOutbox()

      expect(result.processed).toBe(0)
      expect(result.delivered).toBe(0)
      expect(result.failed).toBe(0)
      expect(result.deadLetter).toBe(0)
      expect(getPendingWebhooks).toHaveBeenCalledOnce()
    })

    it('delivers webhook successfully', async () => {
      vi.mocked(getPendingWebhooks).mockResolvedValue([sampleOutbox])
      vi.mocked(deliverWebhook).mockResolvedValue({
        success: true,
        statusCode: 200,
        responseBody: 'OK',
      })
      vi.mocked(markWebhookDelivered).mockResolvedValue(undefined)

      const result = await processOutbox()

      expect(result.processed).toBe(1)
      expect(result.delivered).toBe(1)
      expect(result.failed).toBe(0)
      expect(result.deadLetter).toBe(0)
      expect(markWebhookDelivered).toHaveBeenCalledWith('outbox-1', 200, 'OK')
    })

    it('handles webhook failure and schedules retry', async () => {
      vi.mocked(getPendingWebhooks).mockResolvedValue([sampleOutbox])
      vi.mocked(deliverWebhook).mockResolvedValue({
        success: false,
        statusCode: 500,
        error: 'Internal Server Error',
        responseBody: 'Error',
      })
      vi.mocked(markWebhookFailed).mockResolvedValue(undefined)

      const result = await processOutbox()

      expect(result.processed).toBe(1)
      expect(result.delivered).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.deadLetter).toBe(0)
      expect(markWebhookFailed).toHaveBeenCalledWith(
        'outbox-1',
        1, // attempt 1
        500,
        'Internal Server Error',
        'Error'
      )
    })

    it('marks as dead letter after max attempts', async () => {
      const deadLetterOutbox: WebhookOutbox = {
        ...sampleOutbox,
        attempt: 4, // Next attempt will be 5 (max)
      }

      vi.mocked(getPendingWebhooks).mockResolvedValue([deadLetterOutbox])
      vi.mocked(deliverWebhook).mockResolvedValue({
        success: false,
        statusCode: 500,
        error: 'Persistent failure',
        responseBody: 'Error',
      })
      vi.mocked(markWebhookFailed).mockResolvedValue(undefined)

      const result = await processOutbox()

      expect(result.processed).toBe(1)
      expect(result.delivered).toBe(0)
      expect(result.failed).toBe(0)
      expect(result.deadLetter).toBe(1)
      expect(markWebhookFailed).toHaveBeenCalledWith(
        'outbox-1',
        5, // attempt 5 (exceeds max)
        500,
        'Persistent failure',
        'Error'
      )
    })

    it('handles delivery timeout', async () => {
      vi.mocked(getPendingWebhooks).mockResolvedValue([sampleOutbox])
      vi.mocked(deliverWebhook).mockResolvedValue({
        success: false,
        statusCode: 0,
        error: 'Webhook timeout (10s)',
      })
      vi.mocked(markWebhookFailed).mockResolvedValue(undefined)

      const result = await processOutbox()

      expect(result.processed).toBe(1)
      expect(result.failed).toBe(1)
      expect(markWebhookFailed).toHaveBeenCalledWith(
        'outbox-1',
        1,
        0,
        'Webhook timeout (10s)',
        null
      )
    })

    it('continues processing other webhooks if one fails', async () => {
      const outbox2: WebhookOutbox = { ...sampleOutbox, id: 'outbox-2', idempotency_key: 'hook_grader_session-2' }

      vi.mocked(getPendingWebhooks).mockResolvedValue([sampleOutbox, outbox2])
      vi.mocked(deliverWebhook)
        .mockResolvedValueOnce({
          success: false,
          statusCode: 500,
          error: 'Error 1',
        })
        .mockResolvedValueOnce({
          success: true,
          statusCode: 200,
          responseBody: 'OK',
        })
      vi.mocked(markWebhookFailed).mockResolvedValue(undefined)
      vi.mocked(markWebhookDelivered).mockResolvedValue(undefined)

      const result = await processOutbox()

      expect(result.processed).toBe(2)
      expect(result.delivered).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.deadLetter).toBe(0)
    })

    it('handles unexpected errors gracefully', async () => {
      vi.mocked(getPendingWebhooks).mockResolvedValue([sampleOutbox])
      vi.mocked(deliverWebhook).mockRejectedValue(new Error('Unexpected error'))
      vi.mocked(markWebhookFailed).mockResolvedValue(undefined)

      const result = await processOutbox()

      expect(result.processed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Outbox outbox-1: Unexpected error')
      expect(markWebhookFailed).toHaveBeenCalled()
    })
  })
})