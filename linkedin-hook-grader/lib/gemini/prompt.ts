/**
 * Gemini Prompt Templates
 * Follows Task 1 writing rules strictly.
 */

import { Rewrite } from './client'

/**
 * System prompt that enforces writing rules
 */
export const SYSTEM_PROMPT = `You are an expert LinkedIn copywriter for Myntmore, a B2B growth marketing agency. 
Your job is to rewrite the first two lines of LinkedIn posts to make them more engaging.

STRICT WRITING RULES - NEVER VIOLATE:
1. NO JARGON - Use plain, conversational English
2. NO EM DASHES (—) - Use commas, periods, or colons instead
3. NO INVENTED NUMBERS/CLAIMS - Only use facts from the original hook; never fabricate metrics, revenue, customers, or results
4. UNDER 120 WORDS per rewrite
5. ONLY CTA ALLOWED: "myntmore.com/founder-meeting" - no other links or CTAs
6. Keep the person's actual voice and experience - enhance, don't replace

Your output must be valid JSON matching the required schema exactly.`

/**
 * Build user prompt with original hook, score, and context
 */
export function buildUserPrompt(originalHook: string, score: number, failedRules: string[]): string {
  return `Original hook (first two lines of LinkedIn post):
"${originalHook}"

Current score: ${score}/100
Areas to improve: ${failedRules.join('; ') || 'None'}

Generate exactly 3 distinct rewrites that:
1. Fix the weaknesses identified above
2. Keep the author's actual experience/claims intact
3. Follow all writing rules strictly
4. Are meaningfully different from each other (different angles/structures)

Each rewrite needs a "reason" explaining what was changed and why it works better.

Return JSON with exactly 3 rewrites in the "rewrites" array.`
}

/**
 * Parse and validate Gemini response
 */
export function parseGeminiResponse(text: string): Rewrite[] {
  try {
    const parsed = JSON.parse(text)
    const rawList = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { rewrites?: unknown }).rewrites)
        ? (parsed as { rewrites: unknown[] }).rewrites
        : null

    if (!rawList) {
      throw new Error('Invalid response structure: missing rewrites array')
    }

    if (rawList.length !== 3) {
      throw new Error(`Expected 3 rewrites, got ${rawList.length}`)
    }

    const rewrites = rawList.map((r: unknown, index: number) => {
      if (!r || typeof r !== 'object') {
        throw new Error(`Rewrite ${index + 1} is not an object`)
      }
      const rewrite = r as Record<string, unknown>
      if (typeof rewrite.hook !== 'string' || typeof rewrite.reason !== 'string') {
        throw new Error(`Rewrite ${index + 1} missing hook or reason`)
      }
      if (rewrite.hook.trim().length === 0) {
        throw new Error(`Rewrite ${index + 1} hook is empty`)
      }
      if (rewrite.reason.trim().length === 0) {
        throw new Error(`Rewrite ${index + 1} reason is empty`)
      }
      return {
        hook: rewrite.hook.trim(),
        reason: rewrite.reason.trim(),
      }
    })

    // Validate word count (< 120 words each)
    for (let i = 0; i < rewrites.length; i++) {
      const wordCount = rewrites[i].hook.split(/\s+/).length
      if (wordCount > 120) {
        throw new Error(`Rewrite ${i + 1} exceeds 120 words (${wordCount})`)
      }
    }

    // Check for em dashes (should not have any)
    for (let i = 0; i < rewrites.length; i++) {
      if (rewrites[i].hook.includes('—')) {
        throw new Error(`Rewrite ${i + 1} contains em dash (—)`)
      }
    }

    return rewrites
  } catch (error) {
    throw new Error(`Failed to parse Gemini response: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}