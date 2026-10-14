/**
 * Scoring Engine Constants
 * All weights, thresholds, and patterns are configurable here.
 * Do not hardcode magic numbers in rule implementations.
 */

export const SCORING_CONSTANTS = {
  // Rule weights (sum to 100 before penalty)
  weights: {
    length: 22,
    curiosity: 22,
    specificity: 22,
    authority: 17,
    action: 17,
    clickbaitPenalty: -10,
  },

  // Length rule thresholds
  length: {
    min: 80,
    max: 160,
  },

  // Curiosity rule patterns
  curiosity: {
    words: ['how', 'why', 'what', 'secret', 'mistake', 'discovered', 'learned', 'realized'],
    questionMark: true,
  },

  // Specificity rule patterns
  specificity: {
    timeframePatterns: [/\d+\s*(day|week|month|year)s?/i],
    currencyPatterns: [/\$|₹|AED|€|£/],
    percentagePattern: /%/,
    digitPattern: /\d/,
    properNounPattern: /[A-Z][a-z]{6,}(?:\s+[A-Z][a-z]+)*/,
  },

  // Authority rule patterns
  authority: {
    firstPersonPronouns: /\b(i|we|my|our)\b/i,
    outcomeVerbs: /\b(achieved|grew|built|scaled|reached|increased|decreased|launched|created|generated|delivered)\b/i,
  },

  // Action rule patterns
  action: {
    imperativeStart: /^(discover|learn|find|get|build|create|make|start|stop|avoid|use|try|see|watch|read|download|join|sign up|subscribe|register)\b/i,
    actionPhrases: [
      "here's how",
      "here is how",
      "step by step",
      "playbook",
      "roadmap",
      "framework",
      "template",
      "guide",
      "blueprint",
      "checklist",
      "formula",
      "method",
      "system",
      "strategy",
      "approach",
    ],
  },

  // Clickbait penalty patterns
  clickbait: {
    capsThreshold: 3, // words in ALL CAPS longer than this count as clickbait
    exclamationThreshold: 3, // maximum exclamation marks before penalty
    phrases: [
      "you won't believe",
      "shocking",
      "secret revealed",
      "doctors hate",
      "this one trick",
      "they don't want you to know",
      "number 7 will shock you",
    ],
  },

  // Score bounds
  score: {
    min: 0,
    max: 100,
  },
} as const

export type ScoringConstants = typeof SCORING_CONSTANTS