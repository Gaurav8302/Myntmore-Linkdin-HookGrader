import { classifyBatch } from "../clean/classify.js";
import { AppConfig } from "../config.js";
import { importLeadsCsv } from "../import/csv.js";
import {
  summarizeCounts,
  toRowObservation,
} from "../observability.js";
import { PipelineSummary, ProcessedLead, RoutingTier } from "../types.js";
import { processLead } from "./processLead.js";

export async function runCsvPipeline(config: AppConfig): Promise<PipelineSummary> {
  const { rows, parseWarnings } = await importLeadsCsv(config.leadsCsvPath);
  const cleans = classifyBatch(rows);

  const leads: ProcessedLead[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const processed = await processLead(rows[i], cleans[i], {
      email: {
        apiKey: config.nvidiaApiKey || config.geminiApiKey,
        model: config.nvidiaModel || config.geminiModel,
        founderMeetingUrl: config.founderMeetingUrl,
        timeoutMs: 20000,
      },
      supabase: {
        url: config.supabaseUrl,
        serviceRoleKey: config.supabaseServiceRoleKey,
        publishableKey: config.supabasePublishableKey,
        mode: config.pipelineMode,
      },
      zohoSendMode: config.zohoSendMode,
      source: "csv",
    });
    leads.push(processed);
  }

  const byTier: Record<RoutingTier, number> = { hot: 0, warm: 0, not_a_fit: 0 };
  const byFlag: Record<string, number> = {};

  for (const lead of leads) {
    byTier[lead.route.tier] += 1;
    for (const flag of lead.clean.flags) {
      byFlag[flag] = (byFlag[flag] ?? 0) + 1;
    }
  }

  for (const warning of parseWarnings) {
    byFlag[`parse_warning:${warning}`] = 1;
  }

  const counts = summarizeCounts(leads);
  const observations = leads.map((lead) => {
    const obs = toRowObservation(lead);
    return {
      sourceId: obs.sourceId,
      idempotencyKey: obs.idempotencyKey,
      disposition: obs.disposition,
      service: obs.service,
      score: obs.score,
      scoreReason: obs.scoreReason,
      routingTier: obs.routingTier,
      cleaningFlags: obs.cleaningFlags,
      draftStatus: obs.draftStatus,
      errors: obs.errors,
    };
  });

  return {
    totalRows: rows.length,
    accountedRows: leads.length,
    byTier,
    byFlag,
    counts,
    observations,
    leads,
  };
}

export function summarizeForCli(summary: PipelineSummary): string {
  const c = summary.counts;
  const lines = [
    `Rows imported: ${c.imported}`,
    `Rows processed (accounted): ${c.processed}`,
    `Primary: completed=${c.completed} excluded=${c.excluded} failed=${c.failed} (sum=${c.completed + c.excluded + c.failed})`,
    `Overlays: duplicate=${c.duplicate} drafted=${c.drafted} fallbackDrafts=${c.fallbackDrafts}`,
    `Tiers: Hot=${summary.byTier.hot} Warm=${summary.byTier.warm} Not a fit=${summary.byTier.not_a_fit}`,
    "",
    "Per-lead:",
  ];

  for (const lead of summary.leads) {
    const obs = toRowObservation(lead);
    lines.push(
      [
        lead.leadId,
        obs.disposition,
        lead.route.tier,
        `score=${lead.score?.score ?? "-"}`,
        `service=${lead.score?.service ?? "-"}`,
        `flags=${lead.clean.flags.join("+")}`,
        `draft=${obs.draftStatus}`,
        `zoho=${lead.zoho.status}`,
        `errors=${lead.errors.length}`,
      ].join(" | "),
    );
  }

  return lines.join("\n");
}
