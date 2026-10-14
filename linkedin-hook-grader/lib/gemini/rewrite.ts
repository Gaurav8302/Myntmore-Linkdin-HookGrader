/**
 * NVIDIA rewrite generation for Hook Grader
 * Score remains deterministic (lib/scoring). NVIDIA only produces rewrites.
 */

import { callNvidiaChat, type Rewrite } from './client'
import { SYSTEM_PROMPT, buildUserPrompt, parseGeminiResponse } from './prompt'

export type { Rewrite }
export type FallbackReason =
  | 'NVIDIA_TIMEOUT'
  | 'NVIDIA_SCHEMA_ERROR'
  | 'NVIDIA_RATE_LIMIT'
  | 'NVIDIA_UNAVAILABLE'
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

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
}

/**
 * Generate exactly 3 rewrites via NVIDIA; fall back clearly if unavailable
 */
export async function generateRewrites(
  originalHook: string,
  score: number,
  failedRules: string[]
): Promise<RewriteResult> {
  const prompt = buildUserPrompt(originalHook, score, failedRules)

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const text = await callNvidiaChat(SYSTEM_PROMPT, prompt, {
        temperature: 0.7,
        maxTokens: 2048,
        timeoutMs: 45000,
      })

      const rewrites = parseGeminiResponse(stripCodeFences(text))

      return {
        rewrites,
        fallback: false,
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

      if (isSchemaError && attempt < 2) {
        console.warn(`NVIDIA schema error (attempt ${attempt}), retrying:`, errorMessage)
        continue
      }

      if (isRateLimit || isTimeout) {
        return createFallbackResult(
          originalHook,
          isRateLimit ? 'NVIDIA_RATE_LIMIT' : 'NVIDIA_TIMEOUT'
        )
      }

      if (attempt === 2) {
        console.error('NVIDIA failed after retries:', errorMessage)
        return createFallbackResult(originalHook, 'NVIDIA_UNAVAILABLE')
      }

      console.warn(`NVIDIA error (attempt ${attempt}), retrying:`, errorMessage)
    }
  }

  return createFallbackResult(originalHook, 'NVIDIA_UNAVAILABLE')
}

export function createFallbackResult(originalHook: string, reason: FallbackReason): RewriteResult {
  const fallbackRewrite = {
    hook: originalHook,
    reason: 'AI unavailable — original hook shown',
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
