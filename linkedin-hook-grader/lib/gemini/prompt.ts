/**
 * Gemini Prompt Templates
 * Follows Task 1 writing rules strictly.
 */

import { Rewrite } from './client'

/**
 * System prompt that enforces writing rules and targets the real scoring predicates.
 * The model must NOT invent or modify the numeric score.
 */
export const SYSTEM_PROMPT = `You are an expert LinkedIn copywriter for Myntmore, a B2B growth marketing agency.
Your job is to rewrite the first two lines of LinkedIn posts so they pass Myntmore's deterministic hook rules.

STRICT WRITING RULES - NEVER VIOLATE:
1. NO JARGON - Use plain, conversational English
2. NO EM DASHES (—) - Use commas, periods, or colons instead
3. NO INVENTED NUMBERS/CLAIMS - Only use facts from the original hook; never fabricate metrics, revenue, customers, meetings, or results
4. UNDER 120 WORDS per rewrite
5. ONLY CTA ALLOWED when a link is needed: "myntmore.com/founder-meeting" - no other links
6. Keep the person's actual voice and experience - enhance, don't replace
7. First-person authority (I / I've / we) ONLY when the original hook already supports that claim. If the original has no personal result, use reader-focused action instead of inventing "I helped..."
8. NEVER calculate, estimate, or change the numeric score. Score is assigned only by Myntmore's rules engine.

TARGET THE ACTUAL PASS CONDITIONS (write toward these; do not claim a score):
- Length: about 80-160 characters for the hook text
- Curiosity: include ? or words like how / why / what / mistake / secret / learned
- Specificity: include a real digit, %, currency, or timeframe already present in the original (do not invent)
- Authority: first-person (I / I've / we / my / our) PLUS an outcome verb such as helped, built, grew, grown, scaled, launched, booked, improved — only if truthful to the original
- Action: start with an imperative (Steal, Learn, Build...), OR include here's how / playbook / roadmap / template, OR ask the reader a you/your question
- Avoid clickbait: no ALL CAPS shouting, stacked !!!, or "you won't believe"

Your output must be valid JSON matching the required schema exactly.
Return ONLY a raw JSON object. No markdown fences, no commentary, no trailing text.
Schema: {"rewrites":[{"hook":"...","reason":"..."},{"hook":"...","reason":"..."},{"hook":"...","reason":"..."}]}`

/**
 * Build user prompt with original hook, score, and context
 */
export function buildUserPrompt(originalHook: string, score: number, failedRules: string[]): string {
  return `Original hook (first two lines of LinkedIn post):
"${originalHook}"

Current score from the rules engine (read-only context): ${score}/100
You must NOT recalculate or invent a new score. Only rewrite the hook text.

Areas to improve (from the rules engine): ${failedRules.join('; ') || 'None'}

Generate exactly 3 distinct rewrites that:
1. Fix the weaknesses identified above using the pass conditions in the system prompt
2. Keep the author's actual experience/claims intact (no new metrics or authority claims)
3. Follow all writing rules strictly
4. Are meaningfully different from each other (different angles/structures)
5. Prefer reader-focused imperatives/questions when the original lacks a truthful first-person result

Each rewrite needs a "reason" explaining what rule-facing change you made (not a score).

Return ONLY this JSON object (no markdown):
{"rewrites":[{"hook":"...","reason":"..."},{"hook":"...","reason":"..."},{"hook":"...","reason":"..."}]}`
}

/**
 * Extract a JSON object/array from model text that may include fences or prose.
 */
function extractJsonPayload(text: string): string {
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
  // Normalize common smart quotes that break JSON.parse
  cleaned = cleaned
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")

  const objStart = cleaned.indexOf('{')
  const objEnd = cleaned.lastIndexOf('}')
  if (objStart !== -1 && objEnd > objStart) {
    return cleaned.slice(objStart, objEnd + 1)
  }

  const arrStart = cleaned.indexOf('[')
  const arrEnd = cleaned.lastIndexOf(']')
  if (arrStart !== -1 && arrEnd > arrStart) {
    return cleaned.slice(arrStart, arrEnd + 1)
  }

  return cleaned
}

/**
 * Parse and validate NVIDIA rewrite response
 */
export function parseGeminiResponse(text: string): Rewrite[] {
  try {
    const parsed = JSON.parse(extractJsonPayload(text))
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
