import {
  CleanFlag,
  EmailDraftResult,
  MyntmoreService,
  ProcessedLead,
  RoutingTier,
  StageError,
} from "./types.js";

export type RowDisposition =
  | "processed"
  | "excluded"
  | "duplicate_retained"
  | "failed";

export type DraftStatus =
  | "none"
  | "skipped"
  | "nvidia"
  | "gemini"
  | "template_fallback"
  | "blocked";

export type { StageError };

/**
 * Flat, explainable row result for CLI/n8n summaries.
 * One row in = one observation out (no silent drops).
 */
export interface RowObservation {
  sourceId: string;
  idempotencyKey: string;
  disposition: RowDisposition;
  service: MyntmoreService | null;
  score: number | null;
  scoreReason: string | null;
  routingTier: RoutingTier;
  cleaningFlags: CleanFlag[];
  cleaningReasons: string[];
  draftStatus: DraftStatus;
  alertRequired: boolean;
  zohoStatus: ProcessedLead["zoho"]["status"];
  persistenceStatus: ProcessedLead["persistence"]["status"];
  errors: StageError[];
}

export interface PipelineCounts {
  imported: number;
  /** Every imported row that produced an observation (should equal imported). */
  processed: number;
  /** Primary buckets — mutually exclusive, sum to processed. */
  excluded: number;
  failed: number;
  /** Successful non-excluded rows (includes duplicate_retained). */
  completed: number;
  /** Overlay: rows with duplicate_contact flag (still counted in completed/excluded). */
  duplicate: number;
  /** Overlay: usable non-blocked drafts. */
  drafted: number;
  /** Overlay: drafts that used template fallback. */
  fallbackDrafts: number;
  /** Overlay: qualification status needs_review. */
  needsReview: number;
}

export function draftStatusFrom(
  draft: EmailDraftResult | null,
  tier: RoutingTier,
): DraftStatus {
  if (tier === "not_a_fit") return "skipped";
  if (!draft) return "none";
  if (draft.blocked) return "blocked";
  return draft.source === "nvidia" || draft.source === "gemini"
    ? draft.source === "nvidia"
      ? "nvidia"
      : "gemini"
    : "template_fallback";
}

export function dispositionFrom(lead: ProcessedLead): RowDisposition {
  const hasHardFailure = lead.errors.some((e) => !e.recoverable);
  if (hasHardFailure) return "failed";
  if (lead.route.tier === "not_a_fit") return "excluded";
  if (lead.clean.flags.includes("duplicate_contact")) return "duplicate_retained";
  return "processed";
}

export function toRowObservation(lead: ProcessedLead): RowObservation {
  return {
    sourceId: lead.leadId,
    idempotencyKey: lead.idempotencyKey,
    disposition: dispositionFrom(lead),
    service: lead.score?.service ?? null,
    score: lead.score?.score ?? null,
    scoreReason: lead.score?.scoreReason ?? null,
    routingTier: lead.route.tier,
    cleaningFlags: lead.clean.flags,
    cleaningReasons: lead.clean.reasons,
    draftStatus: draftStatusFrom(lead.emailDraft, lead.route.tier),
    alertRequired: lead.route.alertRequired,
    zohoStatus: lead.zoho.status,
    persistenceStatus: lead.persistence.status,
    errors: lead.errors,
  };
}

/**
 * Counts without double-counting primary disposition buckets.
 * `duplicate` / `drafted` / `fallbackDrafts` are overlays.
 */
export function summarizeCounts(leads: ProcessedLead[]): PipelineCounts {
  const observations = leads.map(toRowObservation);
  let excluded = 0;
  let failed = 0;
  let completed = 0;
  let duplicate = 0;
  let drafted = 0;
  let fallbackDrafts = 0;
  let needsReview = 0;

  for (let i = 0; i < observations.length; i += 1) {
    const obs = observations[i];
    if (obs.disposition === "failed") failed += 1;
    else if (obs.disposition === "excluded") excluded += 1;
    else completed += 1; // processed + duplicate_retained

    if (obs.cleaningFlags.includes("duplicate_contact")) duplicate += 1;
    if (
      obs.draftStatus === "nvidia" ||
      obs.draftStatus === "gemini" ||
      obs.draftStatus === "template_fallback"
    ) {
      drafted += 1;
    }
    if (obs.draftStatus === "template_fallback") fallbackDrafts += 1;
    if (leads[i].qualification.status === "needs_review") needsReview += 1;
  }

  return {
    imported: leads.length,
    processed: leads.length,
    excluded,
    failed,
    completed,
    duplicate,
    drafted,
    fallbackDrafts,
    needsReview,
  };
}
