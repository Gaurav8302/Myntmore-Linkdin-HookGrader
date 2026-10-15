/**
 * Scoring Engine Unit Tests
 * Tests deterministic scoring, rule boundaries, and edge cases.
 */

import { describe, it, expect } from 'vitest'
import { scoreHook, ALL_RULES, SCORING_CONSTANTS } from '../index'
import { lengthRule, curiosityRule, specificityRule, authorityRule, actionRule, clickbaitPenaltyRule } from '../rules'

describe('Scoring Engine - Deterministic', () => {
  it('same input always produces same score', () => {
    const hook = "How I scaled to $1M ARR in 12 months?"
    const results = Array.from({ length: 100 }, () => scoreHook(hook))
    const firstScore = results[0].score
    const firstFailed = results[0].failedRules

    for (const result of results) {
      expect(result.score).toBe(firstScore)
      expect(result.failedRules).toEqual(firstFailed)
    }
  })

  it('score is always clamped between 0 and 100', () => {
    const testHooks = [
      "How I scaled to $1M ARR in 12 months?", // should be high
      "YOU WON'T BELIEVE THIS SECRET!!!", // should be 0
      "Random thoughts on leadership.", // should be low
    ]

    for (const hook of testHooks) {
      const result = scoreHook(hook)
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
    }
  })
})

