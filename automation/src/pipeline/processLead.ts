import { planZohoDraft, createZohoDraft, ZohoClient, buildZohoQualificationSummary } from "../adapters/zoho.js";
import {
  persistProcessedLead,
  persistDraftArtifact,
  SupabaseConfig,
} from "../adapters/supabase.js";
import { buildDraftArtifact } from "../email/artifact.js";
import { draftFollowUpEmail, DraftEmailOptions } from "../email/gemini.js";
import { qualifyLead } from "../qualify/index.js";
import { routeLead } from "../route/index.js";
import { scoreLead } from "../score/index.js";
import {
  CleanResult,
  ProcessedLead,
  QualificationResult,
  RawLead,
  StageError,
} from "../types.js";

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
    const qualification = await qualifyLead(clean);
    const score = clean.eligibleForScoring
      ? scoreLead(clean, qualification.primary)
      : null;
    const route = routeLead(clean, score);

    let emailDraft = null;
    let draftArtifact = null;
    if (route.draftEmailRequired && clean.eligibleForEmail && score) {
      const serviceForDraft =
        qualification.primary ?? score.service;
      const outcome = await draftFollowUpEmail(
        clean,
        serviceForDraft,
        route.tier,
        options.email,
      );
      emailDraft = outcome.draft;
      errors.push(...outcome.errors);

      if (emailDraft && !emailDraft.blocked && (route.tier === "hot" || route.tier === "warm")) {
        draftArtifact = buildDraftArtifact({
          leadId: raw.lead_id,
          idempotencyKey: clean.idempotencyKey,
          source: options.source ?? "csv",
          tier: route.tier,
          qualification,
          draft: emailDraft,
          recipient: clean.normalized.email || "unknown@invalid.local",
        });
      }
    }

    let zoho = planZohoDraft({
      leadId: raw.lead_id,
      email: clean.normalized.email,
      fullName: clean.normalized.fullName,
      company: clean.normalized.company,
      tier: route.tier,
      draft: emailDraft,
      sendMode: options.zohoSendMode,
      qualification,
      draftArtifactId: draftArtifact?.draft_id ?? null,
    });

    // Live Zoho: native email draft is primary; Supabase JSON artifact remains audit/fallback.
    if (options.zoho && options.supabase.mode === "live" && clean.normalized.email) {
      const summary = buildZohoQualificationSummary({
        qualification,
        score,
        route,
        draftArtifactId: draftArtifact?.draft_id ?? null,
      });

      const hasNativeDraft =
        zoho.wouldCreateDraft &&
        !!emailDraft &&
        !emailDraft.blocked;

      const created = await createZohoDraft(options.zoho, {
        leadId: raw.lead_id,
        email: clean.normalized.email,
        fullName: clean.normalized.fullName,
        company: clean.normalized.company,
        subject: hasNativeDraft
          ? emailDraft!.subject
          : `[QUAL] ${raw.lead_id} ${route.tier}`,
        body: hasNativeDraft ? emailDraft!.body : summary,
        idempotencyKey: clean.idempotencyKey,
        mode: hasNativeDraft ? "native_email_draft" : "qualification_description",
        qualificationSummary: summary,
      });
      zoho = {
        ...created.result,
        zohoLeadId: created.zohoLeadId,
        draftId: created.draftId,
        detail:
          created.zohoLeadId || created.draftId
            ? `${created.result.detail} [zoho_lead=${created.zohoLeadId ?? "none"}; draft_id=${created.draftId ?? "none"}]`
            : created.result.detail,
      };
      errors.push(...created.errors);
    }

    const lead: ProcessedLead = {
      leadId: raw.lead_id,
      idempotencyKey: clean.idempotencyKey,
      source: options.source ?? "csv",
      raw,
      clean,
      qualification,
      score,
      route,
      emailDraft,
      draftArtifact,
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

    if (draftArtifact && options.supabase.mode === "live") {
      const art = await persistDraftArtifact(draftArtifact, options.supabase);
      if (!art.ok) {
        lead.errors.push({
          stage: "persist",
          code: "DRAFT_ARTIFACT_PERSIST_FAILED",
          message: art.detail,
          recoverable: true,
        });
      }
    }

    return lead;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const emptyQual: QualificationResult = {
      primary: null,
      secondary: null,
      reason: `Pipeline failure — ${message}`,
      method: "rules_only",
      status: "excluded",
      exclusionReason: message,
      version: "service_rubric_v1",
      ruleHits: [],
    };
    return {
      leadId: raw.lead_id,
      idempotencyKey: clean.idempotencyKey,
      source: options.source ?? "csv",
      raw,
      clean,
      qualification: emptyQual,
      score: null,
      route: {
        tier: "not_a_fit",
        alertRequired: false,
        draftEmailRequired: false,
        reason: `Pipeline failure — ${message}`,
      },
      emailDraft: null,
      draftArtifact: null,
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
