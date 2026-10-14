import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "./config.js";
import { loadLocalEnv } from "./env.js";
import { runCsvPipeline, summarizeForCli } from "./pipeline/runCsv.js";

async function main(): Promise<void> {
  loadLocalEnv();
  const command = process.argv[2] ?? "process-csv";
  if (command !== "process-csv") {
    console.error(`Unknown command: ${command}`);
    process.exitCode = 1;
    return;
  }

  const config = loadConfig();
  console.log(`Processing CSV: ${config.leadsCsvPath}`);
  console.log(`Mode: ${config.pipelineMode} | Zoho: ${config.zohoSendMode}-only`);
  console.log(
    `NVIDIA key: ${config.nvidiaApiKey || config.geminiApiKey ? "present" : "missing (template fallback)"}`,
  );

  const summary = await runCsvPipeline(config);
  console.log(summarizeForCli(summary));

  const outDir = path.resolve(process.cwd(), "output");
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "pipeline-result.json");
  await writeFile(outFile, JSON.stringify(summary, null, 2), "utf8");
  console.log(`\nWrote ${outFile}`);

  const drafts = summary.leads
    .map((l) => l.draftArtifact)
    .filter((a): a is NonNullable<typeof a> => a !== null);
  const draftsFile = path.join(outDir, "email_drafts.json");
  await writeFile(
    draftsFile,
    JSON.stringify(
      {
        note: "Email drafts are generated and persisted as JSON artifacts. They are not sent, and Zoho's email composer draft API remains permission-blocked.",
        send_attempted: false,
        count: drafts.length,
        drafts,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`Wrote ${draftsFile} (${drafts.length} draft artifacts)`);

  if (summary.totalRows !== summary.accountedRows) {
    console.error("ERROR: Not every row was accounted for.");
    process.exitCode = 1;
  }
  const c = summary.counts;
  if (c.completed + c.excluded + c.failed !== c.processed) {
    console.error("ERROR: Primary disposition counts do not sum to processed.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
