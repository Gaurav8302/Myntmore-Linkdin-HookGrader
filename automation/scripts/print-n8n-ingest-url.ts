/**
 * Print the Make → n8n public ingest URL from local env.
 * Does not call Make.com — update scenario 7960198 manually when the tunnel changes.
 */
import { loadLocalEnv } from "../src/env.js";
import { buildN8nIngestUrl, loadConfig } from "../src/config.js";

loadLocalEnv();
const config = loadConfig();
const url = buildN8nIngestUrl(config.n8nPublicBaseUrl, config.n8nWebhookPath);

if (!url) {
  console.error(
    "N8N_PUBLIC_BASE_URL is not set in automation/.env.local\n" +
      "Example: N8N_PUBLIC_BASE_URL=https://<host>.trycloudflare.com",
  );
  process.exit(1);
}

console.log(url);
console.log(
  `\nLocal reference only. Make scenario ${config.makeScenarioId ?? "7960198"} ` +
    `module "Forward to n8n Task1 ingest" must use this exact URL.`,
);
