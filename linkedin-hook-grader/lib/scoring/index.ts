/**
 * Scoring Engine Main Entry Point
 * Deterministic scoring with configurable rules.
 * Same input always produces same output.
 */

import { ScoreResult } from './types'
import { ALL_RULES, RuleDefinition } from './rules'
import { SCORING_CONSTANTS } from './constants'

/**
 * Normalize hook text for consistent scoring
 * Trims whitespace but preserves internal formatting
 */
function normalizeHook(hook: string): string {
  return hook.trim()
}

/**
 * Get pass reason for a rule ID
 */
function getPassReason(ruleId: string): string {
  const rule = ALL_RULES.find(r => r.id === ruleId)
  return rule?.passReason || 'Rule passed'
}

/**
 * Get fail reason for a rule ID
 */
function getFailReason(ruleId: string): string {
  const rule = ALL_RULES.find(r => r.id === ruleId)
  return rule?.failReason || 'Rule failed'
}

/**
 * Main scoring function
 * Returns deterministic score with passed/failed rule feedback
 */
export function scoreHook(hook: string): ScoreResult {
  const normalized = normalizeHook(hook)

  let score = 0
  const passedRules: string[] = []
  const failedRules: string[] = []

  for (const rule of ALL_RULES) {
    const passed = rule.check(normalized)

    if (rule.weight >= 0) {
      // Positive rules award points only when they pass.
      if (passed) {
        score += rule.weight
        passedRules.push(getPassReason(rule.id))
      } else {
        failedRules.push(getFailReason(rule.id))
      }
    } else {
      // Penalty rules: check() true means clean (no penalty). False applies negative weight.
      if (passed) {
        passedRules.push(getPassReason(rule.id))
      } else {
        score += rule.weight
        failedRules.push(getFailReason(rule.id))
      }
    }
  }

  // Clamp to 0-100
  const clampedScore = Math.max(SCORING_CONSTANTS.score.min, Math.min(SCORING_CONSTANTS.score.max, score))

  return {
    score: clampedScore,
    failedRules,
    passedRules,
  }
}

/**
 * Export all rules for testing
 */
export { ALL_RULES }

/**
 * Export constants for testing
 */
export { SCORING_CONSTANTS }