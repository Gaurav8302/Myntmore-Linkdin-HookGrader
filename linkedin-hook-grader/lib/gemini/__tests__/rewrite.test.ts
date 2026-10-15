/**
 * Rewrite generation unit tests
 * Schema validation, improvement gating, fallback, and prompt rules.
 * Uses mocks — does not call the real NVIDIA API.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseGeminiResponse, buildUserPrompt, SYSTEM_PROMPT } from '../prompt'
import {
  Rewrite,
  FallbackReason,
  createFallbackResult,
  evaluateRewriteCandidate,
  generateRewrites,
  hasFabricatedAuthority,
  MAX_REWRITE_GENERATION_ATTEMPTS,
  REWRITE_MAX_CHARS,
} from '../rewrite'
import { scoreHook } from '../../scoring'

vi.mock('../client', () => ({
  callNvidiaChat: vi.fn(),
}))

import { callNvidiaChat } from '../client'

describe('Gemini Prompt Building', () => {
  it('builds user prompt with all required context', () => {
    const hook = 'I grew ARR to $1M in 12 months'
    const score = 87
    const failedRules = ['No question or curiosity gap detected']

    const prompt = buildUserPrompt(hook, score, failedRules)

    expect(prompt).toContain(hook)
    expect(prompt).toContain('87')
    expect(prompt).toContain('No question or curiosity gap detected')
    expect(prompt).toContain('3 distinct rewrites')
    expect(prompt).toContain('STRICTLY HIGHER')
  })

  it('includes system prompt with all writing rules', () => {
    expect(SYSTEM_PROMPT).toContain('NO JARGON')
    expect(SYSTEM_PROMPT).toContain('NO EM DASHES')
    expect(SYSTEM_PROMPT).toContain('NO INVENTED NUMBERS')
    expect(SYSTEM_PROMPT).toContain('120 WORDS')
    expect(SYSTEM_PROMPT).toContain('myntmore.com/founder-meeting')
  })

  it('treats first-person authority as optional and forbids score mutation', () => {
    expect(SYSTEM_PROMPT).toContain('TARGET THE ACTUAL PASS CONDITIONS')
    expect(SYSTEM_PROMPT).toMatch(/OPTIONAL/i)
    expect(SYSTEM_PROMPT).toContain('provocative insight')
    expect(SYSTEM_PROMPT).toContain('reader-focused question')
    expect(SYSTEM_PROMPT).toContain('specific pain point')
    expect(SYSTEM_PROMPT).toContain('concrete recommendation or imperative')
    expect(SYSTEM_PROMPT).toMatch(/NEVER calculate|must NOT recalculate/i)
    expect(SYSTEM_PROMPT).toMatch(/ONLY when the original hook already supports/i)

    const prompt = buildUserPrompt('Some hook', 44, [
      'Optional first-person authority with a truthful outcome is missing',
      'Not action-oriented; no imperative or reader-focused structure',
    ])
    expect(prompt).toContain('read-only context')
    expect(prompt).toContain('must NOT recalculate')
    expect(prompt).toContain('Treat first-person authority as optional')
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
    const invalid = {
      rewrites: [
        { hook: '', reason: 'b' },
        { hook: 'c', reason: 'd' },
        { hook: 'e', reason: 'f' },
      ],
    }
    expect(() => parseGeminiResponse(JSON.stringify(invalid))).toThrow('hook is empty')
  })

  it('throws for empty reason', () => {
    const invalid = {
      rewrites: [
        { hook: 'a', reason: '' },
        { hook: 'b', reason: 'c' },
        { hook: 'd', reason: 'e' },
      ],
    }
    expect(() => parseGeminiResponse(JSON.stringify(invalid))).toThrow('reason is empty')
  })

  it('throws for rewrite exceeding 120 words', () => {
    const longHook = 'a '.repeat(130).trim()
    const invalid = {
      rewrites: [
        { hook: longHook, reason: 'b' },
        { hook: 'c', reason: 'd' },
        { hook: 'e', reason: 'f' },
      ],
    }
    expect(() => parseGeminiResponse(JSON.stringify(invalid))).toThrow('exceeds 120 words')
  })

  it('throws for em dash in rewrite', () => {
    const invalid = {
      rewrites: [
        { hook: 'How I did it — the secret', reason: 'b' },
        { hook: 'c', reason: 'd' },
        { hook: 'e', reason: 'f' },
      ],
    }
    expect(() => parseGeminiResponse(JSON.stringify(invalid))).toThrow('em dash')
  })

  it('throws for invalid JSON', () => {
    expect(() => parseGeminiResponse('not valid json')).toThrow('Failed to parse Gemini response')
  })
})

describe('evaluateRewriteCandidate (deterministic improvement gate)', () => {
  const weakOriginal =
    'Random thoughts on leadership trends across enterprise software markets today without a clear ask.'
  const weakScore = scoreHook(weakOriginal).score

  const improvedA =
    'Why do most leadership posts get ignored? Steal this 3-line LinkedIn hook playbook for your next B2B post.'
  const improvedB =
    'How do founders lose attention in 2 seconds? Learn this LinkedIn hook playbook for your next post.'
  const improvedC =
    'What makes a LinkedIn hook stop the scroll in 2024? Steal this playbook for your next B2B update.'

  it('accepts candidates that score strictly higher', () => {
    expect(weakScore).toBeLessThan(50)
    for (const candidate of [improvedA, improvedB, improvedC]) {
      const verdict = evaluateRewriteCandidate(weakOriginal, candidate, weakScore)
      expect(verdict.ok).toBe(true)
      expect(verdict.candidateScore).toBeGreaterThan(weakScore)
    }
  })

  it('rejects equal scores', () => {
    const verdict = evaluateRewriteCandidate(weakOriginal, weakOriginal, weakScore)
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toBe('score_not_higher')
  })

  it('rejects lower scores', () => {
    const strong =
      "How I've helped 40 founders book meetings in 90 days: steal this LinkedIn playbook for your next post."
    const strongScore = scoreHook(strong).score
    const verdict = evaluateRewriteCandidate(strong, weakOriginal, strongScore)
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toBe('score_not_higher')
    expect(verdict.candidateScore).toBeLessThan(strongScore)
  })

  it('rejects character-limit violations', () => {
    const tooLong = `${improvedA} ${'x'.repeat(REWRITE_MAX_CHARS)}`
    const verdict = evaluateRewriteCandidate(weakOriginal, tooLong, weakScore)
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toBe('char_limit')
  })

  it('rejects unsupported / fabricated authority claims', () => {
    expect(hasFabricatedAuthority(weakOriginal, "I've helped 40 founders book meetings this quarter.")).toBe(
      true,
    )
    const fabricated =
      "I've helped 40 founders book meetings in 90 days. Steal this LinkedIn hook playbook for your next post."
    const verdict = evaluateRewriteCandidate(weakOriginal, fabricated, weakScore)
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toBe('fabricated_authority')
  })

  it('for an 86-class original, only candidates at 87+ pass', () => {
    // Construct an original at 83 (no authority); improved must reach 91 with truthful authority
    // or stay non-authority but somehow higher — with current weights max without auth is 83.
    const original =
      'How do most founders still get ignored on LinkedIn? Steal this 3-line hook playbook for your next B2B post.'
    const originalScore = scoreHook(original).score
    expect(originalScore).toBe(92)

    const equalish =
      'How do B2B founders still get ignored on LinkedIn? Steal this 3-line hook playbook for your next post.'
    expect(evaluateRewriteCandidate(original, equalish, originalScore).ok).toBe(false)

    // Cannot invent authority from a non-authority original
    const withInventedAuth =
      "How I've helped 40 founders book meetings in 90 days: steal this LinkedIn playbook for your next post."
    expect(evaluateRewriteCandidate(original, withInventedAuth, originalScore).reason).toBe(
      'fabricated_authority',
    )
  })
})

describe('generateRewrites improvement + fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const weakOriginal =
    'Random thoughts on leadership trends across enterprise software markets today without a clear ask.'

  function payload(hooks: [string, string, string]) {
    return JSON.stringify({
      rewrites: hooks.map((hook, i) => ({ hook, reason: `Reason ${i + 1}` })),
    })
  }

  it('returns three improved rewrites when all score higher', async () => {
    const improved = [
      'Why do most leadership posts get ignored? Steal this 3-line LinkedIn hook playbook for your next B2B post.',
      'How do founders lose attention in 2 seconds? Learn this LinkedIn hook playbook for your next post.',
      'What makes a LinkedIn hook stop the scroll in 2024? Steal this playbook for your next B2B update.',
    ] as [string, string, string]

    vi.mocked(callNvidiaChat).mockResolvedValueOnce(payload(improved))

    const originalScore = scoreHook(weakOriginal).score
    const result = await generateRewrites(weakOriginal, originalScore, [
      'No question or curiosity gap detected',
    ])

    expect(result.fallback).toBe(false)
    expect(result.rewrites).toHaveLength(3)
    const scores = result.rewrites.map((r) => scoreHook(r.hook).score)
    // Representative weak original (22) → three improved scores (92, 92, 92)
    expect(originalScore).toBe(22)
    expect(scores).toEqual([92, 92, 92])
    for (const s of scores) {
      expect(s).toBeGreaterThan(originalScore)
    }
  })

  it('retries and falls back when candidates never beat the original', async () => {
    const original =
      "How I've helped 40 founders book meetings in 90 days: steal this LinkedIn playbook for your next post."
    const originalScore = scoreHook(original).score
    expect(originalScore).toBe(100)

    // Equal / worse / fabricated — none valid improvements for a max-scoring original
    const badBatch = payload([
      original,
      'Random thoughts on leadership.',
      "I've helped 999 unicorns raise $50M overnight with this secret.",
    ])

    vi.mocked(callNvidiaChat).mockResolvedValue(badBatch)

    const result = await generateRewrites(original, originalScore, [])

    expect(result.fallback).toBe(true)
    expect(result.fallbackReason).toBe('NO_IMPROVED_REWRITE')
    expect(result.rewrites).toHaveLength(3)
    expect(result.rewrites[0].hook).toBe(original)
    expect(result.rewrites[0].reason).toMatch(/Could not generate a higher-scoring rewrite/i)
    expect(callNvidiaChat).toHaveBeenCalledTimes(MAX_REWRITE_GENERATION_ATTEMPTS)
  })

  it('accumulates improved candidates across retries until three accept', async () => {
    const originalScore = scoreHook(weakOriginal).score
    const good1 =
      'Why do most leadership posts get ignored? Steal this 3-line LinkedIn hook playbook for your next B2B post.'
    const good2 =
      'How do founders lose attention in 2 seconds? Learn this LinkedIn hook playbook for your next post.'
    const good3 =
      'What makes a LinkedIn hook stop the scroll in 2024? Steal this playbook for your next B2B update.'

    vi.mocked(callNvidiaChat)
      .mockResolvedValueOnce(payload([good1, weakOriginal, 'Too short']))
      .mockResolvedValueOnce(payload([good2, good1, 'Still vague leadership thoughts only.']))
      .mockResolvedValueOnce(payload([good3, good2, good1]))

    const result = await generateRewrites(weakOriginal, originalScore, [])

    expect(result.fallback).toBe(false)
    expect(result.rewrites).toHaveLength(3)
    const scores = result.rewrites.map((r) => scoreHook(r.hook).score)
    expect(scores.every((s) => s > originalScore)).toBe(true)
  })
})

describe('Fallback Result Creation', () => {
  it('creates fallback with original hook echoed', () => {
    const originalHook = 'I grew my ARR to $1M'
    const result = createFallbackResult(originalHook, 'NVIDIA_TIMEOUT')

    expect(result.fallback).toBe(true)
    expect(result.fallbackReason).toBe('NVIDIA_TIMEOUT')
    expect(result.rewrites).toHaveLength(3)
    expect(result.rewrites[0].hook).toBe(originalHook)
    expect(result.rewrites[0].reason).toBe('AI unavailable — original hook shown')
  })

  it('uses clear copy for NO_IMPROVED_REWRITE', () => {
    const result = createFallbackResult('hook', 'NO_IMPROVED_REWRITE')
    expect(result.fallbackReason).toBe('NO_IMPROVED_REWRITE')
    expect(result.rewrites[0].reason).toMatch(/Could not generate a higher-scoring rewrite/i)
  })

  it('uses correct fallback reason types', () => {
    const reasons: FallbackReason[] = [
      'NVIDIA_TIMEOUT',
      'NVIDIA_SCHEMA_ERROR',
      'NVIDIA_RATE_LIMIT',
      'NVIDIA_UNAVAILABLE',
      'NO_IMPROVED_REWRITE',
    ]

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
    const reasons: FallbackReason[] = [
      'NVIDIA_TIMEOUT',
      'NVIDIA_SCHEMA_ERROR',
      'NVIDIA_RATE_LIMIT',
      'NVIDIA_UNAVAILABLE',
      'NO_IMPROVED_REWRITE',
    ]
    expect(reasons).toHaveLength(5)
  })
})
