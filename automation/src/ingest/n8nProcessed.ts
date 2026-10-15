import { ProcessedLead, RawLead } from "../types.js";

export interface N8nProcessedIngest {
  raw: RawLead;
  idempotencyKey: string;
  source: ProcessedLead["source"];
  hookScore100: number | null;
}

/**
 * Shape emitted by n8n Normalize Make Payload / Import Clean Score Route Draft.
 * Used by the local bridge so CSV dry-runs can create Zoho Leads + drafts.
 */
export interface N8nProcessedLeadPayload {
  lead_id?: string | null;
  external_session_id?: string | null;
  idempotency_key?: string | null;
  source?: string | null;
  source_tool?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  designation?: string | null;
  email?: string | null;
  company?: string | null;
  company_website?: string | null;
  linkedin_url?: string | null;
  tool_input?: string | null;
  tool_output?: string | null;
  submitted_at?: string | null;
  /** Present on CSV Import / Combine items when top-level email was omitted. */
  draft_artifact?: { recipient?: string | null } | null;
}

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

export function isN8nProcessedLeadPayload(
  payload: unknown,
): payload is N8nProcessedLeadPayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  // Make Hook Grader webhook shape has contact/hook — not this path.
  if (p.contact || p.hook) return false;
  return Boolean(
    str(p.idempotency_key) ||
      str(p.lead_id) ||
      str(p.external_session_id) ||
      str(p.email),
  );
}

/**
 * Map n8n processed-lead JSON into the shared RawLead + idempotency contract.
 */
export function n8nProcessedLeadToIngest(
  payload: N8nProcessedLeadPayload,
): N8nProcessedIngest {
  const idempotencyKey = str(payload.idempotency_key);
  const leadId =
    str(payload.lead_id) ||
    str(payload.external_session_id) ||
    (idempotencyKey ? idempotencyKey.replace(/^csv_/, "").replace(/^hook_grader_/, "") : "");

  if (!idempotencyKey) {
    throw new Error("n8n processed lead missing idempotency_key");
  }

  const email =
    str(payload.email) ||
    str(payload.draft_artifact?.recipient);
  if (!email) {
    throw new Error("n8n processed lead missing email");
  }

  const sourceRaw = str(payload.source) || "csv";
  const source: ProcessedLead["source"] =
    sourceRaw === "hook_grader_via_make" ? "hook_grader_via_make" : "csv";

  let first = str(payload.first_name);
  let last = str(payload.last_name);
  if (!first && !last && str(payload.full_name)) {
    const parts = str(payload.full_name).split(/\s+/).filter(Boolean);
    first = parts[0] || "";
    last = parts.slice(1).join(" ");
  }

  const raw: RawLead = {
    lead_id: leadId || idempotencyKey,
    created_at: str(payload.submitted_at) || new Date().toISOString(),
    source_tool: str(payload.source_tool) || "unknown",
    first_name: first,
    last_name: last,
    designation: str(payload.designation),
    email,
    company: str(payload.company),
    company_website: str(payload.company_website),
    linkedin_url: str(payload.linkedin_url),
    tool_input: str(payload.tool_input),
    tool_output: str(payload.tool_output),
  };

  return {
    raw,
    idempotencyKey,
    source,
    hookScore100: null,
  };
}
