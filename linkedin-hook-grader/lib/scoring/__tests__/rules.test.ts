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

    it('fails for first-person without outcome', () => {
      expect(authorityRule('I think about growth')).toBe(false)
    })

    it('fails for outcome without first-person', () => {
      expect(authorityRule('The company grew fast')).toBe(false)
    })

    it('fails for neither', () => {
      expect(authorityRule('Thinking about business')).toBe(false)
    })
  })

  describe('R5: Action Rule', () => {
    it('passes for imperative start', () => {
      expect(actionRule('Discover how I scaled')).toBe(true)
      expect(actionRule('Learn the secret')).toBe(true)
      expect(actionRule('Build your brand')).toBe(true)
    })

    it('passes for action phrases', () => {
      expect(actionRule('Here is how I did it')).toBe(true)
      expect(actionRule('Step by step guide')).toBe(true)
      expect(actionRule('My playbook for growth')).toBe(true)
      expect(actionRule('Roadmap to success')).toBe(true)
      expect(actionRule('Framework for growth')).toBe(true)
    })

    it('fails for passive content', () => {
      expect(actionRule('Thinking about leadership')).toBe(false)
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
    expect(result.score).toBeGreaterThanOrEqual(70)
    expect(result.failedRules).toContain('No question or curiosity gap detected')
  })

  it('question + specifics + authority can score near max', () => {
    const hook =
      "How I scaled to $1M ARR in 12 months for our B2B product? Here is the exact three-channel playbook we used."
    const result = scoreHook(hook)
    expect(result.failedRules).toHaveLength(0)
    expect(result.score).toBe(100)
  })

  it('clickbait ALL CAPS is heavily penalized', () => {
    const hook =
      "YOU WON'T BELIEVE THIS SECRET!!! SHOCKING RESULTS INSIDE FOR FOUNDERS WHO WANT MORE MEETINGS NOW!!!"
    const result = scoreHook(hook)
    expect(result.failedRules).toContain('Clickbait pattern detected')
    expect(result.score).toBeLessThanOrEqual(50)
  })

  it('vague leadership thought scores poorly', () => {
    const result = scoreHook("Random thoughts on leadership.")
    expect(result.score).toBeLessThan(50)
  })

  it('mistakes + numbers + curiosity without action stays mid-high', () => {
    const hook =
      "3 mistakes I made scaling to 50 employees in two years while building a B2B services company from scratch."
    const result = scoreHook(hook)
    expect(result.score).toBeGreaterThanOrEqual(50)
    expect(result.passedRules.some((r) => /specific|curiosity|question/i.test(r))).toBe(true)
  })
})

describe('Constants', () => {
  it('weights sum to 100 before penalty', () => {
    const { weights } = SCORING_CONSTANTS
    const sum = weights.length + weights.curiosity + weights.specificity + weights.authority + weights.action
    expect(sum).toBe(100)
  })

  it('penalty weight is negative', () => {
    expect(SCORING_CONSTANTS.weights.clickbaitPenalty).toBeLessThan(0)
  })
})