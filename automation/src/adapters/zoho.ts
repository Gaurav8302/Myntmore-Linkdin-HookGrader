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
 * Zoho CRM adapter — DRAFT ONLY.
 * Native email drafts via POST /{module}/{record}/__email_drafts.
 * Never calls sendMail / send-message.
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
  /** Optional override; otherwise resolved from from_addresses API. */
  fromEmail?: string;
  /** CRM API version path segment (default v8). */
  apiVersion?: string;
}

export interface ZohoCreateDraftInput {
  /** Pipeline lead id (CSV L01 / Hook Grader session id). */
  leadId: string;
  /** Optional known CRM Lead record id; otherwise resolved/created by email. */
  zohoLeadId?: string;
  email: string;
  fullName: string;
  company: string | null;
  subject: string;
  body: string;
  idempotencyKey: string;
  mode?: "native_email_draft" | "qualification_description" | "note_placeholder";
  /** Optional qualification block written alongside the native draft. */
  qualificationSummary?: string;
}

export interface ZohoFromAddress {
  email: string;
  user_name?: string | null;
  type?: string | null;
}

function apiBase(client: ZohoClient): string {
  const version = client.apiVersion || "v8";
  return `${client.apiDomain.replace(/\/+$/, "")}/crm/${version}`;
}

function authHeaders(client: ZohoClient, idempotencyKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Zoho-oauthtoken ${client.accessToken}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) {
    headers["X-Myntmore-Idempotency-Key"] = idempotencyKey;
  }
  return headers;
}

export function draftSourceKey(idempotencyKey: string): string {
  return `myntmore_task1_idem_${idempotencyKey}`;
}

export function buildZohoQualificationSummary(args: {
  qualification: QualificationResult;
  score: ScoreResult | null;
  route: RouteResult;
  draftArtifactId: string | null;
  zohoDraftId?: string | null;
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
    `Zoho email draft id: ${args.zohoDraftId ?? "none"}`,
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
      detail: "Cannot create draft without email",
    };
  }

  if (!req.draft || req.draft.blocked) {
    return {
      mode: "draft_only",
      wouldCreateDraft: false,
      status: "blocked",
      detail: "Email draft blocked or missing — not queued for Zoho",
    };
  }

  return {
    mode: "draft_only",
    wouldCreateDraft: true,
    status: "dry_run_queued",
    detail: req.draftArtifactId
      ? `Native Zoho email draft planned (JSON artifact ${req.draftArtifactId} kept as audit). Never send.`
      : "Dry-run: native Zoho email draft + Supabase artifact (never send).",
  };
}

/**
 * List allowed CRM "from" addresses (settings/emails/actions/from_addresses).
 */
