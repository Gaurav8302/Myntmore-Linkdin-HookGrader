import { RawLead } from "../types.js";

/**
 * Make.com → n8n Hook Grader outbox payload (subset used for lead contract).
 * Hook quality score stays in tool_output — it is NOT the lead qualification score.
 */
export interface HookGraderMakePayload {
  session_id?: string | null;
  timestamp?: string | null;
  idempotency_key?: string | null;
  source?: string | null;
  contact?: {
    name?: string | null;
    designation?: string | null;
    email?: string | null;
  } | null;
  hook?: {
    original?: string | null;
    score?: number | null;
    failed_rules?: string[] | null;
    passed_rules?: string[] | null;
  } | null;
  rewrites?: Array<{ hook?: string | null; reason?: string | null }> | null;
  metadata?: Record<string, unknown> | null;
}

export interface HookGraderIngest {
  raw: RawLead;
  idempotencyKey: string;
  source: "hook_grader_via_make";
  /** Deterministic Hook Grader UI score (0–100); not used as lead score. */
  hookScore100: number | null;
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function buildToolOutput(payload: HookGraderMakePayload): string {
  const hook = payload.hook || {};
  const score100 = Number(hook.score);
  const failed = Array.isArray(hook.failed_rules) ? hook.failed_rules.filter(Boolean) : [];
  const passed = Array.isArray(hook.passed_rules) ? hook.passed_rules.filter(Boolean) : [];
  const rewrites = Array.isArray(payload.rewrites) ? payload.rewrites : [];

  const lines: string[] = [];
  if (Number.isFinite(score100)) {
    lines.push(`Hook Grader score ${score100}/100`);
  } else {
    lines.push("Hook Grader score unavailable");
  }
  lines.push(
    failed.length > 0
      ? `Failed rules: ${failed.join("; ")}`
      : "Failed rules: none",
  );
  if (passed.length > 0) {
    lines.push(`Passed rules: ${passed.slice(0, 8).join("; ")}`);
  }
  for (let i = 0; i < Math.min(3, rewrites.length); i += 1) {
    const text = String(rewrites[i]?.hook || "").trim();
    if (text) lines.push(`Rewrite ${i + 1}: ${text}`);
  }
  return lines.join("\n");
}

/**
 * Map a Hook Grader Make payload into the same RawLead contract as leads.csv rows.
 * Does not invent company/website/linkedin. Does not map hook score → lead score.
 */
export function hookGraderPayloadToRawLead(
  payload: HookGraderMakePayload,
): HookGraderIngest {
  const contact = payload.contact || {};
  const hook = payload.hook || {};
  const name = String(contact.name || "").trim();
  const { first, last } = splitName(name);
  const sessionId = String(payload.session_id || "").trim();
  const idemFromPayload = String(payload.idempotency_key || "").trim();
  const idempotencyKey =
    idemFromPayload ||
    (sessionId ? `hook_grader_${sessionId}` : "");

  if (!idempotencyKey) {
    throw new Error("Hook Grader payload missing idempotency_key and session_id");
  }

  const email = String(contact.email || "").trim();
  const originalHook = String(hook.original || "").trim();
  const designation =
    contact.designation == null || contact.designation === ""
      ? ""
      : String(contact.designation).trim();

  const score100 = Number(hook.score);
  const raw: RawLead = {
    lead_id: sessionId || idempotencyKey.replace(/^hook_grader_/, ""),
    created_at: String(payload.timestamp || new Date().toISOString()),
    source_tool: "linkedin_hook_grader",
    first_name: first,
    last_name: last,
    designation,
    email,
    company: "",
    company_website: "",
    linkedin_url: "",
    tool_input: originalHook,
    tool_output: buildToolOutput(payload),
  };

  return {
    raw,
    idempotencyKey,
    source: "hook_grader_via_make",
    hookScore100: Number.isFinite(score100) ? score100 : null,
  };
}
