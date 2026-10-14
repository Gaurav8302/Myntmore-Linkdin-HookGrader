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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const pipelineMode =
    env.PIPELINE_MODE === "live" ? "live" : "dry_run";

  const defaultCsv = path.resolve(here, "../../leads.csv");

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
  };
}
