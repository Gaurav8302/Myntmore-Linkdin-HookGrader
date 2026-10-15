/**
 * Rewrite generation unit tests
 * Schema validation, score-as-feedback acceptance, fallback, and prompt rules.
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
  hasFabricatedMetrics,
  isRewriteScoreAcceptable,
  labelAcceptedRewriteReason,
  MAX_REWRITE_GENERATION_ATTEMPTS,
  REWRITE_MAX_CHARS,
} from '../rewrite'
import { scoreHook } from '../../scoring'

vi.mock('../client', () => ({
  callNvidiaChat: vi.fn(),
}))

import { callNvidiaChat } from '../client'

describe('Gemini Prompt Building', () => {
  it('builds user prompt without requiring a higher score', () => {
    const hook = 'I grew ARR to $1M in 12 months'
    const score = 87
    const failedRules = ['No question or curiosity gap detected']

    const prompt = buildUserPrompt(hook, score, failedRules)

    expect(prompt).toContain(hook)
    expect(prompt).toContain('87')
    expect(prompt).toContain('No question or curiosity gap detected')
    expect(prompt).toContain('3 distinct rewrite alternatives')
    expect(prompt).toMatch(/NOT required/i)
    expect(prompt).not.toContain('STRICTLY HIGHER')
  })

  it('builds user prompt for high originals without a 90 floor gate', () => {
    const prompt = buildUserPrompt('A strong hook already', 92, [])
    expect(prompt).toMatch(/alternative/i)
    expect(prompt).not.toContain('STRICTLY HIGHER')
    expect(prompt).not.toMatch(/must score 90/)
  })

  it('includes system prompt with all writing rules', () => {
    expect(SYSTEM_PROMPT).toContain('NO JARGON')
    expect(SYSTEM_PROMPT).toContain('NO EM DASHES')
    expect(SYSTEM_PROMPT).toContain('NO INVENTED NUMBERS')
    expect(SYSTEM_PROMPT).toContain('120 WORDS')
    expect(SYSTEM_PROMPT).toContain('myntmore.com/founder-meeting')
    expect(SYSTEM_PROMPT).toMatch(/Specificity \(critical/i)
    expect(SYSTEM_PROMPT).toMatch(/7\+ letter/i)
  })

  it('treats first-person authority as optional and forbids score mutation', () => {
    expect(SYSTEM_PROMPT).toContain('TARGET THE ACTUAL PASS CONDITIONS')
    expect(SYSTEM_PROMPT).toMatch(/OPTIONAL/i)
    expect(SYSTEM_PROMPT).toContain('provocative insight')
    expect(SYSTEM_PROMPT).toContain('reader-focused question')
    expect(SYSTEM_PROMPT).toContain('specific pain point')
    expect(SYSTEM_PROMPT).toContain('concrete imperative recommendation')
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

describe('isRewriteScoreAcceptable (score is feedback, not a gate)', () => {
  it('original 89; candidate 89 → accept', () => {
    expect(isRewriteScoreAcceptable(89, 89)).toBe(true)
  })

  it('original 89; candidate 85 → accept', () => {
    expect(isRewriteScoreAcceptable(89, 85)).toBe(true)
  })

  it('original 89; candidate 90 → accept', () => {
    expect(isRewriteScoreAcceptable(89, 90)).toBe(true)
  })

  it('original 92; candidate 91 → accept', () => {
    expect(isRewriteScoreAcceptable(92, 91)).toBe(true)
  })

  it('original 92; candidate 89 → accept', () => {
    expect(isRewriteScoreAcceptable(92, 89)).toBe(true)
  })

  it('labels equal and lower scores honestly without promising improvement', () => {
    const equal = labelAcceptedRewriteReason(89, 89, 'Same angle, tighter wording')
    expect(equal).toMatch(/Score 89\/100 \(same score as original\)/)
    expect(equal).not.toMatch(/Improved score/)

    const lower = labelAcceptedRewriteReason(92, 89, 'Different tone')
    expect(lower).toMatch(/Score 89\/100 \(-3 vs original\)/)

    const higher = labelAcceptedRewriteReason(89, 90, 'Adds curiosity')
    expect(higher).toMatch(/Score 90\/100 \(\+1 vs original\)/)
  })
})

describe('evaluateRewriteCandidate (quality gates only)', () => {
  const weakOriginal =
    'Random thoughts on leadership trends across enterprise software markets today without a clear ask.'
  const weakScore = scoreHook(weakOriginal).score

  const improvedA =
    'Why do most leadership posts get ignored? Steal this LinkedIn hook playbook for your next B2B post.'
  const improvedB =
    'How do founders lose attention so quickly? Learn this LinkedIn hook playbook for your next post.'
  const improvedC =
    'What makes a LinkedIn hook stop the scroll today? Steal this playbook for your next B2B update.'

  it('accepts candidates regardless of score delta when otherwise valid', () => {
    expect(weakScore).toBeLessThan(50)
    for (const candidate of [improvedA, improvedB, improvedC]) {
      const verdict = evaluateRewriteCandidate(weakOriginal, candidate, weakScore)
      expect(verdict.ok).toBe(true)
      expect(verdict.candidateScore).toBeGreaterThan(weakScore)
    }
  })

  it('original 89 / candidate 89: accept when distinct and valid', () => {
    const original =
      'Why do founders lose the scroll? Steal this LinkedIn hook playbook for your next B2B post today.'
    const candidate =
      'How do founders lose the scroll? Steal this LinkedIn hook playbook for your next B2B post today.'
    const originalScore = scoreHook(original).score
    const candidateScore = scoreHook(candidate).score
    // Scores may match or differ slightly; acceptance must not require higher.
    expect(isRewriteScoreAcceptable(originalScore, candidateScore)).toBe(true)
    const verdict = evaluateRewriteCandidate(original, candidate, originalScore)
    expect(verdict.ok).toBe(true)
  })

  it('original 89 / candidate 85: accept if otherwise valid', () => {
    const original =
      'Why do founders lose the scroll? Steal this LinkedIn hook playbook for your next B2B post today.'
    const originalScore = scoreHook(original).score
    const weaker =
      'Founders often lose attention on LinkedIn. Here is a clearer way to open your next post.'
    const weakerScore = scoreHook(weaker).score
    expect(weakerScore).toBeLessThanOrEqual(originalScore)
    const verdict = evaluateRewriteCandidate(original, weaker, originalScore)
    expect(verdict.ok).toBe(true)
    expect(verdict.candidateScore).toBe(weakerScore)
  })

  it('rejects identical candidates even when scores would otherwise pass', () => {
    const strong =
      'How do most founders still get ignored on LinkedIn? Steal this hook playbook for your next B2B post.'
    const strongScore = scoreHook(strong).score
    const verdict = evaluateRewriteCandidate(strong, strong, strongScore)
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toBe('identical')
    expect(scoreHook(strong).score).toBe(strongScore)
  })

  it('accepts a lower-scoring distinct alternative from a strong original', () => {
    const strong =
      "How I've helped 40 founders book meetings in 90 days: steal this LinkedIn playbook for your next post."
    const strongScore = scoreHook(strong).score
    expect(strongScore).toBeGreaterThanOrEqual(90)
    const reverse = evaluateRewriteCandidate(strong, weakOriginal, strongScore)
    expect(reverse.ok).toBe(true)
    expect(reverse.candidateScore).toBeLessThan(strongScore)
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

  it('rejects invented metrics not present in the original', () => {
    const original =
      'Why do founders lose the scroll? Steal this LinkedIn hook playbook for your next B2B post today.'
    expect(hasFabricatedMetrics(original, 'Losing the scroll? Here is how 92 founders improved posts.')).toBe(
      true,
    )
    const verdict = evaluateRewriteCandidate(
      original,
      'Losing the scroll? Here is how 92 founders improved their B2B posts.',
      scoreHook(original).score,
    )
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toBe('fabricated_metrics')
  })

  it('for a 92 original, accepts a distinct alternative even if score is lower', () => {
    const original =
      'How do most founders still get ignored on LinkedIn? Steal this hook playbook for your next B2B post.'
    const originalScore = scoreHook(original).score
    expect(originalScore).toBe(92)

    const alternative =
      'Why do B2B founders still get ignored on LinkedIn? Steal this hook playbook for your next post.'
    const verdict = evaluateRewriteCandidate(original, alternative, originalScore)
    expect(verdict.ok).toBe(true)
    expect(scoreHook(original).score).toBe(92)

    const withInventedAuth =
      "How I've helped 40 founders book meetings in 90 days: steal this LinkedIn playbook for your next post."
    expect(evaluateRewriteCandidate(original, withInventedAuth, originalScore).reason).toBe(
      'fabricated_authority',
    )
  })
})

describe('generateRewrites acceptance + fallback', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  const weakOriginal =
    'Random thoughts on leadership trends across enterprise software markets today without a clear ask.'

  function payload(hooks: [string, string, string]) {
    return JSON.stringify({
      rewrites: hooks.map((hook, i) => ({ hook, reason: `Reason ${i + 1}` })),
    })
  }

  it('returns three rewrites when all are valid (score may be equal)', async () => {
    const improved = [
      'Why do most leadership posts get ignored? Steal this LinkedIn hook playbook for your next B2B post.',
      'How do founders lose attention so quickly? Learn this LinkedIn hook playbook for your next post.',
      'What makes a LinkedIn hook stop the scroll today? Steal this playbook for your next B2B update.',
    ] as [string, string, string]

    vi.mocked(callNvidiaChat).mockResolvedValueOnce(payload(improved))

    const originalScore = scoreHook(weakOriginal).score
    const result = await generateRewrites(weakOriginal, originalScore, [
      'No question or curiosity gap detected',
    ])

    expect(result.fallback).toBe(false)
    expect(result.rewrites).toHaveLength(3)
    const scores = result.rewrites.map((r) => scoreHook(r.hook).score)
    expect(originalScore).toBe(22)
    expect(scores.every((s) => s >= originalScore)).toBe(true)
    expect(result.rewrites[0].reason).toMatch(/Score \d+\/100/)
    expect(typeof result.rewrites[0].score).toBe('number')
    expect(result.rewrites[0].scoreDelta).toBe(
      (result.rewrites[0].score as number) - originalScore,
    )
    const unique = new Set(result.rewrites.map((r) => r.hook))
    expect(unique.size).toBe(3)
  })

  it('displays three unique equal-scoring alternatives', async () => {
    const original =
      'How do most founders still get ignored on LinkedIn? Steal this hook playbook for your next B2B post.'
    const originalScore = scoreHook(original).score
    expect(originalScore).toBe(92)

    const alternatives = [
      'Why do B2B founders still get ignored on LinkedIn? Steal this hook playbook for your next post.',
      'What keeps founders invisible on LinkedIn today? Steal this hook playbook for your next B2B update.',
      'How do founders lose the scroll in seconds? Steal this LinkedIn hook playbook for your next post.',
    ] as [string, string, string]

    vi.mocked(callNvidiaChat).mockResolvedValueOnce(payload(alternatives))

    const result = await generateRewrites(original, originalScore, [])
    expect(result.fallback).toBe(false)
    expect(result.rewrites).toHaveLength(3)
    for (const r of result.rewrites) {
      expect(r.reason).toMatch(/Score \d+\/100/)
      expect(r.reason).not.toMatch(/Improved score/)
    }
    expect(scoreHook(original).score).toBe(92)
  })

  it('rejects duplicates, originals, and fabricated authority, then explains on retry exhaustion', async () => {
    const original = weakOriginal
    const originalScore = scoreHook(original).score

    const badBatch = payload([
      original,
      original,
      "I've helped 999 unicorns raise $50M overnight with this secret.",
    ])

    vi.mocked(callNvidiaChat).mockResolvedValue(badBatch)

    const result = await generateRewrites(original, originalScore, [])

    expect(result.fallback).toBe(true)
    expect(result.fallbackReason).toBe('INSUFFICIENT_ALTERNATIVES')
    expect(result.rewrites).toEqual([])
    expect(callNvidiaChat).toHaveBeenCalledTimes(MAX_REWRITE_GENERATION_ATTEMPTS)
    expect(scoreHook(original).score).toBe(originalScore)
  })

  it('accumulates valid candidates across retries until three accept', async () => {
    const originalScore = scoreHook(weakOriginal).score
    const good1 =
      'Why do most leadership posts get ignored? Steal this LinkedIn hook playbook for your next B2B post.'
    const good2 =
      'How do founders lose attention so quickly? Learn this LinkedIn hook playbook for your next post.'
    const good3 =
      'What makes a LinkedIn hook stop the scroll today? Steal this playbook for your next B2B update.'

    vi.mocked(callNvidiaChat)
      .mockResolvedValueOnce(payload([good1, weakOriginal, 'Too short']))
      .mockResolvedValueOnce(payload([good2, good1, 'Still vague leadership thoughts only.']))
      .mockResolvedValueOnce(payload([good3, good2, good1]))

    const result = await generateRewrites(weakOriginal, originalScore, [])

    expect(result.fallback).toBe(false)
    expect(result.rewrites).toHaveLength(3)
  })

  it('returns partial alternatives without filling slots with the original', async () => {
    const good1 =
      'Why do most leadership posts get ignored? Steal this LinkedIn hook playbook for your next B2B post.'
    vi.mocked(callNvidiaChat).mockResolvedValue(
      payload([good1, weakOriginal, weakOriginal]),
    )

    const originalScore = scoreHook(weakOriginal).score
    const result = await generateRewrites(weakOriginal, originalScore, [])

    expect(result.fallback).toBe(true)
    expect(result.fallbackReason).toBe('INSUFFICIENT_ALTERNATIVES')
    expect(result.rewrites).toHaveLength(1)
    expect(result.rewrites[0].hook).toBe(good1)
    expect(result.rewrites.every((r) => r.hook !== weakOriginal)).toBe(true)
  })
})

describe('Fallback Result Creation', () => {
  it('explains the limitation without echoing the original three times', () => {
    const result = createFallbackResult('NVIDIA_TIMEOUT')

    expect(result.fallback).toBe(true)
    expect(result.fallbackReason).toBe('NVIDIA_TIMEOUT')
    expect(result.rewrites).toEqual([])
  })

  it('maps deprecated NO_IMPROVED_REWRITE without using it as a user score gate', () => {
    const result = createFallbackResult('NO_IMPROVED_REWRITE')
    expect(result.fallbackReason).toBe('NO_IMPROVED_REWRITE')
    expect(result.rewrites).toEqual([])
  })

  it('uses correct fallback reason types', () => {
    const reasons: FallbackReason[] = [
      'NVIDIA_TIMEOUT',
      'NVIDIA_SCHEMA_ERROR',
      'NVIDIA_RATE_LIMIT',
      'NVIDIA_UNAVAILABLE',
      'INSUFFICIENT_ALTERNATIVES',
      'NO_IMPROVED_REWRITE',
    ]

    for (const reason of reasons) {
      const result = createFallbackResult(reason)
      expect(result.fallbackReason).toBe(reason)
      expect(result.rewrites).toEqual([])
    }
  })
})

describe('Gemini Integration Types', () => {
  it('validates Rewrite type structure with optional score feedback', () => {
    const rewrite: Rewrite = {
      hook: 'Test hook',
      reason: 'Test reason',
      score: 89,
      scoreDelta: 0,
    }
    expect(rewrite.hook).toBe('Test hook')
    expect(rewrite.scoreDelta).toBe(0)
  })

  it('validates FallbackReason enum values', () => {
    const reasons: FallbackReason[] = [
      'NVIDIA_TIMEOUT',
      'NVIDIA_SCHEMA_ERROR',
      'NVIDIA_RATE_LIMIT',
      'NVIDIA_UNAVAILABLE',
      'INSUFFICIENT_ALTERNATIVES',
      'NO_IMPROVED_REWRITE',
    ]
    expect(reasons).toHaveLength(6)
  })
})
