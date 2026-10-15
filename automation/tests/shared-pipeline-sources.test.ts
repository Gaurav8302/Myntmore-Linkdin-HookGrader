import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createDuplicateIndex } from "../src/clean/classify.js";
import { loadConfig } from "../src/config.js";
import { hookGraderPayloadToRawLead } from "../src/ingest/hookGrader.js";
import { importLeadsCsv } from "../src/import/csv.js";
import { processIncomingLead } from "../src/pipeline/processIncomingLead.js";

const rootCsv = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../leads.csv",
);

const STAGES = [
  "clean",
  "qualification",
  "score",
  "route",
  "emailDraft",
  "draftArtifact",
  "zoho",
  "persistence",
] as const;

function dryConfig() {
  return loadConfig({
    LEADS_CSV_PATH: rootCsv,
    PIPELINE_MODE: "dry_run",
    ZOHO_SEND_MODE: "draft",
  });
}

function dryProcessOptions(
  config: ReturnType<typeof dryConfig>,
  source: "csv" | "hook_grader_via_make",
  extra: {
    idempotencyKey?: string;
    duplicates?: ReturnType<typeof createDuplicateIndex>;
  } = {},
) {
  return {
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
      mode: config.pipelineMode as "dry_run" | "live",
    },
    zohoSendMode: "draft" as const,
    source,
    ...extra,
  };
}

/** Clearly labelled Hook Grader test lead — not a CSV row. */
function hookGraderTestPayload(overrides: Record<string, unknown> = {}) {
  const sessionId =
    typeof overrides.session_id === "string"
      ? overrides.session_id
      : "hg-shared-pipeline-test-001";
  return {
    session_id: sessionId,
    timestamp: "2026-10-15T04:00:00.000Z",
    idempotency_key: `hook_grader_${sessionId}`,
    source: "hook_grader",
    contact: {
      name: "Hook Grader Test Lead",
      designation: "Founder",
      email: "hook.grader.test@example.com",
      ...(typeof overrides.contact === "object" && overrides.contact
        ? (overrides.contact as object)
        : {}),
    },
    hook: {
      original:
        "Most LinkedIn hooks fail because they bury the ICP outcome. Here is a sharper opener for founder-led personal branding.",
      score: 62,
      failed_rules: ["specificity"],
      passed_rules: ["length", "curiosity", "action"],
      ...(typeof overrides.hook === "object" && overrides.hook
        ? (overrides.hook as object)
        : {}),
    },
    rewrites: [
      {
        hook: "CFOs ignore vague founder posts. Lead with the cost of slow LinkedIn outreach.",
        reason: "Adds ICP and outcome",
      },
    ],
    ...overrides,
  };
}