describe('Scoring Rules - Individual', () => {
  describe('R1: Length Rule', () => {
    it('passes for optimal length (80-160 chars)', () => {
      const hook = 'A'.repeat(100)
      expect(lengthRule(hook)).toBe(true)
    })

    it('fails for too short (< 80 chars)', () => {
      const hook = 'Too short'
      expect(lengthRule(hook)).toBe(false)
    })

    it('fails for too long (> 160 chars)', () => {
      const hook = 'A'.repeat(200)
      expect(lengthRule(hook)).toBe(false)
    })

    it('passes at exact boundaries (80 and 160)', () => {
      expect(lengthRule('A'.repeat(80))).toBe(true)
      expect(lengthRule('A'.repeat(160))).toBe(true)
    })
  })

  describe('R2: Curiosity Gap Rule', () => {
    it('passes for question mark', () => {
      expect(curiosityRule('How did I do this?')).toBe(true)
    })

    it('passes for curiosity words', () => {
      expect(curiosityRule('How I scaled my business')).toBe(true)
      expect(curiosityRule('Why this works')).toBe(true)
      expect(curiosityRule('What I learned')).toBe(true)
      expect(curiosityRule('The secret to success')).toBe(true)
      expect(curiosityRule('My biggest mistake')).toBe(true)
      expect(curiosityRule('What I discovered')).toBe(true)
      expect(curiosityRule('What I learned today')).toBe(true)
      expect(curiosityRule('What I realized')).toBe(true)
    })

    it('fails for no curiosity trigger', () => {
      expect(curiosityRule('Random thoughts on leadership')).toBe(false)
    })
  })

  describe('R3: Specificity Rule', () => {
    it('passes for numbers', () => {
      expect(specificityRule('I grew to 1M ARR')).toBe(true)
    })

    it('passes for timeframes', () => {
      expect(specificityRule('In 12 months')).toBe(true)
      expect(specificityRule('Over 6 months')).toBe(true)
      expect(specificityRule('3 weeks ago')).toBe(true)
    })

    it('passes for currency', () => {
      expect(specificityRule('$1M ARR')).toBe(true)
      expect(specificityRule('₹50L')).toBe(true)
      expect(specificityRule('AED 100k')).toBe(true)
    })

    it('passes for percentages', () => {
      expect(specificityRule('Grew 300%')).toBe(true)
    })

    it('passes for proper nouns', () => {
      expect(specificityRule('Myntmore grew fast')).toBe(true)
      expect(specificityRule('LinkedIn strategy')).toBe(true)
    })

    it('fails for vague content', () => {
      expect(specificityRule('Random thoughts on leadership')).toBe(false)
    })
  })

  describe('R4: Authority Rule', () => {
    it('passes for first-person + outcome verb', () => {
      expect(authorityRule('I grew my ARR to $1M')).toBe(true)
      expect(authorityRule('We scaled the team')).toBe(true)
      expect(authorityRule('My team launched the product')).toBe(true)
    })

    it('passes for contractions and helped/grown participles', () => {
      expect(authorityRule("I've helped 40 founders book meetings")).toBe(true)
      expect(authorityRule('I helped 40 founders book meetings')).toBe(true)
      expect(authorityRule('I built a LinkedIn system for outbound')).toBe(true)
      expect(authorityRule('We helped a SaaS team cut reply time')).toBe(true)
      expect(authorityRule("I've grown ARR to $1M")).toBe(true)
      expect(authorityRule("We've launched three products this year")).toBe(true)
    })

    it('fails for first-person without outcome', () => {
      expect(authorityRule('I think about growth')).toBe(false)
    })

    it('fails for unsupported authority / self-praise without outcome verb', () => {
      expect(authorityRule('I am the best founder in SaaS')).toBe(false)
      expect(authorityRule('I believe our brand is unmatched')).toBe(false)
      expect(authorityRule('We are industry leaders')).toBe(false)
    })

    it('fails for outcome without first-person', () => {
      expect(authorityRule('The company grew fast')).toBe(false)
    })

    it('fails for neither', () => {
      expect(authorityRule('Thinking about business')).toBe(false)
    })

    it('fail reason explains optional authority without inventing results', () => {
      const result = scoreHook('Random thoughts on leadership every Monday morning for founders everywhere.')
      expect(result.failedRules.some((r) => /first-person authority|Optional first-person/i.test(r))).toBe(true)
      expect(result.failedRules.some((r) => /Do not invent|smaller score impact/i.test(r))).toBe(true)
    })
  })

  describe('R5: Action Rule', () => {
    it('passes for imperative start', () => {
      expect(actionRule('Discover how I scaled')).toBe(true)
      expect(actionRule('Learn the secret')).toBe(true)
      expect(actionRule('Build your brand')).toBe(true)
      expect(actionRule('Steal this 3-line hook for your next post')).toBe(true)
      expect(actionRule('Want a simple LinkedIn hook that gets replies?')).toBe(true)
    })

    it('passes for action phrases', () => {
      expect(actionRule('Here is how I did it')).toBe(true)
      expect(actionRule('Step by step guide')).toBe(true)
      expect(actionRule('My playbook for growth')).toBe(true)
      expect(actionRule('Roadmap to success')).toBe(true)
      expect(actionRule('Framework for growth')).toBe(true)
    })

    it('passes for reader-focused questions and CTAs', () => {
      expect(actionRule('How do you write hooks that stop the scroll?')).toBe(true)
      expect(actionRule('What would your pipeline look like with better hooks?')).toBe(true)
      expect(actionRule('If you want more replies, start with a clearer opener')).toBe(true)
      expect(actionRule('Comment below and I will share the checklist')).toBe(true)
    })

    it('fails for passive content', () => {
      expect(actionRule('Thinking about leadership')).toBe(false)
      expect(actionRule('Leadership trends this quarter')).toBe(false)
    })

    it('fail reason explains imperative / reader-focused options', () => {
      const result = scoreHook('Thinking about leadership trends across enterprise software markets today.')
      expect(result.failedRules.some((r) => r.includes('Not action-oriented'))).toBe(true)
      expect(result.failedRules.some((r) => /Steal this|Learn|playbook|roadmap/i.test(r))).toBe(true)
    })
  })

  describe('R6: Clickbait Penalty Rule', () => {
    it('passes (no penalty) for normal content', () => {
      expect(clickbaitPenaltyRule('How I grew my business')).toBe(true)
    })

    it('fails (penalty) for clickbait phrases', () => {
      expect(clickbaitPenaltyRule("You won't believe this")).toBe(false)
      expect(clickbaitPenaltyRule('Shocking secret revealed')).toBe(false)
      expect(clickbaitPenaltyRule('Doctors hate this trick')).toBe(false)
    })

    it('fails (penalty) for excessive exclamation marks', () => {
      expect(clickbaitPenaltyRule('Amazing!!!')).toBe(false)
    })

    it('fails (penalty) for excessive ALL CAPS', () => {
      expect(clickbaitPenaltyRule('THIS IS AMAZING STUFF')).toBe(false)
    })

    it('passes for common acronyms in caps', () => {
      expect(clickbaitPenaltyRule('I grew ARR to $1M')).toBe(true)
      expect(clickbaitPenaltyRule('CEO and CTO agreed')).toBe(true)
      expect(clickbaitPenaltyRule('ROI was 300%')).toBe(true)
    })
  })
})

