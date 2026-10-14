import { CleanResult, MyntmoreService } from "../types.js";
import {
  SERVICE_DISPLAY,
  SERVICE_SIGNALS,
  TOOL_SERVICE_PRIOR,
} from "./catalog.js";

export interface ServiceFitScore {
  service: MyntmoreService;
  points: number;
  matchedSignals: string[];
}

/**
 * Deterministic multi-service scoring from submitted tool input/output + tool prior.
 * Does not invent company facts.
 */
export function scoreServiceFits(clean: CleanResult): ServiceFitScore[] {
  const corpus = [
    clean.normalized.toolInput,
    clean.normalized.toolOutput,
    clean.normalized.sourceTool.replace(/_/g, " "),
    clean.normalized.designation,
  ].join("\n");

  const byService = new Map<MyntmoreService, ServiceFitScore>();
  for (const def of SERVICE_SIGNALS) {
    byService.set(def.id, { service: def.id, points: 0, matchedSignals: [] });
  }

  for (const def of SERVICE_SIGNALS) {
    const entry = byService.get(def.id)!;
    for (const pattern of def.patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(corpus)) {
        entry.points += def.weight;
        entry.matchedSignals.push(pattern.source.slice(0, 60));
      }
    }
  }

  // Tool prior: modest boost, never sole reason for Hot certainty
  const prior = TOOL_SERVICE_PRIOR[clean.normalized.sourceTool];
  if (prior) {
    const entry = byService.get(prior)!;
    entry.points += 1;
    entry.matchedSignals.push(`tool_prior:${clean.normalized.sourceTool}`);
  }

  // ABM guard: require named/target account language — do not assign ABM for generic "leads"
  const abm = byService.get("account_based_marketing")!;
  const hasAbmEvidence =
    /\b(named accounts?|target accounts?|buying committee|account-?based|\babm\b)\b/i.test(
      corpus,
    );
  if (!hasAbmEvidence && abm.points > 0) {
    abm.points = Math.min(abm.points, 1);
  }
  if (!hasAbmEvidence) {
    abm.matchedSignals = abm.matchedSignals.filter((s) =>
      /named|target account|buying committee|account-?based|abm/i.test(s),
    );
  }

  // Generic "leads" / "linkedin" / "ai" alone must not force AI Lead Gen or Outreach
  const ai = byService.get("ai_lead_generation")!;
  if (
    ai.points <= 2 &&
    /\bleads?\b/i.test(corpus) &&
    !/\b(ai |research|enrich|qualify|magnet|case study)/i.test(corpus)
  ) {
    // leave tool prior only
  }

  return [...byService.values()].sort((a, b) => b.points - a.points);
}

export function formatServiceReason(
  primary: MyntmoreService,
  secondary: MyntmoreService | null,
  fits: ServiceFitScore[],
): string {
  const top = fits.find((f) => f.service === primary);
  const evidence =
    top?.matchedSignals.slice(0, 3).join("; ") ||
    "tool prior and session context";
  const secondaryBit = secondary
    ? ` Secondary: ${SERVICE_DISPLAY[secondary]}.`
    : "";
  return `Primary ${SERVICE_DISPLAY[primary]} from submitted signals (${evidence}).${secondaryBit}`;
}
