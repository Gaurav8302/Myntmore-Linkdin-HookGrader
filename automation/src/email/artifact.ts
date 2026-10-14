import { createHash } from "node:crypto";
import { SERVICE_DISPLAY } from "../qualify/catalog.js";
import {
  EmailDraftArtifact,
  EmailDraftResult,
  ProcessedLead,
  QualificationResult,
  RoutingTier,
} from "../types.js";

const CTA = "https://myntmore.com/founder-meeting";

/**
 * Stable draft id so retries update/reuse rather than duplicate.
 */
export function draftArtifactId(
  idempotencyKey: string,
  tier: RoutingTier,
): string {
  const hash = createHash("sha256")
    .update(`${idempotencyKey}|${tier}|draft_v1`)
    .digest("hex")
    .slice(0, 16);
  return `draft_${hash}`;
}

export function buildDraftArtifact(args: {
  leadId: string;
  idempotencyKey: string;
  source: ProcessedLead["source"];
  tier: "hot" | "warm";
  qualification: QualificationResult;
  draft: EmailDraftResult;
  recipient: string;
  createdAt?: string;
}): EmailDraftArtifact {
  const primary = args.qualification.primary
    ? SERVICE_DISPLAY[args.qualification.primary]
    : "Unassigned";
  const secondary = args.qualification.secondary
    ? SERVICE_DISPLAY[args.qualification.secondary]
    : null;

  return {
    draft_id: draftArtifactId(args.idempotencyKey, args.tier),
    lead_id: args.leadId,
    source: args.source,
    lead_temperature: args.tier === "hot" ? "Hot" : "Warm",
    service_fit_primary: primary,
    service_fit_secondary: secondary,
    subject: args.draft.subject,
    recipient: args.recipient,
    body: args.draft.body,
    cta_url: CTA,
    status: "draft_only",
    send_attempted: false,
    qualification_reason: args.qualification.reason,
    created_at: args.createdAt ?? new Date().toISOString(),
    validation_ok: !args.draft.blocked && args.draft.validationErrors.length === 0,
    validation_errors: args.draft.validationErrors,
    draft_source: args.draft.source,
  };
}
