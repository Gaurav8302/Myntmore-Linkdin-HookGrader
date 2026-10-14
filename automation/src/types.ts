import { z } from "zod";

/** Seven official Myntmore services (service-page grounded). */
export const MYNTMORE_SERVICES = [
  "linkedin_outreach",
  "cold_email",
  "icp_mapping",
  "ai_lead_generation",
  "account_based_marketing",
  "personal_branding",
  "gtm_strategy",
] as const;

export type MyntmoreService = (typeof MYNTMORE_SERVICES)[number];

export const ROUTING_TIERS = ["hot", "warm", "not_a_fit"] as const;
export type RoutingTier = (typeof ROUTING_TIERS)[number];

export const CLEAN_FLAGS = [
  "ok",
  "test_entry",
  "non_buyer",
  "duplicate_contact",
  "missing_email",
  "incomplete_session",
  "prompt_injection",
  "malformed",
] as const;

export type CleanFlag = (typeof CLEAN_FLAGS)[number];

export const RawLeadSchema = z.object({
  lead_id: z.string().min(1),
  created_at: z.string(),
  source_tool: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  designation: z.string(),
  email: z.string(),
  company: z.string(),
  company_website: z.string(),
  linkedin_url: z.string(),
  tool_input: z.string(),
  tool_output: z.string(),
});

export type RawLead = z.infer<typeof RawLeadSchema>;

export interface CleanResult {
  leadId: string;
  /** Idempotency key for this CSV session row. */
  idempotencyKey: string;
  normalized: {
    firstName: string;
    lastName: string;
    fullName: string;
    designation: string;
    email: string | null;
    company: string | null;
    companyWebsite: string | null;
    linkedinUrl: string | null;
    sourceTool: string;
    createdAt: string;
    toolInput: string;
    toolOutput: string;
  };
  flags: CleanFlag[];
  /** Every classification / exclusion reason — never empty when non-ok flags exist. */
  reasons: string[];
  /** True when the row is retained for scoring; false still means persisted with reasons. */
  eligibleForScoring: boolean;
  /** True when Hot/Warm email drafting is allowed. */
  eligibleForEmail: boolean;
}

export interface QualificationResult {
  primary: MyntmoreService | null;
  secondary: MyntmoreService | null;
  reason: string;
  method: "rules_only" | "rules_plus_nvidia";
  status: "qualified" | "needs_review" | "excluded";
  exclusionReason: string | null;
  version: string;
  ruleHits: Array<{ service: MyntmoreService; points: number; signals: string[] }>;
}

export interface ScoreResult {
  score: number;
  /** @deprecated Prefer qualification.primary — kept for schema compatibility */
  service: MyntmoreService;
  scoreReason: string;
  /** Deterministic rule contributions (rules vs NVIDIA split). */
  ruleBreakdown: Array<{ rule: string; delta: number; note: string }>;
  geminiRole: "none_for_scoring";
}

export interface EmailDraftResult {
  subject: string;
  body: string;
  wordCount: number;
  source: "nvidia" | "gemini" | "template_fallback";
  validationErrors: string[];
  /** When true, draft must not be used for CRM push without human review. */
  blocked: boolean;
  /** True when NVIDIA failed/invalid and template was used. */
  isFallback: boolean;
  fallbackReason?: string;
}

/** Durable JSON draft artifact (not a Zoho email-composer draft). */
export interface EmailDraftArtifact {
  draft_id: string;
  lead_id: string;
  source: "csv" | "hook_grader_via_make";
  lead_temperature: "Hot" | "Warm";
  service_fit_primary: string;
  service_fit_secondary: string | null;
  subject: string;
  recipient: string;
  body: string;
  cta_url: string;
  status: "draft_only";
  send_attempted: false;
  qualification_reason: string;
  created_at: string;
  validation_ok: boolean;
  validation_errors: string[];
  draft_source: EmailDraftResult["source"];
}

export interface StageError {
  stage:
    | "clean"
    | "score"
    | "qualify"
    | "route"
    | "email"
    | "zoho"
    | "persist"
    | "pipeline";
  code: string;
  message: string;
  recoverable: boolean;
}

export interface RouteResult {
  tier: RoutingTier;
  alertRequired: boolean;
  draftEmailRequired: boolean;
  reason: string;
}

export interface ProcessedLead {
  leadId: string;
  idempotencyKey: string;
  source: "csv" | "hook_grader_via_make";
  raw: RawLead;
  clean: CleanResult;
  qualification: QualificationResult;
  score: ScoreResult | null;
  route: RouteResult;
  emailDraft: EmailDraftResult | null;
  draftArtifact: EmailDraftArtifact | null;
  zoho: {
    mode: "draft_only";
    wouldCreateDraft: boolean;
    status: "skipped" | "dry_run_queued" | "created" | "failed" | "blocked";
    detail: string;
  };
  persistence: {
    status: "dry_run" | "pending" | "upserted" | "failed";
    detail: string;
  };
  /** Expected exclusions stay recoverable; unexpected adapter failures are listed here. */
  errors: StageError[];
}

export interface PipelineSummary {
  totalRows: number;
  accountedRows: number;
  byTier: Record<RoutingTier, number>;
  byFlag: Record<string, number>;
  byPrimaryService: Record<string, number>;
  counts: {
    imported: number;
    processed: number;
    excluded: number;
    failed: number;
    completed: number;
    duplicate: number;
    drafted: number;
    fallbackDrafts: number;
    needsReview: number;
  };
  observations: Array<{
    sourceId: string;
    idempotencyKey: string;
    disposition: string;
    service: string | null;
    score: number | null;
    scoreReason: string | null;
    routingTier: RoutingTier;
    cleaningFlags: CleanFlag[];
    draftStatus: string;
    errors: StageError[];
  }>;
  leads: ProcessedLead[];
}
