/**
 * Scoring Rules Implementation
 * Each rule is a pure function that returns boolean.
 * No external dependencies, no AI, fully deterministic.
 */

import { SCORING_CONSTANTS } from './constants'
import { Rule } from './types'

/**
 * R1: Length Rule
 * Optimal range: 80-160 characters for two lines
 */
export function lengthRule(hook: string): boolean {
  const trimmed = hook.trim()
  return trimmed.length >= SCORING_CONSTANTS.length.min && trimmed.length <= SCORING_CONSTANTS.length.max
}

/**
 * R2: Curiosity Gap Rule
 * Contains ? OR curiosity-triggering words
 */
export function curiosityRule(hook: string): boolean {
  const lower = hook.toLowerCase()

  // Check for question mark
  if (SCORING_CONSTANTS.curiosity.questionMark && hook.includes('?')) {
    return true
  }

  // Check for curiosity words
  return SCORING_CONSTANTS.curiosity.words.some(word => lower.includes(word))
}

/**
 * R3: Specificity Rule
 * Contains at least one of: digits, timeframes, proper nouns, currency, percentages
 */
export function specificityRule(hook: string): boolean {
  const constants = SCORING_CONSTANTS.specificity

  // Check for digits
  if (constants.digitPattern.test(hook)) {
    return true
  }

  // Check for timeframe patterns
  if (constants.timeframePatterns.some(pattern => pattern.test(hook))) {
    return true
  }

  // Check for currency symbols
  if (constants.currencyPatterns.some(pattern => pattern.test(hook))) {
    return true
  }

  // Check for percentage
  if (constants.percentagePattern.test(hook)) {
    return true
  }

  // Check for proper nouns: either two+ consecutive capitalized words, OR first word is long enough (>= 7 chars)
  const hasTwoOrMoreConsecutiveCapWords = /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(hook);
  const firstWord = hook.split(/\s+/)[0];
  const isFirstWordLongEnough = firstWord && firstWord.length >= 7;
  if (hasTwoOrMoreConsecutiveCapWords || isFirstWordLongEnough) {
    return true;
  }

  return false
}

/**
 * R4: Authority Signal Rule
 * Contains first-person pronoun AND outcome/claim verb
 */
export function authorityRule(hook: string): boolean {
  const constants = SCORING_CONSTANTS.authority

  const hasFirstPerson = constants.firstPersonPronouns.test(hook)
  const hasOutcomeVerb = constants.outcomeVerbs.test(hook)

  return hasFirstPerson && hasOutcomeVerb
}

/**
 * R5: Action Orientation Rule
 * Starts with imperative verb OR contains action-oriented phrases
 */
export function actionRule(hook: string): boolean {
  const constants = SCORING_CONSTANTS.action
  const trimmed = hook.trim()
  const lower = trimmed.toLowerCase()

  // Check if starts with imperative verb
  if (constants.imperativeStart.test(trimmed)) {
    return true
  }

  // Check for action phrases
  return constants.actionPhrases.some(phrase => lower.includes(phrase))
}

/**
 * R6: Clickbait Penalty Rule (negative weight)
 * Returns true if NO clickbait patterns detected (no penalty)
 * Returns false if clickbait patterns detected (penalty applies)
 */
export function clickbaitPenaltyRule(hook: string): boolean {
  const constants = SCORING_CONSTANTS.clickbait
  const lower = hook.toLowerCase()

  // Check for clickbait phrases
  const hasClickbaitPhrase = constants.phrases.some(phrase => lower.includes(phrase))
  if (hasClickbaitPhrase) {
    return false
  }

  // Check for excessive exclamation marks
  const exclamationCount = (hook.match(/!/g) || []).length
  if (exclamationCount >= constants.exclamationThreshold) {
    return false
  }

  // Check for ALL CAPS words longer than threshold (letters only)
  const words = hook.split(/\s+/)
  const hasExcessiveCaps = words.some(word => {
    // Only check words that consist entirely of letters, are all caps, and longer than threshold
    if (word.length > constants.capsThreshold && word === word.toUpperCase() && /^[A-Z]+$/.test(word)) {
      // Exclude common acronyms
      const acronyms = ['ARR', 'ROI', 'CEO', 'CTO', 'CFO', 'VP', 'HR', 'IT', 'AI', 'ML', 'SaaS', 'B2B', 'B2C', 'KPI', 'OKR', 'SEO', 'SEM', 'CRM', 'CMS', 'API', 'SDK', 'UI', 'UX']
      return !acronyms.includes(word)
    }
    return false
  })

  if (hasExcessiveCaps) {
    return false
  }

  return true // Pass = no clickbait detected
}

/**
 * All rules with their metadata
 */
export const ALL_RULES = [
  {
    id: 'R1',
    weight: SCORING_CONSTANTS.weights.length,
    check: lengthRule,
    passReason: 'Optimal length (80-160 chars)',
    failReason: 'Hook length outside optimal range (80-160 chars)',
  },
  {
    id: 'R2',
    weight: SCORING_CONSTANTS.weights.curiosity,
    check: curiosityRule,
    passReason: 'Contains question or curiosity trigger',
    failReason: 'No question or curiosity gap detected',
  },
  {
    id: 'R3',
    weight: SCORING_CONSTANTS.weights.specificity,
    check: specificityRule,
    passReason: 'Contains specific numbers, timeframes, or concrete outcomes',
    failReason: 'Lacks specific numbers, timeframes, or concrete outcomes',
  },
  {
    id: 'R4',
    weight: SCORING_CONSTANTS.weights.authority,
    check: authorityRule,
    passReason: 'First-person authority signal with outcome present',
    failReason: 'Missing first-person authority signal with outcome',
  },
  {
    id: 'R5',
    weight: SCORING_CONSTANTS.weights.action,
    check: actionRule,
    passReason: 'Action-oriented language or imperative structure',
    failReason: 'Not action-oriented; no imperative or reader-focused structure',
  },
  {
    id: 'R6',
    weight: SCORING_CONSTANTS.weights.clickbaitPenalty,
    check: clickbaitPenaltyRule,
    passReason: 'No clickbait patterns detected',
    failReason: 'Clickbait pattern detected',
  },
] as const

export type RuleDefinition = typeof ALL_RULES[number]