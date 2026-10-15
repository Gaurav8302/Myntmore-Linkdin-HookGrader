/**
 * API Route Integration Tests
 * Tests the /api/grade-hook endpoint with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/scoring', () => ({
  scoreHook: vi.fn(),
}))

vi.mock('@/lib/gemini/rewrite', () => ({
  generateRewrites: vi.fn(),
}))

vi.mock('@/lib/supabase/queries', () => ({
  insertSessionAtomic: vi.fn(),
}))

vi.mock('@/lib/webhook/make', () => ({
  buildWebhookPayload: vi.fn(),
}))

import { scoreHook } from '@/lib/scoring'
import { generateRewrites } from '@/lib/gemini/rewrite'
import { insertSessionAtomic } from '@/lib/supabase/queries'
import { buildWebhookPayload } from '@/lib/webhook/make'

describe('POST /api/grade-hook', () => {
  const validRequest = {
    name: 'John Doe',
    designation: 'Founder',
    email: 'john@example.com',
    hook: 'How I scaled to $1M ARR in 12 months?',
  }

  const mockScoreResult = {
    score: 100,
    failedRules: [] as string[],
    passedRules: ['All rules passed'] as string[],
  }

  const mockRewriteResult = {
    rewrites: [
      { hook: 'Rewrite 1', reason: 'Reason 1' },
      { hook: 'Rewrite 2', reason: 'Reason 2' },
      { hook: 'Rewrite 3', reason: 'Reason 3' },
    ],
    fallback: false,
  }

  const mockWebhookPayload = {
    session_id: 'test-session-id',
    timestamp: new Date().toISOString(),
    idempotency_key: 'hook_grader_test-session-id',
    source: 'hook_grader' as const,
    contact: {
      name: 'John Doe',
      designation: 'Founder',
      email: 'john@example.com',
    },
    hook: {
      original: validRequest.hook,
      score: 100,
      failed_rules: [] as string[],
      passed_rules: ['All rules passed'],
    },
    rewrites: mockRewriteResult.rewrites,
    metadata: {
      ip_hash: 'dGVzdA==',
      user_agent: 'test-agent',
      processing_ms: 12,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(scoreHook).mockReturnValue(mockScoreResult)
    vi.mocked(generateRewrites).mockResolvedValue(mockRewriteResult)
    vi.mocked(insertSessionAtomic).mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
    } as never)
    vi.mocked(buildWebhookPayload).mockImplementation(
      (sessionId, idempotencyKey, contact, hook, rewrites, metadata) => ({
        ...mockWebhookPayload,
        session_id: sessionId,
        idempotency_key: idempotencyKey,
        contact,
        hook,
        rewrites,
        metadata,
      }),
    )
  })

  const createRequest = (body: Record<string, unknown>) => {
    return new NextRequest('http://localhost:3000/api/grade-hook', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
        'user-agent': 'test-agent',
      },
    })
  }

  it('returns 200 with score and rewrites for valid input', async () => {
    const request = createRequest(validRequest)
    const response = await POST(request)

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(data.score).toBe(100)
    expect(data.rewrites).toHaveLength(3)
    expect(data.fallback).toBe(false)
    expect(data.fallbackReason).toBeUndefined()
  })

  it('returns 400 for missing name', async () => {
    const request = createRequest({ ...validRequest, name: '' })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for invalid email', async () => {
    const request = createRequest({ ...validRequest, email: 'not-an-email' })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for missing hook', async () => {
    const request = createRequest({ ...validRequest, hook: '' })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('returns 400 for hook too long', async () => {
    const request = createRequest({ ...validRequest, hook: 'a'.repeat(501) })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('handles optional designation', async () => {
    const request = createRequest({ ...validRequest, designation: undefined })
    const response = await POST(request)

    expect(response.status).toBe(200)
  })

  it('returns fallback=true when NVIDIA fails without echoing the original as rewrites', async () => {
    vi.mocked(generateRewrites).mockResolvedValue({
      rewrites: [],
      fallback: true,
      fallbackReason: 'NVIDIA_TIMEOUT',
    })

    const request = createRequest(validRequest)
    const response = await POST(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.fallback).toBe(true)
    expect(data.fallbackReason).toBe('NVIDIA_TIMEOUT')
    expect(data.rewrites).toEqual([])
  })

  it('returns 500 when Supabase insert fails', async () => {
    vi.mocked(insertSessionAtomic).mockRejectedValue(new Error('Failed to insert session'))

    const request = createRequest(validRequest)
    const response = await POST(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('PERSISTENCE_FAILED')
  })

  it('generates unique session ID', async () => {
    vi.mocked(insertSessionAtomic)
      .mockResolvedValueOnce({ id: '11111111-1111-1111-1111-111111111111' } as never)
      .mockResolvedValueOnce({ id: '22222222-2222-2222-2222-222222222222' } as never)

    const first = await (await POST(createRequest(validRequest))).json()
    const second = await (
      await POST(createRequest({ ...validRequest, email: 'jane@example.com' }))
    ).json()

    expect(first.sessionId).not.toBe(second.sessionId)
  })

  it('includes IP hash and user agent in payload', async () => {
    await POST(createRequest(validRequest))

    // session_id is blank here; insert_hook_grader_session RPC overwrites payload.session_id
    expect(buildWebhookPayload).toHaveBeenCalledWith(
      '',
      expect.stringMatching(/^hook_grader_[0-9a-f-]{36}$/i),
      expect.objectContaining({
        name: 'John Doe',
        designation: 'Founder',
        email: 'john@example.com',
      }),
      expect.any(Object),
      expect.any(Array),
      expect.objectContaining({
        ip_hash: expect.any(String),
        user_agent: 'test-agent',
        processing_ms: expect.any(Number),
      }),
    )
  })
})