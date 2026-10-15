/**
 * Scoring Engine Constants
 * All weights, thresholds, and patterns are configurable here.
 * Do not hardcode magic numbers in rule implementations.
 */

export const SCORING_CONSTANTS = {
  /**
   * Positive rule weights (R1–R5) sum to 100 before the clickbait penalty.
   * Authority is intentionally lighter (~half of the prior 17). The 9 points
   * removed from authority are redistributed to curiosity (+5) and specificity (+4).
   */
  weights: {
    length: 22,
    curiosity: 27,
    specificity: 26,
    /** Was 17; reduced ~50% so missing I/we + outcome does not dominate. */
    authority: 8,
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

  /**
   * R4 Authority predicates
   * Pass = first-person signal AND outcome/result verb (including contractions + participles).
   * Does NOT accept bare self-praise without an outcome verb.
   */
  authority: {
    // I / I've / I'm / I'd / I'll / we / we've / ... / my / our
    firstPersonPronouns:
      /\b(i(?:'m|'ve|'d|'ll)?|we(?:'re|'ve|'d|'ll)?|my|our)\b/i,
    // Past / participle outcome verbs that imply a result (not vague "think" / "am")
    outcomeVerbs:
      /\b(achieved|grew|grown|built|scaled|reached|increased|decreased|launched|created|generated|delivered|helped|improved|reduced|closed|won|raised|hired|sold|shipped|booked|saved|landed|published|signed|converted|doubled|tripled|cut|secured|expanded|optimized|optimised)\b/i,
  },

  /**
   * R5 Action predicates
   * Pass if ANY of:
   * - starts with an imperative / invitation verb
   * - contains a known action/playbook phrase
   * - reader-focused question or CTA (you/your + ? or CTA phrase)
   */
  action: {
    imperativeStart:
      /^(discover|learn|find|get|build|create|make|start|stop|avoid|use|try|see|watch|read|download|join|sign[\s-]?up|subscribe|register|steal|save|comment|share|follow|book|send|apply|check|grab|take|pick|ask|tell|show|prove|don't|do not|want|ready|need|looking)\b/i,
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
      "steal this",
      "save this",
      "comment below",
      "dm me",
      "next step",
      "for you",
      "you can",
      "your next",
    ],
    // Reader address
    readerPronoun: /\b(you|your)\b/i,
    // Soft CTA / invitation phrases (also used with reader pronouns)
    readerCtaPhrases: [
      'want to',
      'ready to',
      'looking for',
      'need to',
      'if you',
      "here's how you",
      'here is how you',
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
