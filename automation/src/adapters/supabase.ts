import { dispositionFrom } from "../observability.js";
import { SERVICE_DISPLAY } from "../qualify/catalog.js";
import { EmailDraftArtifact, ProcessedLead } from "../types.js";

/**
 * Persistence adapter. Live Supabase upserts require credentials.
 */
export interface PersistResult {
  status: ProcessedLead["persistence"]["status"];
  detail: string;
}

export interface SupabaseConfig {
  url?: string;
  /** Prefer service role; publishable/anon allowed only when table grants permit upsert. */
  serviceRoleKey?: string;
  publishableKey?: string;
  mode: "dry_run" | "live";
  fetchImpl?: typeof fetch;
}

export async function persistProcessedLead(
  lead: ProcessedLead,
  config: SupabaseConfig,
): Promise<PersistResult> {
  const apiKey = config.serviceRoleKey || config.publishableKey;
  if (config.mode !== "live" || !config.url || !apiKey) {
    return {
      status: "dry_run",
      detail:
        "Dry-run persistence: would upsert into leads on idempotency_key. Draft JSON artifacts would upsert into email_draft_artifacts.",
    };
  }

  const fetchImpl = config.fetchImpl ?? fetch;

  try {
    const row = toLeadRow(lead);
    const res = await fetchImpl(
      `${config.url}/rest/v1/leads?on_conflict=idempotency_key`,
      {
        method: "POST",
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(row),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      return {
        status: "failed",
        detail: `Supabase upsert failed (${res.status}): ${body.slice(0, 300)}`,
      };
    }

    return { status: "upserted", detail: "Upserted on idempotency_key" };
  } catch (err) {
    return {
      status: "failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function persistDraftArtifact(
  artifact: EmailDraftArtifact,
  config: SupabaseConfig,
): Promise<{ ok: boolean; detail: string }> {
  const apiKey = config.serviceRoleKey || config.publishableKey;
  if (config.mode !== "live" || !config.url || !apiKey) {
    return { ok: true, detail: "dry_run_skip" };
  }
  const fetchImpl = config.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(
      `${config.url}/rest/v1/email_draft_artifacts?on_conflict=draft_id`,
      {
        method: "POST",
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          draft_id: artifact.draft_id,
          lead_id: artifact.lead_id,
          idempotency_key: `${artifact.lead_id}|${artifact.lead_temperature}`,
          artifact,
          status: artifact.status,
          send_attempted: false,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, detail: `artifact upsert ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true, detail: "upserted" };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Shape aligned with Task 1 leads schema + qualification metadata.
 * Optional contact fields that are null are omitted so retries never wipe
 * previously populated company/website/linkedin values with null.
 */
export function toLeadRow(lead: ProcessedLead): Record<string, unknown> {
  const row: Record<string, unknown> = {
    idempotency_key: lead.idempotencyKey,
    external_session_id: lead.leadId,
    source: lead.source,
    source_tool: lead.raw.source_tool,
    disposition: dispositionFrom(lead),
    first_name: lead.clean.normalized.firstName,
    last_name: lead.clean.normalized.lastName,
    full_name: lead.clean.normalized.fullName,
    designation: lead.clean.normalized.designation || null,
    email: lead.clean.normalized.email,
    tool_input: lead.clean.normalized.toolInput,
    tool_output: lead.clean.normalized.toolOutput,
    clean_flags: lead.clean.flags,
    clean_reasons: lead.clean.reasons,
    score: lead.score?.score ?? null,
    service: lead.qualification.primary ?? lead.score?.service ?? null,
    score_reason: lead.score?.scoreReason ?? null,
    score_breakdown: lead.score?.ruleBreakdown ?? null,
    routing_tier: lead.route.tier,
    routing_reason: lead.route.reason,
    alert_required: lead.route.alertRequired,
    email_subject: lead.emailDraft?.subject ?? null,
    email_draft: lead.emailDraft?.body ?? null,
    email_draft_source:
      lead.emailDraft?.source === "nvidia"
        ? "nvidia"
        : lead.emailDraft?.source ?? null,
    email_word_count: lead.emailDraft?.wordCount ?? null,
    zoho_draft_status: lead.zoho.status,
    errors: lead.errors,
    metadata: {
      created_at_source: lead.raw.created_at,
      persistence: lead.persistence,
      zoho: lead.zoho,
      errors: lead.errors,
      is_fallback_draft: lead.emailDraft?.isFallback ?? false,
      fallback_reason: lead.emailDraft?.fallbackReason ?? null,
      service_fit_primary: lead.qualification.primary
        ? SERVICE_DISPLAY[lead.qualification.primary]
        : null,
      service_fit_secondary: lead.qualification.secondary
        ? SERVICE_DISPLAY[lead.qualification.secondary]
        : null,
      service_fit_reason: lead.qualification.reason,
      lead_score: lead.score?.score ?? null,
      lead_score_reason: lead.score?.scoreReason ?? null,
      lead_temperature: lead.route.tier,
      qualification_method: lead.qualification.method,
      qualification_status: lead.qualification.status,
      exclusion_reason: lead.qualification.exclusionReason,
      qualification_version: lead.qualification.version,
      draft_artifact_id: lead.draftArtifact?.draft_id ?? null,
      draft_artifact: lead.draftArtifact,
      zoho_draft_id: lead.zoho.draftId ?? null,
      send_attempted: false,
    },
  };

  if (lead.zoho.zohoLeadId) {
    row.zoho_lead_id = lead.zoho.zohoLeadId;
  }

  // Only write optional contact fields when present (preserve prior non-null on merge).
  if (lead.clean.normalized.company) row.company = lead.clean.normalized.company;
  if (lead.clean.normalized.companyWebsite) {
    row.company_website = lead.clean.normalized.companyWebsite;
  }
  if (lead.clean.normalized.linkedinUrl) {
    row.linkedin_url = lead.clean.normalized.linkedinUrl;
  }

  return row;
}
