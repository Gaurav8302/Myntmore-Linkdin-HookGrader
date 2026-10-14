import { z } from "zod";

/** Myntmore services used for lead scoring (assignment). */
export const MYNTMORE_SERVICES = [
  "personal_branding",
  "linkedin_outreach",
  "cold_email",
  "lead_generation",
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

export interface ScoreResult {
  score: number;
  service: MyntmoreService;
  scoreReason: string;
  /** Deterministic rule contributions (rules vs Gemini split). */
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
  /** True when Gemini failed/invalid and template was used. */
  isFallback: boolean;
  fallbackReason?: string;
}

export interface StageError {
  stage: "clean" | "score" | "route" | "email" | "zoho" | "persist" | "pipeline";
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
  score: ScoreResult | null;
  route: RouteResult;
  emailDraft: EmailDraftResult | null;
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
  counts: {
    imported: number;
    processed: number;
    excluded: number;
    failed: number;
    completed: number;
    duplicate: number;
    drafted: number;
    fallbackDrafts: number;
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
