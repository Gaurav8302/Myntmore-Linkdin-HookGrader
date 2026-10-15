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
 * First-person pronoun (including I've / we've contractions) AND an outcome/result verb.
 * Unsupported self-praise without an outcome verb fails.
 */
export function authorityRule(hook: string): boolean {
  const constants = SCORING_CONSTANTS.authority

  const hasFirstPerson = constants.firstPersonPronouns.test(hook)
  const hasOutcomeVerb = constants.outcomeVerbs.test(hook)

  return hasFirstPerson && hasOutcomeVerb
}

/**
 * R5: Action Orientation Rule
 * Imperative start OR playbook/action phrase OR reader-focused question/CTA.
 */
export function actionRule(hook: string): boolean {
  const constants = SCORING_CONSTANTS.action
  const trimmed = hook.trim()
  const lower = trimmed.toLowerCase()

  if (constants.imperativeStart.test(trimmed)) {
    return true
  }

  if (constants.actionPhrases.some(phrase => lower.includes(phrase))) {
    return true
  }

  // Reader-focused: address the reader with a question or soft CTA
  const addressesReader = constants.readerPronoun.test(trimmed)
  const hasQuestion = trimmed.includes('?')
  const hasReaderCta = constants.readerCtaPhrases.some(phrase => lower.includes(phrase))

  if (addressesReader && (hasQuestion || hasReaderCta)) {
    return true
  }

  return false
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
    failReason:
      'Hook length outside optimal range (80-160 chars). Aim for about two LinkedIn preview lines.',
  },
  {
    id: 'R2',
    weight: SCORING_CONSTANTS.weights.curiosity,
    check: curiosityRule,
    passReason: 'Contains question or curiosity trigger',
    failReason:
      'No question or curiosity gap detected. Add a ? or a trigger like how/why/what/mistake/secret.',
  },
  {
    id: 'R3',
    weight: SCORING_CONSTANTS.weights.specificity,
    check: specificityRule,
    passReason: 'Contains specific numbers, timeframes, or concrete outcomes',
    failReason:
      'Lacks specific numbers, timeframes, or concrete outcomes. Add a digit, %, currency, or timeframe (e.g. 12 months).',
  },
  {
    id: 'R4',
    weight: SCORING_CONSTANTS.weights.authority,
    check: authorityRule,
    passReason: 'First-person authority signal with outcome present',
    failReason:
      'Optional first-person authority with a truthful outcome is missing (smaller score impact). A strong hook can still score well without it. If you have a real result, add I/we/I\'ve + a result verb (e.g. "I\'ve helped 40 founders book meetings"). Do not invent results.',
  },
  {
    id: 'R5',
    weight: SCORING_CONSTANTS.weights.action,
    check: actionRule,
    passReason: 'Action-oriented language or imperative structure',
    failReason:
      'Not action-oriented; no imperative or reader-focused structure. Start with an imperative (Steal this..., Learn...), ask the reader a direct question, or include a clear next step (here\'s how, playbook, roadmap).',
  },
  {
    id: 'R6',
    weight: SCORING_CONSTANTS.weights.clickbaitPenalty,
    check: clickbaitPenaltyRule,
    passReason: 'No clickbait patterns detected',
    failReason:
      'Clickbait pattern detected. Remove ALL CAPS shouting, stacked !!!, or phrases like "you won\'t believe".',
  },
] as const

export type RuleDefinition = typeof ALL_RULES[number]
