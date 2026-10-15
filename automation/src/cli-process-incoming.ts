/**
 * Shared pipeline entry for Hook Grader Make → n8n payloads.
 * Uses processIncomingLead() + Zoho refresh-token auth. Never prints secrets.
 *
 * Usage:
 *   tsx src/cli-process-incoming.ts --payload-file /path/to.json
 *   cat payload.json | tsx src/cli-process-incoming.ts --stdin
 */
import { readFileSync } from "node:fs";
import { resolveZohoClient } from "./adapters/resolveZohoClient.js";
import { loadConfig } from "./config.js";
import { loadLocalEnv } from "./env.js";
import {
  hookGraderPayloadToRawLead,
  type HookGraderMakePayload,
} from "./ingest/hookGrader.js";
import { processIncomingLead } from "./pipeline/processIncomingLead.js";

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

function readPayload(): HookGraderMakePayload {
  if (process.argv.includes("--stdin")) {
    const text = readFileSync(0, "utf8");
    return JSON.parse(text) as HookGraderMakePayload;
  }
  const file = argValue("--payload-file");
  if (!file) {
    throw new Error("Provide --payload-file <path> or --stdin");
  }
  return JSON.parse(readFileSync(file, "utf8")) as HookGraderMakePayload;
}

async function main(): Promise<void> {
  loadLocalEnv();
  const config = loadConfig();
  const payload = readPayload();
  const ingest = hookGraderPayloadToRawLead(payload);

  let zoho;
  try {
    zoho = await resolveZohoClient(config);
  } catch (err) {
    console.error(
      JSON.stringify({
        ok: false,
        stage: "zoho_auth",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    process.exitCode = 1;
    return;
  }

  if (config.pipelineMode === "live" && !zoho) {
    console.error(
      JSON.stringify({
        ok: false,
        stage: "zoho_auth",
        error:
          "PIPELINE_MODE=live but Zoho OAuth is not configured (need refresh token credentials)",
      }),
    );
    process.exitCode = 1;
    return;
  }

  const lead = await processIncomingLead(ingest.raw, {
    idempotencyKey: ingest.idempotencyKey,
    source: ingest.source,
    zohoSendMode: config.zohoSendMode,
    zoho,
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
  });

  const draftOk =
    lead.zoho.status === "verified" ||
    (lead.zoho.status === "created" && !!lead.zoho.draftId);
  const needsDraft = lead.zoho.wouldCreateDraft;

  console.log(
    JSON.stringify({
      ok: !needsDraft || draftOk || lead.zoho.status === "skipped",
      idempotency_key: lead.idempotencyKey,
      routing_tier: lead.route.tier,
      persistence: lead.persistence.status,
      zoho_status: lead.zoho.status,
      zoho_lead_id: lead.zoho.zohoLeadId ?? null,
      draft_id_present: !!lead.zoho.draftId,
      send_attempted: false,
      error_codes: lead.errors.map((e) => e.code),
    }),
  );

  if (needsDraft && !draftOk) {
    process.exitCode = 1;
  }
  if (lead.persistence.status === "failed") {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exitCode = 1;
});
