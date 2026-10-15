/**
 * NVIDIA rewrite generation for Hook Grader
 * Score remains deterministic (lib/scoring). NVIDIA only produces rewrite text.
 *
 * Score is feedback, not a hard generation gate: equal or lower scores may be
 * shown when the candidate is otherwise valid and distinct.
 */

import { callNvidiaChat, type Rewrite } from './client'
import { SYSTEM_PROMPT, buildUserPrompt, parseGeminiResponse } from './prompt'
import { scoreHook, SCORING_CONSTANTS } from '../scoring'
import { authorityRule } from '../scoring/rules'

export type { Rewrite }
export type FallbackReason =
  | 'NVIDIA_TIMEOUT'
  | 'NVIDIA_SCHEMA_ERROR'
  | 'NVIDIA_RATE_LIMIT'
  | 'NVIDIA_UNAVAILABLE'
  | 'INSUFFICIENT_ALTERNATIVES'
  /** @deprecated Use INSUFFICIENT_ALTERNATIVES — kept for older clients */
  | 'NO_IMPROVED_REWRITE'
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

/** Bounded generation rounds while collecting up to 3 valid alternatives. */
export const MAX_REWRITE_GENERATION_ATTEMPTS = 3

export type RewriteRejectReason =
  | 'empty'
  | 'identical'
  | 'em_dash'
  | 'word_limit'
  | 'char_limit'
  | 'fabricated_authority'
  | 'fabricated_metrics'

export interface RewriteEvaluation {
  ok: boolean
  reason?: RewriteRejectReason
  originalScore: number
  candidateScore: number
}

/**
 * Score is never a hard reject. Kept for diagnostics / older callers.
 * Always returns true when scores are finite numbers.
 */
