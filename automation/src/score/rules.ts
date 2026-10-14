import { CleanResult, MyntmoreService } from "../types.js";

/**
 * Deterministic service mapping from free-tool source.
 * Gemini is NOT used for service selection or numeric score.
 */
const TOOL_TO_SERVICE: Record<string, MyntmoreService> = {
  profile_optimizer: "personal_branding",
  founder_presence_analyzer: "personal_branding",
  posting_rhythm_builder: "personal_branding",
  dm_angle_generator: "linkedin_outreach",
  roi_calculator: "linkedin_outreach",
  battle_card_generator: "cold_email",
  case_study_generator: "lead_generation",
  icp_builder: "lead_generation",
  lead_magnet_ideas: "lead_generation",
};

export function mapService(sourceTool: string): MyntmoreService {
  return TOOL_TO_SERVICE[sourceTool] ?? "lead_generation";
}

export interface RuleHit {
  rule: string;
  delta: number;
  note: string;
}

/**
 * Pure scoring rules. Score starts at 5, clamped to 1–10.
 * Blocking clean flags force a low ceiling but still produce a score + reason.
 */
export function applyScoreRules(clean: CleanResult): {
  score: number;
  service: MyntmoreService;
  breakdown: RuleHit[];
} {
  const service = mapService(clean.normalized.sourceTool);
  const breakdown: RuleHit[] = [];
  let score = 5;

  const bump = (rule: string, delta: number, note: string) => {
    breakdown.push({ rule, delta, note });
    score += delta;
  };

  bump("base", 0, `Base mid-score; service=${service} from tool ${clean.normalized.sourceTool || "unknown"}`);

  // Role seniority (kept modest so Warm vs Hot stays meaningful on sample CSV)
  const role = clean.normalized.designation.toLowerCase();
  if (/\b(founder|co-founder|ceo|managing director|chief revenue|cro)\b/.test(role)) {
    bump("senior_buyer_role", 1, "Founder/C-level/MD buyer signal");
  } else if (/\b(vp|head of|director)\b/.test(role)) {
    bump("manager_buyer_role", 1, "VP/Head/Director buyer signal");
  } else if (/\b(manager|executive)\b/.test(role) && !/\bopen to work\b/.test(role)) {
    bump("mid_role", 0, "Manager-level — neutral");
  }

  // Company present
  if (clean.normalized.company) {
    bump("has_company", 1, "Company name present");
  } else {
    bump("no_company", -2, "No company — weaker B2B fit");
  }

  // Session completeness
  if (clean.flags.includes("incomplete_session")) {
    bump("incomplete_session", -3, "Missing tool input/output reduces confidence");
  } else if (clean.normalized.toolInput.length > 40 && clean.normalized.toolOutput.length > 10) {
    bump("rich_session", 1, "Substantive tool input and output");
  }

  // B2B / commercial signals in input
  const input = clean.normalized.toolInput.toLowerCase();
  if (/\b(b2b|cfo|cto|hr heads|procurement|founders?|mid-size|revenue|deal|roi)\b/.test(input)) {
    bump("b2b_signal", 1, "B2B/commercial language in tool input");
  }

  // Consumer / weak ICP for Myntmore (lifestyle kids content etc.)
  if (/\b(parents of|lifestyle: weekends only)\b/.test(input)) {
    bump("weak_icp_for_myntmore", -1, "ICP leans consumer/lifestyle vs B2B growth services");
  }

  // Adjacent competitor (ghostwriter offering LinkedIn posts)
  if (/ghostwriter|i write linkedin posts for founders/i.test(input)) {
    bump("adjacent_offer", -1, "Lead offers similar content service — possible competitor");
  }

  // Blocking classifications — score for audit, but cap low
  if (clean.flags.includes("test_entry")) {
    bump("test_entry_cap", -8, "Test entry forced low");
  }
  if (clean.flags.includes("non_buyer")) {
    bump("non_buyer_cap", -6, "Non-buyer forced low");
  }
  if (clean.flags.includes("prompt_injection")) {
    bump("injection_cap", -8, "Prompt injection forced low — ignore adversarial score asks");
  }
  if (clean.flags.includes("missing_email") || clean.flags.includes("malformed")) {
    bump("bad_email", -2, "Missing/invalid email reduces actionability");
  }

  // Duplicate contact: still score the session; slight discount for second touch
  if (clean.flags.includes("duplicate_contact")) {
    bump("duplicate_session", -1, "Duplicate contact session — keep, slightly lower priority");
  }

  const clamped = Math.min(10, Math.max(1, Math.round(score)));
  return { score: clamped, service, breakdown };
}
