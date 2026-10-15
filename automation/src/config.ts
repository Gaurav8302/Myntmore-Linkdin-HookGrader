import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export interface AppConfig {
  /** @deprecated Prefer nvidiaApiKey — Gemini abandoned after 404/quota failures */
  geminiApiKey: string | undefined;
  nvidiaApiKey: string | undefined;
  supabaseUrl: string | undefined;
  supabaseServiceRoleKey: string | undefined;
  supabasePublishableKey: string | undefined;
  zohoSendMode: "draft";
  pipelineMode: "dry_run" | "live";
  leadsCsvPath: string;
  founderMeetingUrl: string;
  /** @deprecated Prefer nvidiaModel */
  geminiModel: string;
  nvidiaModel: string;
  /**
   * Public tunnel origin for Make → local n8n (no trailing slash).
   * Local reference only — Make.com stores its own forward URL and must be
   * updated separately when the Quick Tunnel hostname changes.
   */
  n8nPublicBaseUrl: string | undefined;
  /** Webhook path appended to n8nPublicBaseUrl (leading slash required). */
  n8nWebhookPath: string;
  makeScenarioId: string | undefined;
}

function requireDraftOnly(value: string | undefined): "draft" {
  const mode = (value ?? "draft").trim().toLowerCase();
  if (mode !== "draft") {
    throw new Error(
      `ZOHO_SEND_MODE must be "draft" (got "${value}"). Automatic sends are forbidden.`,
    );
  }
  return "draft";
}

const DEFAULT_N8N_WEBHOOK_PATH = "/webhook/myntmore-hook-grader";

/** Join tunnel base + webhook path without duplicating slashes. */
export function buildN8nIngestUrl(
  baseUrl: string | undefined,
  webhookPath: string = DEFAULT_N8N_WEBHOOK_PATH,
): string | undefined {
  if (!baseUrl?.trim()) return undefined;
  const base = baseUrl.trim().replace(/\/+$/, "");
  const pathPart = webhookPath.startsWith("/")
    ? webhookPath
    : `/${webhookPath}`;
  return `${base}${pathPart}`;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const pipelineMode =
    env.PIPELINE_MODE === "live" ? "live" : "dry_run";

  const defaultCsv = path.resolve(here, "../../leads.csv");
  const n8nWebhookPath =
    env.N8N_WEBHOOK_PATH?.trim() || DEFAULT_N8N_WEBHOOK_PATH;

  return {
    geminiApiKey: env.GEMINI_API_KEY || undefined,
    nvidiaApiKey: env.NVIDIA_API_KEY || undefined,
    supabaseUrl: env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    supabasePublishableKey:
      env.SUPABASE_PUBLISHABLE_KEY ||
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      undefined,
    zohoSendMode: requireDraftOnly(env.ZOHO_SEND_MODE),
    pipelineMode,
    leadsCsvPath: env.LEADS_CSV_PATH
      ? path.resolve(process.cwd(), env.LEADS_CSV_PATH)
      : defaultCsv,
    founderMeetingUrl: "myntmore.com/founder-meeting",
    geminiModel: env.GEMINI_MODEL || "gemini-2.5-flash",
    // Live-tested 2026-10-14 against NVIDIA integrate.api.nvidia.com
    nvidiaModel:
      env.NVIDIA_MODEL || "meta/llama-3.2-11b-vision-instruct",
    n8nPublicBaseUrl: env.N8N_PUBLIC_BASE_URL?.trim() || undefined,
    n8nWebhookPath,
    makeScenarioId: env.MAKE_SCENARIO_ID?.trim() || undefined,
  };
}
