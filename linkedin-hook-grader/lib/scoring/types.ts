/**
 * Scoring Engine Types
 */

export interface ScoreResult {
  score: number
  failedRules: string[]
  passedRules: string[]
}

export interface Rule {
  id: string
  weight: number
  check: (hook: string) => boolean
  passReason: string
  failReason: string
}

export interface RuleCheckResult {
  passed: boolean
  reason: string
}