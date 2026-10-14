import { CleanResult, ScoreResult } from "../types.js";
import { applyScoreRules } from "./rules.js";

/**
 * Score a cleaned lead. Deterministic only — Gemini never sets the numeric score.
 */
export function scoreLead(clean: CleanResult): ScoreResult {
  const { score, service, breakdown } = applyScoreRules(clean);

  const topDrivers = breakdown
    .filter((b) => b.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 2)
    .map((b) => b.note);

  const scoreReason =
    topDrivers.length > 0
      ? `${service.replace(/_/g, " ")} fit ${score}/10 — ${topDrivers.join("; ")}`
      : `${service.replace(/_/g, " ")} fit ${score}/10 — base mid-score`;

  return {
    score,
    service,
    scoreReason: truncateOneLine(scoreReason, 200),
    ruleBreakdown: breakdown,
    geminiRole: "none_for_scoring",
  };
}

function truncateOneLine(text: string, max: number): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length <= max ? one : `${one.slice(0, max - 1)}…`;
}
