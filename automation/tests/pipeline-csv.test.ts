import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { planZohoDraft } from "../src/adapters/zoho.js";
import { loadConfig } from "../src/config.js";
import { importLeadsCsv } from "../src/import/csv.js";
import { runCsvPipeline } from "../src/pipeline/runCsv.js";

const rootCsv = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../leads.csv",
);

describe("CSV import + full pipeline", () => {
  it("imports all 20 fictional sessions", async () => {
    const { rows, parseWarnings } = await importLeadsCsv(rootCsv);
    expect(rows).toHaveLength(20);
    expect(rows.map((r) => r.lead_id)).toEqual(
      Array.from({ length: 20 }, (_, i) => `L${String(i + 1).padStart(2, "0")}`),
    );
    expect(parseWarnings).toEqual([]);
  });

  it("accounts for every row with explicit reasons and never auto-sends", async () => {
    const config = loadConfig({
      LEADS_CSV_PATH: rootCsv,
      PIPELINE_MODE: "dry_run",
      ZOHO_SEND_MODE: "draft",
    });

    const summary = await runCsvPipeline(config);
    expect(summary.totalRows).toBe(20);
    expect(summary.accountedRows).toBe(20);
    expect(summary.observations).toHaveLength(20);
    const c = summary.counts;
    expect(c.imported).toBe(20);
    expect(c.processed).toBe(20);
    expect(c.completed + c.excluded + c.failed).toBe(20);
    expect(c.drafted).toBe(c.completed); // hot/warm only in this dataset

    for (const lead of summary.leads) {
      expect(lead.clean.reasons.length).toBeGreaterThan(0);
      expect(lead.idempotencyKey).toBe(`csv_${lead.leadId}`);
      expect(lead.zoho.mode).toBe("draft_only");
      expect(lead.route.tier).toMatch(/hot|warm|not_a_fit/);
      expect(Array.isArray(lead.errors)).toBe(true);
      if (lead.route.tier === "not_a_fit") {
        expect(lead.emailDraft).toBeNull();
        expect(lead.route.draftEmailRequired).toBe(false);
      }
      if (lead.emailDraft) {
        expect(lead.emailDraft.wordCount).toBeLessThan(120);
        expect(lead.emailDraft.body).toContain("myntmore.com/founder-meeting");
        expect(lead.emailDraft.body).not.toMatch(/—/);
        expect(lead.emailDraft.isFallback).toBe(true);
      }
    }

    // Known messy rows must be classified, not dropped
    const byId = Object.fromEntries(summary.leads.map((l) => [l.leadId, l]));
    expect(byId.L05.clean.flags).toContain("incomplete_session");
    expect(byId.L07.clean.flags).toContain("test_entry");
    expect(byId.L07.route.tier).toBe("not_a_fit");
    expect(byId.L09.clean.flags).toContain("non_buyer");
    expect(byId.L11.clean.flags).toContain("duplicate_contact");
    expect(byId.L14.clean.flags).toContain("non_buyer");
    expect(byId.L18.clean.flags).toContain("missing_email");
    expect(byId.L19.clean.flags).toContain("prompt_injection");
    expect(byId.L19.route.tier).toBe("not_a_fit");
  });

  it("is idempotent on re-run keys", async () => {
    const config = loadConfig({
      LEADS_CSV_PATH: rootCsv,
      PIPELINE_MODE: "dry_run",
      ZOHO_SEND_MODE: "draft",
    });
    const a = await runCsvPipeline(config);
    const b = await runCsvPipeline(config);
    expect(a.leads.map((l) => l.idempotencyKey)).toEqual(
      b.leads.map((l) => l.idempotencyKey),
    );
    expect(a.leads.map((l) => l.score?.score)).toEqual(
      b.leads.map((l) => l.score?.score),
    );
  });
});

describe("Zoho draft-only guard", () => {
  it("never exposes a send path and queues drafts only for hot/warm", () => {
    const skipped = planZohoDraft({
      leadId: "L07",
      email: "test@test.com",
      fullName: "test test",
      company: "test",
      tier: "not_a_fit",
      draft: null,
      sendMode: "draft",
    });
    expect(skipped.status).toBe("skipped");

    const queued = planZohoDraft({
      leadId: "L01",
      email: "arjun@ledgerloop.example",
      fullName: "Arjun Mehta",
      company: "LedgerLoop",
      tier: "hot",
      draft: {
        subject: "Hi",
        body: "Hello myntmore.com/founder-meeting",
        wordCount: 3,
        source: "template_fallback",
        validationErrors: [],
        blocked: false,
      },
      sendMode: "draft",
    });
    expect(queued.status).toBe("dry_run_queued");
    expect(queued.mode).toBe("draft_only");
  });
});
