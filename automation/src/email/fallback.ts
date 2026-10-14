import { CleanResult, EmailDraftResult, MyntmoreService, RoutingTier } from "../types.js";
import { countWords } from "./rules.js";
import { validateEmailDraft } from "./validate.js";

const SERVICE_LABEL: Record<MyntmoreService, string> = {
  personal_branding: "personal branding",
  linkedin_outreach: "LinkedIn outreach",
  cold_email: "cold email",
  lead_generation: "lead generation",
};

/**
 * Deterministic template used when Gemini is unavailable or returns invalid output.
 * Uses only facts present in the cleaned lead fields — no invented metrics.
 */
export function buildFallbackDraft(
  clean: CleanResult,
  service: MyntmoreService,
  tier: RoutingTier,
  founderMeetingUrl: string,
  fallbackReason = "template_fallback",
): EmailDraftResult {
  const first = clean.normalized.firstName || "there";
  const tool = clean.normalized.sourceTool.replace(/_/g, " ");
  const company = clean.normalized.company;
  const inputSnippet = clip(clean.normalized.toolInput, 90);
  const outputSnippet = clip(clean.normalized.toolOutput, 90);

  const subject =
    tier === "hot"
      ? `Quick note on your ${tool} results`
      : `Following up on your ${tool} session`;

  const lines = [
    `Hi ${first},`,
    "",
    company
      ? `Thanks for trying Myntmore's ${tool} for ${company}.`
      : `Thanks for trying Myntmore's ${tool}.`,
    inputSnippet ? `You shared: ${inputSnippet}` : null,
    outputSnippet ? `The tool returned: ${outputSnippet}` : null,
    `If helpful, we can talk about ${SERVICE_LABEL[service]} next steps.`,
    `Book a founder meeting: https://${founderMeetingUrl}`,
    "",
    "Best,",
    "Myntmore",
  ].filter((line): line is string => line !== null);

  const body = lines.join("\n");
  const validationErrors = validateEmailDraft(subject, body, founderMeetingUrl);

  return {
    subject,
    body,
    wordCount: countWords(body),
    source: "template_fallback",
    validationErrors,
    blocked: validationErrors.length > 0,
    isFallback: true,
    fallbackReason,
  };
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}
