/**
 * Make.com Webhook Client Unit Tests
 * Tests payload building, HMAC signing, and delivery logic with mocks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { deliverWebhook, buildWebhookPayload } from '../make'
import type { WebhookOutbox } from '@/lib/supabase/types'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock crypto.subtle for HMAC
const mockSign = vi.fn()
const mockImportKey = vi.fn()

Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      importKey: mockImportKey,
      sign: mockSign,
    },
  },
  writable: true,
})

describe('Make.com Webhook Client', () => {
  const mockEnv = {
    MAKE_WEBHOOK_URL: 'https://hook.make.com/test-webhook-id/hook-grader',
    MAKE_WEBHOOK_SECRET: 'test-secret',
    WEBHOOK_TIMEOUT_MS: '10000',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('MAKE_WEBHOOK_URL', mockEnv.MAKE_WEBHOOK_URL)
    vi.stubEnv('MAKE_WEBHOOK_SECRET', mockEnv.MAKE_WEBHOOK_SECRET)
    vi.stubEnv('WEBHOOK_TIMEOUT_MS', mockEnv.WEBHOOK_TIMEOUT_MS)

    mockImportKey.mockResolvedValue('mock-key')
    mockSign.mockResolvedValue(new ArrayBuffer(32))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('buildWebhookPayload', () => {
    it('builds correct payload structure', () => {
      const sessionId = 'test-session-id'
      const idempotencyKey = 'hook_grader_test-session-id'
      const contact = { name: 'John Doe', designation: 'Founder', email: 'john@example.com' }
      const hook = {
        original: 'I grew ARR to $1M',
        score: 87,
        failed_rules: ['No curiosity gap'],
        passed_rules: ['Specificity', 'Authority'],
      }
      const rewrites = [
        { hook: 'How I grew ARR', reason: 'Adds curiosity' },
        { hook: 'My roadmap to $1M', reason: 'Action oriented' },
        { hook: '0 to $1M playbook', reason: 'Structured' },
      ]
      const metadata = { ip_hash: 'abc123', user_agent: 'Mozilla/5.0', processing_ms: 1247 }

      const payload = buildWebhookPayload(sessionId, idempotencyKey, contact, hook, rewrites, metadata)

      expect(payload.session_id).toBe(sessionId)
      expect(payload.idempotency_key).toBe(idempotencyKey)
      expect(payload.source).toBe('hook_grader')
      expect(payload.contact).toEqual({
        name: 'John Doe',
        designation: 'Founder',
        email: 'john@example.com',
      })
      expect(payload.hook).toEqual({
        original: 'I grew ARR to $1M',
        score: 87,
        failed_rules: ['No curiosity gap'],
        passed_rules: ['Specificity', 'Authority'],
      })
      expect(payload.rewrites).toHaveLength(3)
      expect(payload.rewrites[0]).toEqual({ hook: 'How I grew ARR', reason: 'Adds curiosity' })
      expect(payload.metadata).toEqual({
        ip_hash: 'abc123',
        user_agent: 'Mozilla/5.0',
        processing_ms: 1247,
      })
    })

    it('handles null designation', () => {
      const contact = { name: 'John', designation: null, email: 'john@example.com' }
      const payload = buildWebhookPayload('id', 'key', contact, { original: '', score: 0, failed_rules: [], passed_rules: [] }, [], { ip_hash: null, user_agent: '', processing_ms: 0 })

      expect(payload.contact.designation).toBeNull()
    })
  })

  describe('deliverWebhook', () => {
    const sampleOutbox: WebhookOutbox = {
      id: 'outbox-id',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      session_id: 'session-id',
      idempotency_key: 'hook_grader_session-id',
      payload: {
        session_id: 'session-id',
        timestamp: '2026-10-14T12:00:00Z',
        idempotency_key: 'hook_grader_session-id',
        source: 'hook_grader',
        contact: { name: 'John', designation: 'Founder', email: 'john@example.com' },
        hook: { original: 'test', score: 50, failed_rules: [], passed_rules: [] },
        rewrites: [{ hook: 'r1', reason: 'r1' }, { hook: 'r2', reason: 'r2' }, { hook: 'r3', reason: 'r3' }],
        metadata: { ip_hash: 'hash', user_agent: 'agent', processing_ms: 100 },
      },
      status: 'pending',
      attempt: 0,
      max_attempts: 5,
      next_retry_at: new Date().toISOString(),
      last_error: null,
      delivered_at: null,
    }

    it('sends POST with correct headers on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => 'OK',
      })

      const result = await deliverWebhook(sampleOutbox)

      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)
      expect(mockFetch).toHaveBeenCalledWith(
        mockEnv.MAKE_WEBHOOK_URL,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Myntmore-Idempotency-Key': 'hook_grader_session-id',
            'X-Myntmore-Timestamp': expect.any(String),
            'X-Myntmore-Signature': expect.stringMatching(/^sha256=/),
          }),
          body: JSON.stringify(sampleOutbox.payload),
        })
      )
    })

    it('includes HMAC signature when secret is set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => 'OK',
      })

      await deliverWebhook(sampleOutbox)

      const call = mockFetch.mock.calls[0]
      const headers = call[1].headers as Record<string, string>
      expect(headers['X-Myntmore-Signature']).toMatch(/^sha256=/)
    })

    it('returns error for non-2xx response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      })

      const result = await deliverWebhook(sampleOutbox)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(500)
      expect(result.error).toContain('500')
    })

    it('returns error for timeout', async () => {
      mockFetch.mockImplementationOnce(() =>
        new Promise((_, reject) => setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 50))
      )

      const result = await deliverWebhook(sampleOutbox)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(0)
      expect(result.error).toBe('Webhook timeout (10s)')
    })

    it('returns error for network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await deliverWebhook(sampleOutbox)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(0)
      expect(result.error).toBe('Network error')
    })

    it('does not include signature when secret is not set', async () => {
      vi.unstubAllEnvs()
      vi.stubEnv('MAKE_WEBHOOK_URL', mockEnv.MAKE_WEBHOOK_URL)
      vi.stubEnv('MAKE_WEBHOOK_SECRET', '')
      vi.stubEnv('WEBHOOK_TIMEOUT_MS', mockEnv.WEBHOOK_TIMEOUT_MS)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => 'OK',
      })

      await deliverWebhook(sampleOutbox)

      const call = mockFetch.mock.calls[0]
      const headers = call[1].headers as Record<string, string>
      expect(headers['X-Myntmore-Signature']).toBeUndefined()
    })
  })
})