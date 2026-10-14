import { describe, expect, it, vi } from "vitest";
import { persistProcessedLead, toLeadRow } from "../src/adapters/supabase.js";
import { createZohoDraft, planZohoDraft } from "../src/adapters/zoho.js";
import { loadConfig } from "../src/config.js";
import { ProcessedLead } from "../src/types.js";

function sampleLead(overrides: Partial<ProcessedLead> = {}): ProcessedLead {
  return {
    leadId: "L01",
    idempotencyKey: "csv_L01",
    source: "csv",
    raw: {
      lead_id: "L01",
      created_at: "2026-09-22 10:14",
      source_tool: "roi_calculator",
      first_name: "Arjun",
      last_name: "Mehta",
      designation: "Founder",
      email: "arjun@ledgerloop.example",
      company: "LedgerLoop",
      company_website: "ledgerloop.example",
      linkedin_url: "https://linkedin.com/in/x",
      tool_input: "input",
      tool_output: "output",
    },
    clean: {
      leadId: "L01",
      idempotencyKey: "csv_L01",
      normalized: {
        firstName: "Arjun",
        lastName: "Mehta",
        fullName: "Arjun Mehta",
        designation: "Founder",
        email: "arjun@ledgerloop.example",
        company: "LedgerLoop",
        companyWebsite: "ledgerloop.example",
        linkedinUrl: "https://linkedin.com/in/x",
        sourceTool: "roi_calculator",
        createdAt: "2026-09-22 10:14",
        toolInput: "input",
        toolOutput: "output",
      },
      flags: ["ok"],
      reasons: ["Passed cleaning checks"],
      eligibleForScoring: true,
      eligibleForEmail: true,
    },
    score: {
      score: 9,
      service: "linkedin_outreach",
      scoreReason: "fit",
      ruleBreakdown: [],
      geminiRole: "none_for_scoring",
    },
    route: {
      tier: "hot",
      alertRequired: true,
      draftEmailRequired: true,
      reason: "Hot",
    },
    emailDraft: {
      subject: "Hi",
      body: "Hello myntmore.com/founder-meeting",
      wordCount: 3,
      source: "template_fallback",
      validationErrors: [],
      blocked: false,
      isFallback: true,
      fallbackReason: "test",
    },
    zoho: {
      mode: "draft_only",
      wouldCreateDraft: true,
      status: "dry_run_queued",
      detail: "queued",
    },
    persistence: { status: "pending", detail: "pending" },
    errors: [],
    ...overrides,
  };
}

describe("Supabase adapter", () => {
  it("dry-runs without credentials", async () => {
    const result = await persistProcessedLead(sampleLead(), { mode: "dry_run" });
    expect(result.status).toBe("dry_run");
  });

  it("reports API errors in live mode", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("boom", { status: 500 }),
    ) as unknown as typeof fetch;
    const result = await persistProcessedLead(sampleLead(), {
      mode: "live",
      url: "https://example.supabase.co",
      serviceRoleKey: "test-key",
      fetchImpl,
    });
    expect(result.status).toBe("failed");
    expect(result.detail).toContain("500");
  });

  it("reports network/timeouts as failed", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const result = await persistProcessedLead(sampleLead(), {
      mode: "live",
      url: "https://example.supabase.co",
      serviceRoleKey: "test-key",
      fetchImpl,
    });
    expect(result.status).toBe("failed");
    expect(result.detail).toContain("network down");
  });

  it("upserts successfully when fetch returns 2xx", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(null, { status: 201 }),
    ) as unknown as typeof fetch;
    const result = await persistProcessedLead(sampleLead(), {
      mode: "live",
      url: "https://example.supabase.co",
      serviceRoleKey: "test-key",
      fetchImpl,
    });
    expect(result.status).toBe("upserted");
    expect(fetchImpl).toHaveBeenCalledOnce();
    const row = toLeadRow(sampleLead());
    expect(row.idempotency_key).toBe("csv_L01");
  });
});

describe("Zoho adapter (draft-only)", () => {
  it("queues dry-run drafts for hot/warm and skips not_a_fit", () => {
    expect(
      planZohoDraft({
        leadId: "L07",
        email: "a@b.com",
        fullName: "A",
        company: "C",
        tier: "not_a_fit",
        draft: null,
        sendMode: "draft",
      }).status,
    ).toBe("skipped");

    expect(
      planZohoDraft({
        leadId: "L01",
        email: "a@b.com",
        fullName: "A",
        company: "C",
        tier: "hot",
        draft: sampleLead().emailDraft,
        sendMode: "draft",
      }).status,
    ).toBe("dry_run_queued");
  });

  it("has no send-email export and refuses live create on API error", async () => {
    expect("sendEmail" in (await import("../src/adapters/zoho.js"))).toBe(false);
    const fetchImpl = vi.fn(async () =>
      new Response("denied", { status: 401 }),
    ) as unknown as typeof fetch;
    const { result, errors } = await createZohoDraft(
      { apiDomain: "https://www.zohoapis.com", accessToken: "x", fetchImpl },
      {
        leadId: "L01",
        email: "a@b.com",
        fullName: "A",
        company: "C",
        subject: "Hi",
        body: "Body",
        idempotencyKey: "csv_L01",
      },
    );
    expect(result.status).toBe("failed");
    expect(errors[0]?.code).toBe("ZOHO_DRAFT_FAILED");
  });

  it("marks created on success without sending", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ details: { id: "1" } }] }), {
        status: 201,
      }),
    ) as unknown as typeof fetch;
    const { result, errors } = await createZohoDraft(
      { apiDomain: "https://www.zohoapis.com", accessToken: "x", fetchImpl },
      {
        leadId: "L01",
        email: "a@b.com",
        fullName: "A",
        company: "C",
        subject: "Hi",
        body: "Body",
        idempotencyKey: "csv_L01",
      },
    );
    expect(result.status).toBe("created");
    expect(result.mode).toBe("draft_only");
    expect(errors).toEqual([]);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).toContain("[DRAFT ONLY]");
  });
});

describe("config draft-only guard", () => {
  it("rejects non-draft ZOHO_SEND_MODE", () => {
    expect(() => loadConfig({ ZOHO_SEND_MODE: "send" } as NodeJS.ProcessEnv)).toThrow(
      /draft/,
    );
  });
});
