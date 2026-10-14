import { CleanResult, RouteResult, ScoreResult } from "../types.js";

/**
 * Routing:
 * - Hot: score >= 8, email-eligible → draft + alert
 * - Warm: score 5–7, email-eligible → one nurture draft
 * - Not a fit: blocked clean flags OR score <= 4 OR not email-eligible → tag, no email
 */
export function routeLead(clean: CleanResult, score: ScoreResult | null): RouteResult {
  const blocked =
    clean.flags.includes("test_entry") ||
    clean.flags.includes("non_buyer") ||
    clean.flags.includes("prompt_injection") ||
    clean.flags.includes("missing_email") ||
    clean.flags.includes("malformed");

  if (blocked) {
    return {
      tier: "not_a_fit",
      alertRequired: false,
      draftEmailRequired: false,
      reason: `Not a fit — ${clean.reasons.filter((r) => !r.startsWith("Passed")).join("; ") || "blocked classification"}`,
    };
  }

  if (!clean.eligibleForEmail) {
    return {
      tier: "not_a_fit",
      alertRequired: false,
      draftEmailRequired: false,
      reason: "Not a fit — incomplete session; no email draft without tool context",
    };
  }

  const value = score?.score ?? 1;

  if (value >= 8) {
    return {
      tier: "hot",
      alertRequired: true,
      draftEmailRequired: true,
      reason: `Hot — score ${value}/10 with buyer signals; draft + alert`,
    };
  }

  if (value >= 5) {
    return {
      tier: "warm",
      alertRequired: false,
      draftEmailRequired: true,
      reason: `Warm — score ${value}/10; one nurture draft`,
    };
  }

  return {
    tier: "not_a_fit",
    alertRequired: false,
    draftEmailRequired: false,
    reason: `Not a fit — score ${value}/10 below warm threshold`,
  };
}