export function isRewriteScoreAcceptable(
  _originalScore: number,
  candidateScore: number,
): boolean {
  return Number.isFinite(candidateScore)
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
 * Rejects numeric metrics in the candidate that are absent from the original.
 * Ignores alphanumerics like "B2B" (digit embedded in letters).
 */
export function hasFabricatedMetrics(originalHook: string, candidateHook: string): boolean {
  const tokenRe =
    /(?<![A-Za-z])(?:[$€£₹]\s?)?\d[\d,]*(?:\.\d+)?%?(?![A-Za-z])/g
  const normalize = (t: string) => t.replace(/\s+/g, '').toLowerCase()
  const originalTokens = new Set((originalHook.match(tokenRe) || []).map(normalize))
  const candidateTokens = candidateHook.match(tokenRe) || []
  return candidateTokens.some((t) => !originalTokens.has(normalize(t)))
}

/**
 * Label alternatives with honest score feedback (never promises improvement).
 */
export function labelAcceptedRewriteReason(
  originalScore: number,
  candidateScore: number,
  modelReason: string,
): string {
  const delta = candidateScore - originalScore
  const deltaLabel =
    delta > 0 ? `+${delta} vs original` : delta < 0 ? `${delta} vs original` : 'same score as original'
  const trimmed = modelReason.trim()
  const scoreBit = `Score ${candidateScore}/100 (${deltaLabel})`
  return trimmed ? `${scoreBit}. ${trimmed}` : scoreBit
}

/**
 * Validate a rewrite with the same production scoreHook used by the grader.
 * Score is recorded for display; it does not gate acceptance.
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
  if (candidate === original) {
    return { ok: false, reason: 'identical', originalScore: baselineScore, candidateScore }
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
  if (hasFabricatedAuthority(original, candidate)) {
    return { ok: false, reason: 'fabricated_authority', originalScore: baselineScore, candidateScore }
  }
  if (hasFabricatedMetrics(original, candidate)) {
    return { ok: false, reason: 'fabricated_metrics', originalScore: baselineScore, candidateScore }
  }

  return { ok: true, originalScore: baselineScore, candidateScore }
}

function fallbackReasonMessage(reason: FallbackReason): string {
  if (reason === 'INSUFFICIENT_ALTERNATIVES' || reason === 'NO_IMPROVED_REWRITE') {
    return 'Could not generate three valid rewrite alternatives within the retry limit. The original hook score is unchanged.'
  }
  return 'AI rewrite generation unavailable. The original hook score is unchanged.'
}

/**
 * Generate up to 3 distinct rewrite alternatives.
 * Retries for malformed/duplicate output; score is never a reject reason.
 */
function buildLowScoreBoostPrompt(originalHook: string, score: number, failedRules: string[]): string {
  return `${buildUserPrompt(originalHook, score, failedRules)}

PRIORITY BOOST (original score ${score}/100 needs a stronger alternative):
- Rebuild each hook. Do not paraphrase the original sentence.
- Every candidate MUST be 80-160 characters inclusive (count characters, not words). Short punchy lines under 80 chars fail the length rule even if they sound sharp.
- Every candidate must open with a 7+ letter concrete noun (Founders, Marketers, Outreach, Customers, Pipeline) OR use two Cap Words (Sales Teams, Cold Email), unless the original already contains a digit/timeframe you can reuse.
- Include a ? or how/why/what AND a you/your question or a clear imperative (Stop, Learn, Steal, Build) or here's how / playbook / roadmap.
- Still invent no metrics, meetings, revenue, or personal results.`
}

export async function generateRewrites(
  originalHook: string,
  score: number,
  failedRules: string[]
): Promise<RewriteResult> {
  const baseline = scoreHook(originalHook)
  const baselineScore = baseline.score
  const accepted: Rewrite[] = []
  const seen = new Set<string>()
  const originalNormalized = originalHook.trim()
  const failedBlob = failedRules.join(' ').toLowerCase()
  const needsStrengthBoost =
    baselineScore <= 40 ||
    (baselineScore < 80 &&
      (failedBlob.includes('specific') ||
        failedBlob.includes('length') ||
        failedBlob.includes('80-160')))

  const shortRejects: string[] = []

  for (let attempt = 1; attempt <= MAX_REWRITE_GENERATION_ATTEMPTS; attempt++) {
    try {
      let prompt = needsStrengthBoost
        ? buildLowScoreBoostPrompt(originalHook, baselineScore, failedRules)
        : buildUserPrompt(originalHook, score, failedRules)
      if (needsStrengthBoost && shortRejects.length > 0) {
        prompt += `\n\nLENGTH FIX REQUIRED: prior candidates were too short (${shortRejects
          .slice(-3)
          .map((s) => `${s.length} chars`)
          .join(', ')}). Expand each rewrite to 80-160 characters. Example length (~100 chars): "Founders: are you chasing more leads, or prioritizing prospects who already show buying intent?"`
      }

      const text = await callNvidiaChat(SYSTEM_PROMPT, prompt, {
        temperature: needsStrengthBoost ? 0.85 : 0.7,
        maxTokens: 2048,
        timeoutMs: 45000,
      })

      const candidates = parseGeminiResponse(stripCodeFences(text))

      for (const candidate of candidates) {
        const hookKey = candidate.hook.trim()
        if (!hookKey || seen.has(hookKey) || hookKey === originalNormalized) continue
        const verdict = evaluateRewriteCandidate(originalHook, candidate.hook, baselineScore)
        if (!verdict.ok) {
          console.warn(
            `Rejected rewrite candidate (attempt ${attempt}): ${verdict.reason} ` +
              `(original=${verdict.originalScore}, candidate=${verdict.candidateScore})`,
          )
          continue
        }
        // Soft-defer short hooks while retries remain so the model can expand them.
        if (
          needsStrengthBoost &&
          hookKey.length < 80 &&
          attempt < MAX_REWRITE_GENERATION_ATTEMPTS
        ) {
          shortRejects.push(hookKey)
          continue
        }
        const item: Rewrite = {
          hook: candidate.hook.trim(),
          reason: labelAcceptedRewriteReason(
            baselineScore,
            verdict.candidateScore,
            candidate.reason,
          ),
          score: verdict.candidateScore,
          scoreDelta: verdict.candidateScore - baselineScore,
        }
        seen.add(hookKey)
        if (accepted.length < 3) {
          accepted.push(item)
        } else if (needsStrengthBoost) {
          // Replace the weakest accepted candidate when a stronger distinct option appears.
          let weakestIdx = 0
          for (let i = 1; i < accepted.length; i++) {
            if ((accepted[i].score ?? 0) < (accepted[weakestIdx].score ?? 0)) weakestIdx = i
          }
          if ((item.score ?? 0) > (accepted[weakestIdx].score ?? 0)) {
            accepted[weakestIdx] = item
          }
        }
        const hasThree = accepted.length >= 3
        const hasStrong =
          !needsStrengthBoost || accepted.some((r) => (r.score ?? 0) >= 80)
        if (hasThree && hasStrong) {
          return {
            rewrites: accepted.slice(0, 3),
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
        if (accepted.length > 0) {
          return {
            rewrites: accepted,
            fallback: true,
            fallbackReason: isRateLimit ? 'NVIDIA_RATE_LIMIT' : 'NVIDIA_TIMEOUT',
          }
        }
        return createFallbackResult(isRateLimit ? 'NVIDIA_RATE_LIMIT' : 'NVIDIA_TIMEOUT')
      }

      if (isSchemaError && attempt < MAX_REWRITE_GENERATION_ATTEMPTS) {
        console.warn(`NVIDIA schema error (attempt ${attempt}), retrying:`, errorMessage)
        continue
      }

      if (attempt === MAX_REWRITE_GENERATION_ATTEMPTS) {
        console.error('NVIDIA failed after retries:', errorMessage)
        if (accepted.length > 0) {
          return {
            rewrites: accepted,
            fallback: true,
            fallbackReason: 'INSUFFICIENT_ALTERNATIVES',
          }
        }
        return createFallbackResult('NVIDIA_UNAVAILABLE')
      }

      console.warn(`NVIDIA error (attempt ${attempt}), retrying:`, errorMessage)
    }
  }

  if (accepted.length > 0) {
    return {
      rewrites: accepted,
      fallback: accepted.length < 3,
      fallbackReason: accepted.length < 3 ? 'INSUFFICIENT_ALTERNATIVES' : undefined,
    }
  }

  return createFallbackResult('INSUFFICIENT_ALTERNATIVES')
}

/**
 * Explain the limitation without returning three copies of the original as "rewrites".
 */
export function createFallbackResult(reason: FallbackReason): RewriteResult {
  return {
    rewrites: [],
    fallback: true,
    fallbackReason: reason,
  }
}

export function generateFallbackRewrites(
  _originalHook: string,
  reason: FallbackReason = 'NVIDIA_UNAVAILABLE'
): RewriteResult {
  return createFallbackResult(reason)
}

/** Exposed for tests / diagnostics — max theoretical positive weight sum. */
export function maxPositiveScore(): number {
  const { weights } = SCORING_CONSTANTS
  return weights.length + weights.curiosity + weights.specificity + weights.authority + weights.action
}

/** Human-readable explanation for UI / API consumers. */
export function describeFallback(reason: FallbackReason): string {
  return fallbackReasonMessage(reason)
}