export async function listZohoFromAddresses(
  client: ZohoClient,
): Promise<{ addresses: ZohoFromAddress[]; detail: string }> {
  const fetchImpl = client.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(
      `${apiBase(client)}/settings/emails/actions/from_addresses`,
      { headers: authHeaders(client) },
    );
    if (!res.ok) {
      const body = await res.text();
      return {
        addresses: [],
        detail: `from_addresses ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    const json = (await res.json()) as {
      from_addresses?: ZohoFromAddress[];
    };
    return {
      addresses: Array.isArray(json.from_addresses) ? json.from_addresses : [],
      detail: "ok",
    };
  } catch (err) {
    return {
      addresses: [],
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Optional owner email from the Lead record (CRM user email often works as from).
 */
export async function fetchLeadOwnerEmail(
  client: ZohoClient,
  zohoLeadId: string,
): Promise<string | null> {
  const fetchImpl = client.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(
      `${apiBase(client)}/Leads/${encodeURIComponent(zohoLeadId)}?fields=Owner`,
      { headers: authHeaders(client) },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Array<{ Owner?: { email?: string } }>;
    };
    return json.data?.[0]?.Owner?.email?.trim() || null;
  } catch {
    return null;
  }
}

export async function resolveZohoFromEmail(
  client: ZohoClient,
  zohoLeadId?: string,
): Promise<{ email: string | null; detail: string }> {
  if (client.fromEmail?.trim()) {
    return { email: client.fromEmail.trim(), detail: "from client.fromEmail" };
  }
  const listed = await listZohoFromAddresses(client);
  const primary =
    listed.addresses.find((a) => a.type === "primary") ||
    listed.addresses.find((a) => a.type === "org_email") ||
    listed.addresses[0];
  if (primary?.email) {
    return {
      email: primary.email,
      detail: `from_addresses type=${primary.type ?? "unknown"}`,
    };
  }
  if (zohoLeadId) {
    const ownerEmail = await fetchLeadOwnerEmail(client, zohoLeadId);
    if (ownerEmail) {
      return {
        email: ownerEmail,
        detail: "from Lead Owner email (from_addresses empty/unavailable)",
      };
    }
  }
  return {
    email: null,
    detail: `No allowed from address (${listed.detail}). Configure Zoho CRM outgoing email / ZOHO_FROM_EMAIL, or ensure Lead Owner has a CRM email.`,
  };
}

/**
 * List email drafts on a Lead (for visibility + idempotency checks).
 */
export async function listZohoEmailDrafts(
  client: ZohoClient,
  zohoLeadId: string,
): Promise<{
  drafts: Array<{ id?: string; source?: string; subject?: string }>;
  detail: string;
}> {
  const fetchImpl = client.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(
      `${apiBase(client)}/Leads/${encodeURIComponent(zohoLeadId)}/__email_drafts?per_page=50&sort_order=desc`,
      { headers: authHeaders(client) },
    );
    if (res.status === 204) {
      return { drafts: [], detail: "no drafts" };
    }
    if (!res.ok) {
      const body = await res.text();
      return { drafts: [], detail: `list drafts ${res.status}: ${body.slice(0, 200)}` };
    }
    const json = (await res.json()) as {
      __email_drafts?: Array<{ id?: string; source?: string; subject?: string }>;
    };
    return {
      drafts: Array.isArray(json.__email_drafts) ? json.__email_drafts : [],
      detail: "ok",
    };
  } catch (err) {
    return {
      drafts: [],
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Create a native Zoho CRM email draft on a Lead. Never sends.
 * Idempotent via `source` = myntmore_task1_idem_<idempotencyKey>.
 */
export async function createNativeZohoEmailDraft(
  client: ZohoClient,
  input: ZohoCreateDraftInput & { zohoLeadId: string },
): Promise<{ result: ProcessedLead["zoho"]; errors: StageError[]; draftId: string | null }> {
  const fetchImpl = client.fetchImpl ?? fetch;
  const source = draftSourceKey(input.idempotencyKey);

  try {
    const existing = await listZohoEmailDrafts(client, input.zohoLeadId);
    const prior = existing.drafts.find((d) => d.source === source);
    if (prior?.id) {
      return {
        draftId: prior.id,
        result: {
          mode: "draft_only",
          wouldCreateDraft: true,
          status: "verified",
          detail: `Idempotent hit: existing Zoho email draft ${prior.id} verified (send_attempted=false)`,
        },
        errors: [],
      };
    }

    const from = await resolveZohoFromEmail(client, input.zohoLeadId);
    if (!from.email) {
      return {
        draftId: null,
        result: {
          mode: "draft_only",
          wouldCreateDraft: true,
          status: "failed",
          detail: from.detail,
        },
        errors: [
          {
            stage: "zoho",
            code: "ZOHO_FROM_ADDRESS_MISSING",
            message: from.detail,
            recoverable: true,
          },
        ],
      };
    }

    const res = await fetchImpl(
      `${apiBase(client)}/Leads/${encodeURIComponent(input.zohoLeadId)}/__email_drafts`,
      {
        method: "POST",
        headers: authHeaders(client, input.idempotencyKey),
        body: JSON.stringify({
          __email_drafts: [
            {
              from: from.email,
              // Zoho: rich_text=false → body must be plainTextContent (not content).
              // content is HTML-only when rich_text=true; using content here left drafts empty.
              rich_text: false,
              subject: input.subject,
              plainTextContent: input.body,
              to: [
                {
                  email: input.email,
                  user_name: input.fullName || null,
                },
              ],
              source,
            },
          ],
        }),
      },
    );

    const bodyText = await res.text();
    let parsed: {
      __email_drafts?: Array<{
        code?: string;
        status?: string;
        message?: string;
        details?: { id?: string };
      }>;
    } = {};
    try {
      parsed = JSON.parse(bodyText) as typeof parsed;
    } catch {
      /* keep empty */
    }

    const entry = parsed.__email_drafts?.[0];
    if (!res.ok || entry?.status === "error") {
      const message =
        entry?.message ||
        `Zoho email draft create failed (${res.status}): ${bodyText.slice(0, 300)}`;
      return {
        draftId: null,
        result: {
          mode: "draft_only",
          wouldCreateDraft: true,
          status: "failed",
          detail: message,
        },
        errors: [
          {
            stage: "zoho",
            code: "ZOHO_NATIVE_DRAFT_FAILED",
            message,
            recoverable: false,
          },
        ],
      };
    }

    const draftId = entry?.details?.id ?? null;

    // Visibility check — list drafts and confirm presence
    const after = await listZohoEmailDrafts(client, input.zohoLeadId);
    const visible =
      (draftId && after.drafts.some((d) => d.id === draftId)) ||
      after.drafts.some((d) => d.source === source);

    return {
      draftId,
      result: {
        mode: "draft_only",
        wouldCreateDraft: true,
        status: visible ? "verified" : "created",
        detail: visible
          ? `Native Zoho email draft ${draftId ?? "(id pending)"} verified and visible on Lead ${input.zohoLeadId} (send_attempted=false)`
          : `Zoho draft API succeeded (${draftId ?? "no id"}) but draft not yet listed on Lead — verify in CRM UI`,
      },
      errors: visible
        ? []
        : [
            {
              stage: "zoho",
              code: "ZOHO_DRAFT_VISIBILITY_UNCONFIRMED",
              message: "Create succeeded but list did not return the draft yet",
              recoverable: true,
            },
          ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      draftId: null,
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

function looksLikeZohoRecordId(id: string | undefined): boolean {
  return !!id && /^\d{10,}$/.test(id);
}

/**
 * Upsert/create CRM Lead by email, then attach native email draft.
 * Default mode is native_email_draft (composer draft). Notes path is fallback only.
 */
export async function createZohoDraft(
  client: ZohoClient,
  input: ZohoCreateDraftInput,
): Promise<{ result: ProcessedLead["zoho"]; errors: StageError[]; zohoLeadId: string | null; draftId: string | null }> {
  const fetchImpl = client.fetchImpl ?? fetch;
  const mode = input.mode ?? "native_email_draft";

  // Resolve or create Lead by email
  let zohoLeadId = looksLikeZohoRecordId(input.zohoLeadId)
    ? input.zohoLeadId!
    : "";
  if (!zohoLeadId) {
    const search = await fetchImpl(
      `${apiBase(client)}/Leads/search?email=${encodeURIComponent(input.email)}`,
      { headers: authHeaders(client) },
    );
    // Zoho returns 204 / empty body when no Lead matches — never call .json() blindly.
    if (search.ok) {
      const searchText = await search.text();
      if (searchText.trim()) {
        try {
          const found = JSON.parse(searchText) as { data?: Array<{ id: string }> };
          if (found.data?.[0]?.id) {
            zohoLeadId = found.data[0].id;
          }
        } catch {
          /* treat as no match; create below */
        }
      }
    }
    if (!zohoLeadId) {
      const nameParts = input.fullName.trim().split(/\s+/);
      const create = await fetchImpl(`${apiBase(client)}/Leads`, {
        method: "POST",
        headers: authHeaders(client, input.idempotencyKey),
        body: JSON.stringify({
          data: [
            {
              First_Name: nameParts[0] || "Lead",
              Last_Name: nameParts.slice(1).join(" ") || "Myntmore",
              Email: input.email,
              Company: input.company || undefined,
              Description: input.qualificationSummary || undefined,
              Lead_Source: "Myntmore Pipeline",
            },
          ],
          trigger: [],
        }),
      });
      const createdBody = await create.text();
      if (!create.ok) {
        return {
          zohoLeadId: null,
          draftId: null,
          result: {
            mode: "draft_only",
            wouldCreateDraft: true,
            status: "failed",
            detail: `Lead create failed (${create.status}): ${createdBody.slice(0, 200)}`,
          },
          errors: [
            {
              stage: "zoho",
              code: "ZOHO_LEAD_CREATE_FAILED",
              message: `Lead create ${create.status}`,
              recoverable: false,
            },
          ],
        };
      }
      const createdJson = JSON.parse(createdBody) as {
        data?: Array<{ details?: { id?: string } }>;
      };
      zohoLeadId = createdJson.data?.[0]?.details?.id || "";
    }
  }

  if (!zohoLeadId) {
    return {
      zohoLeadId: null,
      draftId: null,
      result: {
        mode: "draft_only",
        wouldCreateDraft: false,
        status: "failed",
        detail: "Could not resolve Zoho Lead id",
      },
      errors: [
        {
          stage: "zoho",
          code: "ZOHO_LEAD_ID_MISSING",
          message: "No Zoho Lead id",
          recoverable: false,
        },
      ],
    };
  }

  if (mode === "qualification_description" || mode === "note_placeholder") {
    // Legacy Notes path (not a native email draft) — audit/qualification only
    try {
      const res = await fetchImpl(`${apiBase(client)}/Notes`, {
        method: "POST",
        headers: authHeaders(client, input.idempotencyKey),
        body: JSON.stringify({
          data: [
            {
              Note_Title: `[DRAFT ONLY / QUAL] ${input.subject}`,
              Note_Content: `${input.body}\n\n[idempotency_key=${input.idempotencyKey}][mode=${mode}][send_attempted=false]`,
              Parent_Id: { id: zohoLeadId },
              $se_module: "Leads",
            },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        return {
          zohoLeadId,
          draftId: null,
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
        zohoLeadId,
        draftId: null,
        result: {
          mode: "draft_only",
          wouldCreateDraft: true,
          status: "created",
          detail: "Zoho Note with qualification text created (not Email Drafts composer)",
        },
        errors: [],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        zohoLeadId,
        draftId: null,
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

  const native = await createNativeZohoEmailDraft(client, {
    ...input,
    zohoLeadId,
    mode: "native_email_draft",
  });
  return {
    zohoLeadId,
    draftId: native.draftId,
    result: native.result,
    errors: native.errors,
  };
}
