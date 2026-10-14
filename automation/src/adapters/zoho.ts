import { EmailDraftResult, ProcessedLead, RoutingTier, StageError } from "../types.js";

/**
 * Zoho CRM adapter — DRAFT ONLY.
 * There is intentionally no "send email" method in this module.
 */
export interface ZohoDraftRequest {
  leadId: string;
  email: string | null;
  fullName: string;
  company: string | null;
  tier: RoutingTier;
  draft: EmailDraftResult | null;
  sendMode: "draft";
}

export interface ZohoClient {
  /** Injected fetch for tests / live draft creation. */
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
      detail: "Not a fit — no Zoho email draft",
    };
  }

  if (!req.email) {
    return {
      mode: "draft_only",
      wouldCreateDraft: false,
      status: "blocked",
      detail: "Cannot create Zoho draft without email",
    };
  }

  if (!req.draft || req.draft.blocked) {
    return {
      mode: "draft_only",
      wouldCreateDraft: false,
      status: "blocked",
      detail: "Email draft blocked or missing — Zoho draft not queued",
    };
  }

  return {
    mode: "draft_only",
    wouldCreateDraft: true,
    status: "dry_run_queued",
    detail:
      "Dry-run: would create Zoho CRM email/note draft only (never auto-send). Credentials UNVERIFIED.",
  };
}

/**
 * Live draft creation — still draft-only. Uses Notes API shape as a placeholder.
 * Idempotency: callers must upsert CRM notes keyed by idempotencyKey externally.
 * UNVERIFIED until Zoho credentials are provided and tested.
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
            Note_Title: `[DRAFT ONLY] ${input.subject}`,
            Note_Content: `${input.body}\n\n[idempotency_key=${input.idempotencyKey}]`,
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
          detail: `Zoho draft API error (${res.status}): ${body.slice(0, 300)}`,
        },
        errors: [
          {
            stage: "zoho",
            code: "ZOHO_DRAFT_FAILED",
            message: `Zoho draft failed with status ${res.status}`,
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
        detail: "Zoho draft/note created (send not invoked)",
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
        detail: `Zoho draft request error: ${message}`,
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
