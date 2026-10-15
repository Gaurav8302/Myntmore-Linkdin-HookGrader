/**
 * NVIDIA rewrite generation for Hook Grader
 * Score remains deterministic (lib/scoring). NVIDIA only produces rewrite text.
 * Candidates are accepted only when scoreHook(candidate) > scoreHook(original).
 */

import { callNvidiaChat, type Rewrite } from './client'
import { SYSTEM_PROMPT, buildUserPrompt, parseGeminiResponse } from './prompt'
import { scoreHook, ALL_RULES, SCORING_CONSTANTS } from '../scoring'
import { authorityRule } from '../scoring/rules'

export type { Rewrite }
export type FallbackReason =
  | 'NVIDIA_TIMEOUT'
  | 'NVIDIA_SCHEMA_ERROR'
  | 'NVIDIA_RATE_LIMIT'
  | 'NVIDIA_UNAVAILABLE'
  | 'NO_IMPROVED_REWRITE'
  // Legacy aliases kept for older clients/tests during transition
  | 'GEMINI_TIMEOUT'
  | 'GEMINI_SCHEMA_ERROR'
  | 'GEMINI_RATE_LIMIT'
  | 'GEMINI_UNAVAILABLE'

export interface RewriteResult {
  rewrites: Rewrite[]
  fallback: boolean
  fallbackReason?: FallbackReason
}

/** Matches Hook Grader API max hook length. */
export const REWRITE_MAX_CHARS = 500

/** Bounded generation rounds while collecting 3 strictly improved rewrites. */
export const MAX_REWRITE_GENERATION_ATTEMPTS = 3

export type RewriteRejectReason =
  | 'empty'
  | 'em_dash'
  | 'word_limit'
  | 'char_limit'
  | 'score_not_higher'
  | 'fabricated_authority'
  | 'lost_passed_rule'

export interface RewriteEvaluation {
  ok: boolean
  reason?: RewriteRejectReason
  originalScore: number
  candidateScore: number
}

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
}

/**
 * Rejects inventing first-person + outcome when the original has none.
 */
export function hasFabricatedAuthority(originalHook: string, candidateHook: string): boolean {
  return authorityRule(candidateHook) && !authorityRule(originalHook)
}

/**
 * Every rule that passed on the original must still pass on the candidate.
 */
export function preservesPassedRules(originalHook: string, candidateHook: string): boolean {
  const original = originalHook.trim()
  const candidate = candidateHook.trim()
  for (const rule of ALL_RULES) {
    if (rule.check(original) && !rule.check(candidate)) {
      return false
    }
  }
  return true
}

/**
 * Validate a rewrite with the same production scoreHook used by the grader.
 * Accept only when score is strictly higher than the original.
 */
export function evaluateRewriteCandidate(
  originalHook: string,
  candidateHook: string,
  originalScore?: number,
): RewriteEvaluation {
  const original = originalHook.trim()
  const candidate = candidateHook.trim()
  const baselineScore = originalScore ?? scoreHook(original).score
  const candidateScore = candidate ? scoreHook(candidate).score : 0

  if (!candidate) {
    return { ok: false, reason: 'empty', originalScore: baselineScore, candidateScore }
  }
  if (candidate.includes('—')) {
    return { ok: false, reason: 'em_dash', originalScore: baselineScore, candidateScore }
  }
  if (candidate.split(/\s+/).filter(Boolean).length > 120) {
    return { ok: false, reason: 'word_limit', originalScore: baselineScore, candidateScore }
  }
  if (candidate.length > REWRITE_MAX_CHARS) {
    return { ok: false, reason: 'char_limit', originalScore: baselineScore, candidateScore }
  }
  if (candidateScore <= baselineScore) {
    return { ok: false, reason: 'score_not_higher', originalScore: baselineScore, candidateScore }
  }
  if (hasFabricatedAuthority(original, candidate)) {
    return { ok: false, reason: 'fabricated_authority', originalScore: baselineScore, candidateScore }
  }
  if (!preservesPassedRules(original, candidate)) {
    return { ok: false, reason: 'lost_passed_rule', originalScore: baselineScore, candidateScore }
  }

  return { ok: true, originalScore: baselineScore, candidateScore }
}

