import { planZohoDraft, createZohoDraft, ZohoClient } from "../adapters/zoho.js";
import { persistProcessedLead, SupabaseConfig } from "../adapters/supabase.js";
import { draftFollowUpEmail, DraftEmailOptions } from "../email/gemini.js";
import { routeLead } from "../route/index.js";
import { scoreLead } from "../score/index.js";
import { CleanResult, ProcessedLead, RawLead, StageError } from "../types.js";

export interface ProcessOptions {
  email: DraftEmailOptions;
  supabase: SupabaseConfig;
  zohoSendMode: "draft";
  zoho?: ZohoClient;
  source?: ProcessedLead["source"];
}

export async function processLead(
  raw: RawLead,
  clean: CleanResult,
  options: ProcessOptions,
): Promise<ProcessedLead> {
  const errors: StageError[] = [];

  try {
    const score = clean.eligibleForScoring ? scoreLead(clean) : null;
    const route = routeLead(clean, score);

    let emailDraft = null;
    if (route.draftEmailRequired && clean.eligibleForEmail && score) {
      const outcome = await draftFollowUpEmail(
        clean,
        score.service,
        route.tier,
        options.email,
      );
      emailDraft = outcome.draft;
      errors.push(...outcome.errors);
    }

    let zoho = planZohoDraft({
      leadId: raw.lead_id,
      email: clean.normalized.email,
      fullName: clean.normalized.fullName,
      company: clean.normalized.company,
      tier: route.tier,
      draft: emailDraft,
      sendMode: options.zohoSendMode,
    });

    if (options.zoho && zoho.wouldCreateDraft && options.supabase.mode === "live") {
      const created = await createZohoDraft(options.zoho, {
        leadId: raw.lead_id,
        email: clean.normalized.email!,
        fullName: clean.normalized.fullName,
        company: clean.normalized.company,
        subject: emailDraft!.subject,
        body: emailDraft!.body,
        idempotencyKey: clean.idempotencyKey,
      });
      zoho = created.result;
      errors.push(...created.errors);
    }

    const lead: ProcessedLead = {
      leadId: raw.lead_id,
      idempotencyKey: clean.idempotencyKey,
      source: options.source ?? "csv",
      raw,
      clean,
      score,
      route,
      emailDraft,
      zoho,
      persistence: { status: "pending", detail: "Not yet persisted" },
      errors,
    };

    lead.persistence = await persistProcessedLead(lead, options.supabase);
    if (lead.persistence.status === "failed") {
      lead.errors.push({
        stage: "persist",
        code: "SUPABASE_UPSERT_FAILED",
        message: lead.persistence.detail,
        recoverable: false,
      });
    }

    return lead;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      leadId: raw.lead_id,
      idempotencyKey: clean.idempotencyKey,
      source: options.source ?? "csv",
      raw,
      clean,
      score: null,
      route: {
        tier: "not_a_fit",
        alertRequired: false,
        draftEmailRequired: false,
        reason: `Pipeline failure — ${message}`,
      },
      emailDraft: null,
      zoho: {
        mode: "draft_only",
        wouldCreateDraft: false,
        status: "blocked",
        detail: "Skipped due to pipeline failure",
      },
      persistence: { status: "failed", detail: message },
      errors: [
        {
          stage: "pipeline",
          code: "PIPELINE_EXCEPTION",
          message,
          recoverable: false,
        },
      ],
    };
  }
}