describe('Scoring - Integration Test Fixtures', () => {
  // Fixtures use 80–160 char hooks so length is not the sole driver; assertions match the six rules.
  it('strong outcome hook without a question fails curiosity only', () => {
    const hook =
      "I grew ARR from 0 to 1M in 12 months for our B2B SaaS team. The exact playbook we used is listed below."
    const result = scoreHook(hook)
    expect(hook.length).toBeGreaterThanOrEqual(80)
    expect(hook.length).toBeLessThanOrEqual(160)
    // length+specificity+authority+action = 22+26+8+17; curiosity fails
    expect(result.score).toBe(73)
    expect(result.failedRules.some((r) => r.startsWith('No question or curiosity gap detected'))).toBe(true)
  })

  it('question + specifics + authority can score at the current max', () => {
    const hook =
      "How I scaled to $1M ARR in 12 months for our B2B product? Here is the exact three-channel playbook we used."
    const result = scoreHook(hook)
    expect(result.failedRules).toHaveLength(0)
    // 22+27+26+8+17
    expect(result.score).toBe(100)
  })

  it('helped + playbook rewrite passes authority and action', () => {
    const hook =
      "I've helped 40 founders book meetings in 90 days. Here's the exact outreach playbook we used together."
    const result = scoreHook(hook)
    expect(authorityRule(hook)).toBe(true)
    expect(actionRule(hook)).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(73)
    expect(result.failedRules.every((r) => !r.includes('authority') && !r.includes('action-oriented'))).toBe(
      true,
    )
  })

  it('clickbait ALL CAPS is heavily penalized', () => {
    const hook =
      "YOU WON'T BELIEVE THIS SECRET!!! SHOCKING RESULTS INSIDE FOR FOUNDERS WHO WANT MORE MEETINGS NOW!!!"
    const result = scoreHook(hook)
    expect(result.failedRules.some((r) => r.startsWith('Clickbait pattern detected'))).toBe(true)
    expect(result.score).toBeLessThanOrEqual(50)
  })

  it('vague leadership thought scores poorly', () => {
    const result = scoreHook("Random thoughts on leadership.")
    expect(result.score).toBeLessThan(50)
  })

  it('mistakes + numbers + curiosity without action stays mid-high and score is stable', () => {
    const hook =
      "3 mistakes I made scaling to 50 employees in two years while building a B2B services company from scratch."
    const result = scoreHook(hook)
    // "made" is not an outcome verb → authority fails; no imperative/reader CTA → action fails
    expect(result.score).toBe(75) // length 22 + curiosity 27 + specificity 26
    expect(result.passedRules.some((r) => /specific|curiosity|question/i.test(r))).toBe(true)
    expect(authorityRule(hook)).toBe(false)
    expect(actionRule(hook)).toBe(false)
  })

  it('same mid-score hook remains deterministic across repeats', () => {
    const hook =
      "3 mistakes I made scaling to 50 employees in two years while building a B2B services company from scratch."
    const scores = Array.from({ length: 50 }, () => scoreHook(hook).score)
    expect(new Set(scores)).toEqual(new Set([75]))
  })
})

describe('Authority weight regression (lighter R4)', () => {
  const withAuthority =
    "How I've helped 40 founders book meetings in 90 days: steal this LinkedIn playbook for your next post."
  const withoutAuthority =
    'How do most founders still get ignored on LinkedIn? Steal this 3-line hook playbook for your next B2B post.'

  it('authority is 8; curiosity/specificity absorb the redistributed points', () => {
    expect(SCORING_CONSTANTS.weights.authority).toBe(8)
    expect(SCORING_CONSTANTS.weights.length).toBe(22)
    expect(SCORING_CONSTANTS.weights.curiosity).toBe(27)
    expect(SCORING_CONSTANTS.weights.specificity).toBe(26)
    expect(SCORING_CONSTANTS.weights.action).toBe(17)
    expect(SCORING_CONSTANTS.weights.clickbaitPenalty).toBe(-10)
  })

  it('non-authority hook can still score strongly when other rules pass', () => {
    expect(authorityRule(withoutAuthority)).toBe(false)
    const result = scoreHook(withoutAuthority)
    // length + curiosity + specificity + action = 22+27+26+17
    expect(result.score).toBe(92)
    expect(result.score).toBeGreaterThanOrEqual(80)
  })

  it('otherwise similar hooks differ by the authority weight only', () => {
    const withScore = scoreHook(withAuthority).score
    const withoutScore = scoreHook(withoutAuthority).score
    expect(authorityRule(withAuthority)).toBe(true)
    expect(authorityRule(withoutAuthority)).toBe(false)
    expect(withScore).toBe(100)
    expect(withoutScore).toBe(92)
    expect(withScore - withoutScore).toBe(SCORING_CONSTANTS.weights.authority)
  })
})

describe('Constants', () => {
  it('positive weights sum to 100 before penalty', () => {
    const { weights } = SCORING_CONSTANTS
    const sum = weights.length + weights.curiosity + weights.specificity + weights.authority + weights.action
    expect(sum).toBe(100)
    expect(weights.authority).toBe(8)
    expect(weights.curiosity).toBe(27)
    expect(weights.specificity).toBe(26)
  })

  it('penalty weight is negative', () => {
    expect(SCORING_CONSTANTS.weights.clickbaitPenalty).toBeLessThan(0)
  })
})