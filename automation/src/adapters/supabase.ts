import { ProcessedLead } from "../types.js";

/**
 * Persistence adapter. Live Supabase upserts require credentials and an approved migration.
 * Until then, dry-run records the intended upsert keyed by idempotency_key.
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
        "Dry-run persistence: would upsert into leads on idempotency_key. Supabase credentials/migration UNVERIFIED.",
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

/** Shape aligned with automation/docs/SCHEMA_PROPOSAL.md (not applied to shared migrations yet). */
export function toLeadRow(lead: ProcessedLead): Record<string, unknown> {
  return {
    idempotency_key: lead.idempotencyKey,
    external_session_id: lead.leadId,
    source: lead.source,
    source_tool: lead.raw.source_tool,
    disposition: lead.disposition,
    first_name: lead.clean.normalized.firstName,
    last_name: lead.clean.normalized.lastName,
    full_name: lead.clean.normalized.fullName,
    designation: lead.clean.normalized.designation,
    email: lead.clean.normalized.email,
    company: lead.clean.normalized.company,
    company_website: lead.clean.normalized.companyWebsite,
    linkedin_url: lead.clean.normalized.linkedinUrl,
    tool_input: lead.clean.normalized.toolInput,
    tool_output: lead.clean.normalized.toolOutput,
    clean_flags: lead.clean.flags,
    clean_reasons: lead.clean.reasons,
    score: lead.score?.score ?? null,
    service: lead.score?.service ?? null,
    score_reason: lead.score?.scoreReason ?? null,
    score_breakdown: lead.score?.ruleBreakdown ?? null,
    routing_tier: lead.route.tier,
    routing_reason: lead.route.reason,
    alert_required: lead.route.alertRequired,
    email_subject: lead.emailDraft?.subject ?? null,
    email_draft: lead.emailDraft?.body ?? null,
    email_draft_source: lead.emailDraft?.source ?? null,
    email_word_count: lead.emailDraft?.wordCount ?? null,
    zoho_draft_status: lead.zoho.status,
    metadata: {
      created_at_source: lead.raw.created_at,
      persistence: lead.persistence,
      zoho: lead.zoho,
      errors: lead.errors,
      is_fallback_draft: lead.emailDraft?.isFallback ?? false,
      fallback_reason: lead.emailDraft?.fallbackReason ?? null,
    },
  };
}