function fallbackReasonMessage(reason: FallbackReason): string {
  if (reason === 'NO_IMPROVED_REWRITE') {
    return 'Could not generate a higher-scoring rewrite — original hook shown'
  }
  return 'AI unavailable — original hook shown'
}

/**
 * Generate exactly 3 rewrites that each score strictly higher than the original.
 * Retries within a bound; falls back without claiming improvement if none qualify.
 */
export async function generateRewrites(
  originalHook: string,
  score: number,
  failedRules: string[]
): Promise<RewriteResult> {
  const prompt = buildUserPrompt(originalHook, score, failedRules)
  const baseline = scoreHook(originalHook)
  const baselineScore = baseline.score
  const improved: Rewrite[] = []
  const seen = new Set<string>()

  for (let attempt = 1; attempt <= MAX_REWRITE_GENERATION_ATTEMPTS; attempt++) {
    try {
      const text = await callNvidiaChat(SYSTEM_PROMPT, prompt, {
        temperature: 0.7,
        maxTokens: 2048,
        timeoutMs: 45000,
      })

      const candidates = parseGeminiResponse(stripCodeFences(text))

      for (const candidate of candidates) {
        if (seen.has(candidate.hook)) continue
        const verdict = evaluateRewriteCandidate(originalHook, candidate.hook, baselineScore)
        if (!verdict.ok) {
          console.warn(
            `Rejected rewrite candidate (attempt ${attempt}): ${verdict.reason} ` +
              `(original=${verdict.originalScore}, candidate=${verdict.candidateScore})`,
          )
          continue
        }
        seen.add(candidate.hook)
        improved.push({
          hook: candidate.hook,
          reason: candidate.reason,
        })
        if (improved.length >= 3) {
          return {
            rewrites: improved.slice(0, 3),
            fallback: false,
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isAbort = error instanceof Error && error.name === 'AbortError'

      const isSchemaError =
        errorMessage.includes('schema') ||
        errorMessage.includes('JSON') ||
        errorMessage.includes('rewrites') ||
        errorMessage.includes('Invalid response') ||
        errorMessage.includes('em dash') ||
        errorMessage.includes('word count') ||
        errorMessage.includes('120 words')

      const isRateLimit = errorMessage.includes('429') || errorMessage.includes('rate limit')
      const isTimeout =
        isAbort || errorMessage.includes('timeout') || errorMessage.includes('deadline')

      if (isRateLimit || isTimeout) {
        return createFallbackResult(
          originalHook,
          isRateLimit ? 'NVIDIA_RATE_LIMIT' : 'NVIDIA_TIMEOUT'
        )
      }

      if (isSchemaError && attempt < MAX_REWRITE_GENERATION_ATTEMPTS) {
        console.warn(`NVIDIA schema error (attempt ${attempt}), retrying:`, errorMessage)
        continue
      }

      if (attempt === MAX_REWRITE_GENERATION_ATTEMPTS) {
        console.error('NVIDIA failed after retries:', errorMessage)
        // Prefer improvement-failure semantics when we already tried collecting better hooks
        if (improved.length > 0) {
          return createFallbackResult(originalHook, 'NO_IMPROVED_REWRITE')
        }
        return createFallbackResult(originalHook, 'NVIDIA_UNAVAILABLE')
      }

      console.warn(`NVIDIA error (attempt ${attempt}), retrying:`, errorMessage)
    }
  }

  return createFallbackResult(originalHook, 'NO_IMPROVED_REWRITE')
}

export function createFallbackResult(originalHook: string, reason: FallbackReason): RewriteResult {
  const fallbackRewrite = {
    hook: originalHook,
    reason: fallbackReasonMessage(reason),
  }

  return {
    rewrites: [fallbackRewrite, fallbackRewrite, fallbackRewrite],
    fallback: true,
    fallbackReason: reason,
  }
}

export function generateFallbackRewrites(
  originalHook: string,
  reason: FallbackReason = 'NVIDIA_UNAVAILABLE'
): RewriteResult {
  return createFallbackResult(originalHook, reason)
}

/** Exposed for tests / diagnostics — max theoretical positive weight sum. */
export function maxPositiveScore(): number {
  const { weights } = SCORING_CONSTANTS
  return weights.length + weights.curiosity + weights.specificity + weights.authority + weights.action
}
