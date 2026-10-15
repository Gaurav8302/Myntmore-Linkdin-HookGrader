/**
 * Local HTTP bridge so n8n (without Execute Command) can invoke processIncomingLead.
 * Listens on 127.0.0.1 only. Never logs secrets.
 *
 *   npm run process:incoming:server
 *   POST http://127.0.0.1:8791/process-incoming
 */
import http from "node:http";
import { resolveZohoClient } from "./adapters/resolveZohoClient.js";
import { loadConfig } from "./config.js";
import { loadLocalEnv } from "./env.js";
import {
  hookGraderPayloadToRawLead,
  type HookGraderMakePayload,
} from "./ingest/hookGrader.js";
import { processIncomingLead } from "./pipeline/processIncomingLead.js";

const HOST = "127.0.0.1";
const PORT = Number(process.env.INCOMING_HTTP_PORT || 8791);

async function handleProcessIncoming(
  payload: HookGraderMakePayload,
): Promise<{ status: number; body: Record<string, unknown> }> {
  loadLocalEnv();
  const config = loadConfig();
  const ingest = hookGraderPayloadToRawLead(payload);

  let zoho;
  try {
    zoho = await resolveZohoClient(config);
  } catch (err) {
    return {
      status: 503,
      body: {
        ok: false,
        stage: "zoho_auth",
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }

  if (config.pipelineMode === "live" && !zoho) {
    return {
      status: 503,
      body: {
        ok: false,
        stage: "zoho_auth",
        error: "Zoho OAuth not configured for live pipeline",
      },
    };
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

  const needsDraft = lead.zoho.wouldCreateDraft;
  const draftOk =
    lead.zoho.status === "verified" ||
    (lead.zoho.status === "created" && !!lead.zoho.draftId);
  const ok =
    lead.persistence.status !== "failed" &&
    (!needsDraft || draftOk || lead.zoho.status === "skipped");

  return {
    status: ok ? 200 : 422,
    body: {
      ok,
      idempotency_key: lead.idempotencyKey,
      routing_tier: lead.route.tier,
      persistence: lead.persistence.status,
      zoho_status: lead.zoho.status,
      zoho_lead_id: lead.zoho.zohoLeadId ?? null,
      draft_id: lead.zoho.draftId ?? null,
      draft_id_present: !!lead.zoho.draftId,
      send_attempted: false,
      error_codes: lead.errors.map((e) => e.code),
    },
  };
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.method === "POST" && req.url === "/process-incoming") {
      const raw = await readBody(req);
      const payload = JSON.parse(raw) as HookGraderMakePayload;
      const result = await handleProcessIncoming(payload);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
});

server.listen(PORT, HOST, () => {
  console.log(`processIncomingLead bridge listening on http://${HOST}:${PORT}`);
});