describe("shared pipeline entry — CSV vs Hook Grader", () => {
  it("maps Hook Grader payload into RawLead without inventing contact fields", () => {
    const ingest = hookGraderPayloadToRawLead(hookGraderTestPayload());
    expect(ingest.source).toBe("hook_grader_via_make");
    expect(ingest.raw.source_tool).toBe("linkedin_hook_grader");
    expect(ingest.raw.company).toBe("");
    expect(ingest.raw.company_website).toBe("");
    expect(ingest.raw.linkedin_url).toBe("");
    expect(ingest.raw.tool_input).toContain("LinkedIn hooks");
    expect(ingest.raw.tool_output).toContain("Hook Grader score 62/100");
    expect(ingest.raw.tool_output).toContain("Failed rules: specificity");
    expect(ingest.hookScore100).toBe(62);
    expect(ingest.idempotencyKey).toBe(
      "hook_grader_hg-shared-pipeline-test-001",
    );
  });

  it("runs representative CSV leads and a Hook Grader lead through processIncomingLead", async () => {
    const config = dryConfig();
    const { rows } = await importLeadsCsv(rootCsv);
    const sampleIds = ["L01", "L03", "L07", "L11", "L18"];
    const csvSamples = rows.filter((r) => sampleIds.includes(r.lead_id));
    expect(csvSamples).toHaveLength(5);

    const duplicates = createDuplicateIndex();
    const csvProcessed = [];
    for (const raw of csvSamples) {
      csvProcessed.push(
        await processIncomingLead(
          raw,
          dryProcessOptions(config, "csv", { duplicates }),
        ),
      );
    }

    const ingest = hookGraderPayloadToRawLead(hookGraderTestPayload());
    const hg = await processIncomingLead(
      ingest.raw,
      dryProcessOptions(config, ingest.source, {
        idempotencyKey: ingest.idempotencyKey,
        duplicates: createDuplicateIndex(),
      }),
    );

    for (const lead of [...csvProcessed, hg]) {
      for (const stage of STAGES) {
        expect(lead).toHaveProperty(stage);
      }
      expect(lead.clean.reasons.length).toBeGreaterThan(0);
      expect(lead.qualification.version).toBeTruthy();
      expect(lead.route.tier).toMatch(/hot|warm|not_a_fit/);
      expect(lead.zoho.mode).toBe("draft_only");
      expect(lead.errors.every((e) => e.message !== undefined)).toBe(true);
    }

    // Hook Grader is fully processed — not a bare insert
    expect(hg.source).toBe("hook_grader_via_make");
    expect(hg.idempotencyKey).toBe("hook_grader_hg-shared-pipeline-test-001");
    expect(hg.raw.source_tool).toBe("linkedin_hook_grader");
    expect(hg.qualification.primary).toBe("personal_branding");
    expect(hg.score).not.toBeNull();
    expect(hg.score!.score).toBeGreaterThanOrEqual(1);
    expect(hg.score!.score).toBeLessThanOrEqual(10);
    // Hook UI score must not become lead score / routing reason
    expect(hg.score!.score).not.toBe(62);
    expect(hg.score!.scoreReason).not.toMatch(/Mapped from Hook Grader/i);
    expect(hg.route.reason).not.toMatch(/Hook Grader via Make score=/i);
    expect(hg.clean.normalized.company).toBeNull();
    expect(hg.clean.flags).toContain("ok");
    expect(hg.qualification.status).toMatch(/qualified|needs_review/);

    // Same treatment family as CSV personal-branding adjacent lead L03
    const l03 = csvProcessed.find((l) => l.leadId === "L03")!;
    expect(l03.qualification.primary).toBe("personal_branding");
    expect(typeof hg.qualification.reason).toBe("string");
    expect(typeof l03.qualification.reason).toBe("string");

    // Exclusions still apply (CSV L07)
    const l07 = csvProcessed.find((l) => l.leadId === "L07")!;
    expect(l07.clean.flags).toContain("test_entry");
    expect(l07.route.tier).toBe("not_a_fit");
    expect(l07.emailDraft).toBeNull();

    // Missing email exclusion (CSV L18)
    const l18 = csvProcessed.find((l) => l.leadId === "L18")!;
    expect(l18.clean.flags).toContain("missing_email");
    expect(l18.route.draftEmailRequired).toBe(false);

    // Duplicate detection (CSV L11 after L01-style contact already seen in batch)
    const l11 = csvProcessed.find((l) => l.leadId === "L11")!;
    expect(l11.clean.flags).toContain("duplicate_contact");
  });

  it("does not send email/LinkedIn and stores draft artifact for warm/hot Hook Grader fits", async () => {
    const config = dryConfig();
    const ingest = hookGraderPayloadToRawLead(hookGraderTestPayload());
    const hg = await processIncomingLead(
      ingest.raw,
      dryProcessOptions(config, ingest.source, {
        idempotencyKey: ingest.idempotencyKey,
      }),
    );

    expect(hg.zoho.mode).toBe("draft_only");
    if (hg.route.tier === "hot" || hg.route.tier === "warm") {
      expect(hg.emailDraft).not.toBeNull();
      expect(hg.emailDraft!.body).toContain("myntmore.com/founder-meeting");
      expect(hg.emailDraft!.body.toLowerCase()).toContain("linkedin hook");
      expect(hg.draftArtifact).not.toBeNull();
      expect(hg.draftArtifact!.send_attempted).toBe(false);
      expect(hg.draftArtifact!.status).toBe("draft_only");
    }
    expect(
      hg.errors.some((e) => /send/i.test(e.message) && !e.recoverable),
    ).toBe(false);
  });

  it("applies exclusion rules to Hook Grader test entries", async () => {
    const config = dryConfig();
    const ingest = hookGraderPayloadToRawLead(
      hookGraderTestPayload({
        session_id: "hg-test-entry-exclude",
        contact: {
          name: "Test User",
          designation: "Founder",
          email: "test@example.com",
        },
        hook: {
          original: "asdf test dummy sample hook",
          score: 90,
          failed_rules: [],
          passed_rules: ["length"],
        },
      }),
    );
    const hg = await processIncomingLead(
      ingest.raw,
      dryProcessOptions(config, ingest.source, {
        idempotencyKey: ingest.idempotencyKey,
      }),
    );
    expect(hg.clean.flags).toContain("test_entry");
    expect(hg.route.tier).toBe("not_a_fit");
    expect(hg.emailDraft).toBeNull();
    expect(hg.qualification.status).toBe("excluded");
  });

  it("keeps Hook Grader idempotency stable across retries", async () => {
    const config = dryConfig();
    const payload = hookGraderTestPayload({
      session_id: "hg-idempotency-retry-001",
    });
    const aIn = hookGraderPayloadToRawLead(payload);
    const bIn = hookGraderPayloadToRawLead(payload);
    expect(aIn.idempotencyKey).toBe(bIn.idempotencyKey);

    const a = await processIncomingLead(
      aIn.raw,
      dryProcessOptions(config, aIn.source, {
        idempotencyKey: aIn.idempotencyKey,
      }),
    );
    const b = await processIncomingLead(
      bIn.raw,
      dryProcessOptions(config, bIn.source, {
        idempotencyKey: bIn.idempotencyKey,
      }),
    );
    expect(a.idempotencyKey).toBe(b.idempotencyKey);
    expect(a.route.tier).toBe(b.route.tier);
    expect(a.score?.score).toBe(b.score?.score);
    expect(a.qualification.primary).toBe(b.qualification.primary);
  });

  it("allows missing optional designation without inventing company data", async () => {
    const config = dryConfig();
    const ingest = hookGraderPayloadToRawLead(
      hookGraderTestPayload({
        session_id: "hg-missing-designation-001",
        contact: {
          name: "Priya Shared Pipeline",
          designation: null,
          email: "priya.shared.pipeline@example.com",
        },
      }),
    );
    expect(ingest.raw.designation).toBe("");
    expect(ingest.raw.company).toBe("");
    const hg = await processIncomingLead(
      ingest.raw,
      dryProcessOptions(config, ingest.source, {
        idempotencyKey: ingest.idempotencyKey,
      }),
    );
    expect(hg.clean.normalized.designation).toBe("");
    expect(hg.clean.normalized.company).toBeNull();
    expect(hg.qualification.primary).toBe("personal_branding");
  });
});
