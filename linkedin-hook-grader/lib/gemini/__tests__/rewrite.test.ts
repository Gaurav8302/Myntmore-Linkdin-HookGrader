/**
 * Gemini Integration Unit Tests
 * Tests schema validation, fallback logic, and response parsing.
 * Uses mocks - does not call real Gemini API.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseGeminiResponse, buildUserPrompt, SYSTEM_PROMPT } from '../prompt'
import { Rewrite, FallbackReason, createFallbackResult } from '../rewrite'

describe('Gemini Prompt Building', () => {
  it('builds user prompt with all required context', () => {
    const hook = "I grew ARR to $1M in 12 months"
    const score = 87
    const failedRules = ['No question or curiosity gap detected']

    const prompt = buildUserPrompt(hook, score, failedRules)

    expect(prompt).toContain(hook)
    expect(prompt).toContain('87')
    expect(prompt).toContain('No question or curiosity gap detected')
    expect(prompt).toContain('3 distinct rewrites')
  })

  it('includes system prompt with all writing rules', () => {
    expect(SYSTEM_PROMPT).toContain('NO JARGON')
    expect(SYSTEM_PROMPT).toContain('NO EM DASHES')
    expect(SYSTEM_PROMPT).toContain('NO INVENTED NUMBERS')
    expect(SYSTEM_PROMPT).toContain('120 WORDS')
    expect(SYSTEM_PROMPT).toContain('myntmore.com/founder-meeting')
  })

  it('targets real scoring predicates and forbids score mutation', () => {
    expect(SYSTEM_PROMPT).toContain('TARGET THE ACTUAL PASS CONDITIONS')
    expect(SYSTEM_PROMPT).toContain('helped')
    expect(SYSTEM_PROMPT).toContain('Steal')
    expect(SYSTEM_PROMPT).toMatch(/NEVER calculate|must NOT recalculate|NEVER calculate/i)
    expect(SYSTEM_PROMPT).toContain('ONLY when the original hook already supports')

    const prompt = buildUserPrompt('Some hook', 44, [
      'Missing first-person authority signal with outcome',
      'Not action-oriented; no imperative or reader-focused structure',
    ])
    expect(prompt).toContain('read-only context')
    expect(prompt).toContain('must NOT recalculate')
    expect(prompt).toContain('Missing first-person authority')
  })
})

describe('Gemini Response Parsing', () => {
  const validResponse = {
    rewrites: [
      { hook: 'How I scaled to $1M ARR', reason: 'Adds curiosity gap' },
      { hook: 'My 12-month roadmap to $1M ARR', reason: 'Action oriented' },
      { hook: '0 to $1M ARR: the exact playbook', reason: 'Specific and structured' },
    ],
  }

  it('parses valid response with 3 rewrites', () => {
    const result = parseGeminiResponse(JSON.stringify(validResponse))

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ hook: 'How I scaled to $1M ARR', reason: 'Adds curiosity gap' })
    expect(result[1]).toEqual({ hook: 'My 12-month roadmap to $1M ARR', reason: 'Action oriented' })
    expect(result[2]).toEqual({ hook: '0 to $1M ARR: the exact playbook', reason: 'Specific and structured' })
  })

  it('trims whitespace from hook and reason', () => {
    const responseWithWhitespace = {
      rewrites: [
        { hook: '  How I scaled  ', reason: '  Adds curiosity  ' },
        { hook: '  My roadmap  ', reason: '  Action oriented  ' },
        { hook: '  The playbook  ', reason: '  Structured  ' },
      ],
    }

    const result = parseGeminiResponse(JSON.stringify(responseWithWhitespace))

    expect(result[0].hook).toBe('How I scaled')
    expect(result[0].reason).toBe('Adds curiosity')
  })

  it('throws for non-array rewrites', () => {
    const invalid = { rewrites: 'not an array' }
    expect(() => parseGeminiResponse(JSON.stringify(invalid))).toThrow('rewrites array')
  })

  it('throws for wrong number of rewrites', () => {
    const invalid = { rewrites: [{ hook: 'a', reason: 'b' }] }
    expect(() => parseGeminiResponse(JSON.stringify(invalid))).toThrow('Expected 3 rewrites, got 1')
  })

  it('throws for missing hook or reason', () => {
    const invalid = { rewrites: [{ hook: 'a' }, { hook: 'b', reason: 'c' }, { reason: 'd' }] }
    expect(() => parseGeminiResponse(JSON.stringify(invalid))).toThrow('missing hook or reason')
  })

  it('throws for empty hook', () => {
    const invalid = { rewrites: [{ hook: '', reason: 'b' }, { hook: 'c', reason: 'd' }, { hook: 'e', reason: 'f' }] }
    expect(() => parseGeminiResponse(JSON.stringify(invalid))).toThrow('hook is empty')
  })

  it('throws for empty reason', () => {
    const invalid = { rewrites: [{ hook: 'a', reason: '' }, { hook: 'b', reason: 'c' }, { hook: 'd', reason: 'e' }] }
    expect(() => parseGeminiResponse(JSON.stringify(invalid))).toThrow('reason is empty')
  })

  it('throws for rewrite exceeding 120 words', () => {
    const longHook = 'a '.repeat(130).trim()
    const invalid = { rewrites: [{ hook: longHook, reason: 'b' }, { hook: 'c', reason: 'd' }, { hook: 'e', reason: 'f' }] }
    expect(() => parseGeminiResponse(JSON.stringify(invalid))).toThrow('exceeds 120 words')
  })

  it('throws for em dash in rewrite', () => {
    const invalid = { rewrites: [{ hook: 'How I did it — the secret', reason: 'b' }, { hook: 'c', reason: 'd' }, { hook: 'e', reason: 'f' }] }
    expect(() => parseGeminiResponse(JSON.stringify(invalid))).toThrow('em dash')
  })

  it('throws for invalid JSON', () => {
    expect(() => parseGeminiResponse('not valid json')).toThrow('Failed to parse Gemini response')
  })
})

describe('Fallback Result Creation', () => {
  it('creates fallback with original hook echoed', () => {
    const originalHook = "I grew my ARR to $1M"
    const result = createFallbackResult(originalHook, 'NVIDIA_TIMEOUT')

    expect(result.fallback).toBe(true)
    expect(result.fallbackReason).toBe('NVIDIA_TIMEOUT')
    expect(result.rewrites).toHaveLength(3)
    expect(result.rewrites[0].hook).toBe(originalHook)
    expect(result.rewrites[0].reason).toBe('AI unavailable — original hook shown')
    expect(result.rewrites[1].hook).toBe(originalHook)
    expect(result.rewrites[2].hook).toBe(originalHook)
  })

  it('uses correct fallback reason types', () => {
    const reasons: FallbackReason[] = ['NVIDIA_TIMEOUT', 'NVIDIA_SCHEMA_ERROR', 'NVIDIA_RATE_LIMIT', 'NVIDIA_UNAVAILABLE']

    for (const reason of reasons) {
      const result = createFallbackResult('test hook', reason)
      expect(result.fallbackReason).toBe(reason)
    }
  })
})

describe('Gemini Integration Types', () => {
  it('validates Rewrite type structure', () => {
    const rewrite: Rewrite = {
      hook: 'Test hook',
      reason: 'Test reason',
    }
    expect(rewrite.hook).toBe('Test hook')
    expect(rewrite.reason).toBe('Test reason')
  })

  it('validates FallbackReason enum values', () => {
    const reasons: FallbackReason[] = ['NVIDIA_TIMEOUT', 'NVIDIA_SCHEMA_ERROR', 'NVIDIA_RATE_LIMIT', 'NVIDIA_UNAVAILABLE']
    expect(reasons).toHaveLength(4)
  })
})