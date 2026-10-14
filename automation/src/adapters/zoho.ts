import { SERVICE_DISPLAY } from "../qualify/catalog.js";
import {
  EmailDraftResult,
  ProcessedLead,
  QualificationResult,
  RouteResult,
  RoutingTier,
  ScoreResult,
  StageError,
} from "../types.js";

/**
 * Zoho CRM adapter — DRAFT ONLY / qualification display.
 * There is intentionally no "send email" method in this module.
 * Zoho Email_Drafts__s remains permission-blocked (Crm_Implied_Create_EmailDrafts).
 */
export interface ZohoDraftRequest {
  leadId: string;
  email: string | null;
  fullName: string;
  company: string | null;
  tier: RoutingTier;
  draft: EmailDraftResult | null;
  sendMode: "draft";
  qualification?: QualificationResult;
  draftArtifactId?: string | null;
}

export interface ZohoClient {
  fetchImpl?: typeof fetch;
  apiDomain: string;
  accessToken: string;
}

export interface ZohoCreateDraftInput {
  leadId: string;
  email: string;
  fullName: string;
  company: string | null;
  subject: string;
  body: string;
  idempotencyKey: string;
  mode?: "qualification_description" | "note_placeholder";
}

export function buildZohoQualificationSummary(args: {
  qualification: QualificationResult;
  score: ScoreResult | null;
  route: RouteResult;
  draftArtifactId: string | null;
}): string {
  const q = args.qualification;
  const primary = q.primary ? SERVICE_DISPLAY[q.primary] : "none";
  const secondary = q.secondary ? SERVICE_DISPLAY[q.secondary] : "none";
  return [
    "[MYNTMORE QUALIFICATION — DO NOT SEND]",
    `Primary service: ${primary}`,
    `Secondary service: ${secondary}`,
    `Score: ${args.score?.score ?? "n/a"}/10 — ${args.score?.scoreReason ?? "n/a"}`,
    `Temperature: ${args.route.tier}`,
    `Qualification method: ${q.method}`,
    `Qualification status: ${q.status}`,
    `Draft artifact: ${args.draftArtifactId ?? "none"}`,
    `Draft status: ${args.draftArtifactId ? "draft_only JSON artifact (not Zoho composer)" : "no draft"}`,
    q.exclusionReason ? `Exclusion/review: ${q.exclusionReason}` : null,
    `Reason: ${q.reason}`,
    "send_attempted: false",
  ]
    .filter(Boolean)
    .join("\n");
}

export function planZohoDraft(req: ZohoDraftRequest): ProcessedLead["zoho"] {
  if (req.sendMode !== "draft") {
    return {
      mode: "draft_only",
      wouldCreateDraft: false,
      status: "blocked",
      detail: "Refused: only draft mode is allowed",
    };
  }

  const needsDraft = req.tier === "hot" || req.tier === "warm";
  if (!needsDraft) {
    return {
      mode: "draft_only",
      wouldCreateDraft: false,
      status: "skipped",
      detail:
        "Not a fit — no email draft. Qualification may still be written to Lead Description.",
    };
  }

  if (!req.email) {
    return {
      mode: "draft_only",
      wouldCreateDraft: false,
      status: "blocked",
      detail: "Cannot attach qualification without email",
    };
  }

  if (!req.draft || req.draft.blocked) {
    return {
      mode: "draft_only",
      wouldCreateDraft: false,
      status: "blocked",
      detail: "Email draft blocked or missing — JSON artifact not queued",
    };
  }

  return {
    mode: "draft_only",
    wouldCreateDraft: true,
    status: "dry_run_queued",
    detail: req.draftArtifactId
      ? `Draft JSON artifact ${req.draftArtifactId} (draft_only). Zoho composer API permission-blocked; Lead Description holds qualification summary.`
      : "Dry-run: JSON draft artifact + Zoho Lead Description qualification (never send).",
  };
}

/**
 * Writes a qualification Note / Description payload — never sendMail.
 */
export async function createZohoDraft(
  client: ZohoClient,
  input: ZohoCreateDraftInput,
): Promise<{ result: ProcessedLead["zoho"]; errors: StageError[] }> {
  const fetchImpl = client.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`${client.apiDomain}/crm/v2/Notes`, {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${client.accessToken}`,
        "Content-Type": "application/json",
        "X-Myntmore-Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        data: [
          {
            Note_Title: `[DRAFT ONLY / QUAL] ${input.subject}`,
            Note_Content: `${input.body}\n\n[idempotency_key=${input.idempotencyKey}][mode=${input.mode ?? "note_placeholder"}][send_attempted=false]`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        result: {
          mode: "draft_only",
          wouldCreateDraft: true,
          status: "failed",
          detail: `Zoho note API error (${res.status}): ${body.slice(0, 300)}`,
        },
        errors: [
          {
            stage: "zoho",
            code: "ZOHO_DRAFT_FAILED",
            message: `Zoho note failed with status ${res.status}`,
            recoverable: false,
          },
        ],
      };
    }

    return {
      result: {
        mode: "draft_only",
        wouldCreateDraft: true,
        status: "created",
        detail:
          "Zoho Note with qualification/draft text created (send not invoked; not Email Drafts composer)",
      },
      errors: [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      result: {
        mode: "draft_only",
        wouldCreateDraft: true,
        status: "failed",
        detail: `Zoho request error: ${message}`,
      },
      errors: [
        {
          stage: "zoho",
          code: "ZOHO_DRAFT_ERROR",
          message,
          recoverable: false,
        },
      ],
    };
  }
}
