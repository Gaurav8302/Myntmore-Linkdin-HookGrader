import { CleanResult, QualificationResult, MyntmoreService } from "../types.js";
import {
  QUALIFICATION_VERSION,
  SERVICE_DISPLAY,
  TOOL_SERVICE_PRIOR,
  displayToService,
} from "./catalog.js";
import { formatServiceReason, scoreServiceFits } from "./rules.js";

export { SERVICE_DISPLAY, QUALIFICATION_VERSION, ALLOWED_SERVICE_DISPLAY } from "./catalog.js";
export { scoreServiceFits } from "./rules.js";

const PRIMARY_MIN = 2;
const SECONDARY_MIN = 2;
const AMBIGUITY_GAP = 1;

export interface QualifyOptions {
  /**
   * Optional NVIDIA helper for ambiguous cases only.
   * Must return one of the seven official display names or null.
   */
  resolveAmbiguous?: (args: {
    clean: CleanResult;
    candidates: MyntmoreService[];
  }) => Promise<MyntmoreService | null>;
}

/**
 * Separate from Hot/Warm routing. Hard exclusions set status=excluded.
 * Ambiguous multi-service ties → needs_review unless NVIDIA resolves within allow-list.
 */
export async function qualifyLead(
  clean: CleanResult,
  options: QualifyOptions = {},
): Promise<QualificationResult> {
  const hardExcluded =
    clean.flags.includes("test_entry") ||
    clean.flags.includes("non_buyer") ||
    clean.flags.includes("prompt_injection") ||
    clean.flags.includes("malformed");

  if (hardExcluded) {
    const prior = TOOL_SERVICE_PRIOR[clean.normalized.sourceTool] ?? null;
    return {
      primary: prior,
      secondary: null,
      reason: `Excluded from service assignment — ${clean.reasons.filter((r) => !r.startsWith("Passed")).join("; ") || "hard exclusion"}`,
      method: "rules_only",
      status: "excluded",
      exclusionReason:
        clean.reasons.filter((r) => !r.startsWith("Passed")).join("; ") ||
        "hard exclusion",
      version: QUALIFICATION_VERSION,
      ruleHits: [],
    };
  }

  const fits = scoreServiceFits(clean);
  const top = fits[0];
  const second = fits[1];
  const ruleHits = fits
    .filter((f) => f.points > 0)
    .map((f) => ({
      service: f.service,
      points: f.points,
      signals: f.matchedSignals.slice(0, 5),
    }));

  if (!top || top.points < PRIMARY_MIN) {
    const prior = TOOL_SERVICE_PRIOR[clean.normalized.sourceTool] ?? null;
    if (prior) {
      return {
        primary: prior,
        secondary: null,
        reason: `Insufficient distinct signals; using tool prior ${SERVICE_DISPLAY[prior]} from ${clean.normalized.sourceTool}. Status needs_review.`,
        method: "rules_only",
        status: "needs_review",
        exclusionReason: null,
        version: QUALIFICATION_VERSION,
        ruleHits,
      };
    }
    return {
      primary: null,
      secondary: null,
      reason: "Insufficient evidence for any Myntmore service — needs_review",
      method: "rules_only",
      status: "needs_review",
      exclusionReason: "insufficient_service_evidence",
      version: QUALIFICATION_VERSION,
      ruleHits,
    };
  }

  const ambiguous =
    second &&
    second.points >= PRIMARY_MIN &&
    top.points - second.points <= AMBIGUITY_GAP &&
    top.service !== second.service;

  let primary = top.service;
  let secondary: MyntmoreService | null =
    second && second.points >= SECONDARY_MIN && second.service !== primary
      ? second.service
      : null;
  let method: QualificationResult["method"] = "rules_only";
  let status: QualificationResult["status"] = "qualified";

  if (ambiguous && options.resolveAmbiguous) {
    try {
      const resolved = await options.resolveAmbiguous({
        clean,
        candidates: [top.service, second!.service],
      });
      if (resolved && (resolved === top.service || resolved === second!.service)) {
        primary = resolved;
        secondary =
          resolved === top.service ? second!.service : top.service;
        method = "rules_plus_nvidia";
      } else {
        status = "needs_review";
        method = "rules_plus_nvidia";
      }
    } catch {
      status = "needs_review";
      method = "rules_only";
    }
  } else if (ambiguous) {
    status = "needs_review";
  }

  // Duplicate contact: keep qualification but note canonical reference in reason
  let reason = formatServiceReason(primary, secondary, fits);
  if (clean.flags.includes("duplicate_contact")) {
    reason += " Duplicate contact session retained; reference canonical email record.";
  }

  return {
    primary,
    secondary,
    reason: truncate(reason, 280),
    method,
    status,
    exclusionReason: null,
    version: QUALIFICATION_VERSION,
    ruleHits,
  };
}

/** Validate NVIDIA / external service pick against allow-list. */
export function validateServicePick(raw: string): MyntmoreService | null {
  return displayToService(raw);
}

function truncate(text: string, max: number): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length <= max ? one : `${one.slice(0, max - 1)}…`;
}
