import { describe, expect, it, vi } from "vitest";
import { persistProcessedLead, toLeadRow } from "../src/adapters/supabase.js";
import {
  createZohoDraft,
  draftSourceKey,
  planZohoDraft,
} from "../src/adapters/zoho.js";
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
    qualification: {
      primary: "linkedin_outreach",
      secondary: null,
      reason: "Primary LinkedIn Outreach & Automation from submitted signals.",
      method: "rules_only",
      status: "qualified",
      exclusionReason: null,
      version: "service_rubric_v1",
      ruleHits: [],
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
    draftArtifact: {
      draft_id: "draft_test",
      lead_id: "L01",
      source: "csv",
      lead_temperature: "Hot",
      service_fit_primary: "LinkedIn Outreach & Automation",
      service_fit_secondary: null,
      subject: "Hi",
      recipient: "arjun@ledgerloop.example",
      body: "Hello myntmore.com/founder-meeting",
      cta_url: "https://myntmore.com/founder-meeting",
      status: "draft_only",
      send_attempted: false,
      qualification_reason: "test",
      created_at: "2026-10-14T00:00:00.000Z",
      validation_ok: true,
      validation_errors: [],
      draft_source: "template_fallback",
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

  it("has no send-email export", async () => {
    expect("sendEmail" in (await import("../src/adapters/zoho.js"))).toBe(false);
  });

  it("creates a native email draft associated with the CRM lead", async () => {
    const draftId = "draft_abc";
    const zohoLeadId = "1445645000000549005";
    const source = draftSourceKey("csv_L01");
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/Leads/search")) {
        return new Response(JSON.stringify({ data: [{ id: zohoLeadId }] }), { status: 200 });
      }
      if (u.includes("/__email_drafts") && (!init?.method || init.method === "GET")) {
        return new Response(JSON.stringify({ __email_drafts: [] }), { status: 200 });
      }
      if (u.includes("/from_addresses")) {
        return new Response(
          JSON.stringify({
            from_addresses: [{ email: "sender@myntmore.example", type: "primary" }],
          }),
          { status: 200 },
        );
      }
      if (u.includes("/__email_drafts") && init?.method === "POST") {
        const body = String(init.body);
        expect(body).toContain("sender@myntmore.example");
        expect(body).toContain(source);
        const parsed = JSON.parse(body) as {
          __email_drafts: Array<Record<string, unknown>>;
        };
        const draft = parsed.__email_drafts[0];
        expect(draft.from).toBe("sender@myntmore.example");
        expect(draft.source).toBe(source);
        expect(draft.rich_text).toBe(false);
        expect(draft.plainTextContent).toBe("Body myntmore.com/founder-meeting");
        expect(draft.content).toBeUndefined();
        expect(body).not.toMatch(/send_mail|sendMail/i);
        return new Response(
          JSON.stringify({
            __email_drafts: [{ status: "success", details: { id: draftId } }],
          }),
          { status: 201 },
        );
      }
      return new Response("unexpected", { status: 500 });
    }) as unknown as typeof fetch;

    // Second list after create should show the draft (visibility)
    let listCalls = 0;
    const fetchWithVisibility = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/__email_drafts") && (!init?.method || init.method === "GET")) {
        listCalls += 1;
        if (listCalls >= 2) {
          return new Response(
            JSON.stringify({ __email_drafts: [{ id: draftId, source, subject: "Hi" }] }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ __email_drafts: [] }), { status: 200 });
      }
      return fetchImpl(url, init);
    }) as unknown as typeof fetch;

    const { result, errors, draftId: createdId, zohoLeadId: resolved } = await createZohoDraft(
      {
        apiDomain: "https://www.zohoapis.com",
        accessToken: "x",
        fetchImpl: fetchWithVisibility,
      },
      {
        leadId: "L01",
        email: "a@b.com",
        fullName: "A",
        company: "C",
        subject: "Hi",
        body: "Body myntmore.com/founder-meeting",
        idempotencyKey: "csv_L01",
        mode: "native_email_draft",
      },
    );

    expect(result.status).toBe("verified");
    expect(result.mode).toBe("draft_only");
    expect(createdId).toBe(draftId);
    expect(resolved).toBe(zohoLeadId);
    expect(errors).toEqual([]);
    expect(result.detail).toMatch(/visible/i);
  });

  it("treats empty Zoho Lead search body as no match (204/empty JSON)", async () => {
    const zohoLeadId = "1445645000000549005";
    const draftId = "draft_after_empty_search";
    const source = draftSourceKey("csv_empty_search");
    let listCalls = 0;
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/Leads/search")) {
        // Zoho often returns an empty body for no matches (undici rejects status 204 here).
        return new Response("", { status: 200 });
      }
      if (u.includes("/Leads") && init?.method === "POST" && !u.includes("__email_drafts")) {
        return new Response(
          JSON.stringify({ data: [{ details: { id: zohoLeadId } }] }),
          { status: 201 },
        );
      }
      if (u.includes("/from_addresses")) {
        return new Response(
          JSON.stringify({ from_addresses: [{ email: "sender@example.com", type: "primary" }] }),
          { status: 200 },
        );
      }
      if (u.includes("/__email_drafts") && (!init?.method || init.method === "GET")) {
        listCalls += 1;
        if (listCalls >= 2) {
          return new Response(
            JSON.stringify({ __email_drafts: [{ id: draftId, source }] }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ __email_drafts: [] }), { status: 200 });
      }
      if (u.includes("/__email_drafts") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            __email_drafts: [{ status: "success", details: { id: draftId } }],
          }),
          { status: 201 },
        );
      }
      return new Response("unexpected", { status: 500 });
    }) as unknown as typeof fetch;

    const { result, draftId: createdId, zohoLeadId: resolved } = await createZohoDraft(
      { apiDomain: "https://www.zohoapis.in", accessToken: "x", fetchImpl },
      {
        leadId: "L99",
        email: "new@example.com",
        fullName: "New Lead",
        company: null,
        subject: "Hi",
        body: "Body myntmore.com/founder-meeting",
        idempotencyKey: "csv_empty_search",
      },
    );
    expect(resolved).toBe(zohoLeadId);
    expect(createdId).toBe(draftId);
    expect(result.status).toBe("verified");
  });

  it("is idempotent when a draft with the same source already exists", async () => {
    const zohoLeadId = "1445645000000549005";
    const source = draftSourceKey("csv_L01");
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/Leads/search")) {
        return new Response(JSON.stringify({ data: [{ id: zohoLeadId }] }), { status: 200 });
      }
      if (u.includes("/__email_drafts") && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify({
            __email_drafts: [{ id: "existing_draft", source, subject: "Hi" }],
          }),
          { status: 200 },
        );
      }
      return new Response("should not create", { status: 500 });
    }) as unknown as typeof fetch;

    const { result, draftId } = await createZohoDraft(
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
    expect(result.status).toBe("verified");
    expect(draftId).toBe("existing_draft");
    expect(result.detail).toMatch(/Idempotent/i);
  });

  it("falls back to Lead Owner email when from_addresses is empty", async () => {
    const zohoLeadId = "1445645000000549005";
    const draftId = "draft_owner";
    const source = draftSourceKey("csv_L01");
    let listCalls = 0;
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/Leads/search")) {
        return new Response(JSON.stringify({ data: [{ id: zohoLeadId }] }), { status: 200 });
      }
      if (u.includes(`/Leads/${zohoLeadId}`) && u.includes("fields=Owner")) {
        return new Response(
          JSON.stringify({
            data: [{ Owner: { email: "owner@example.com", name: "Owner" } }],
          }),
          { status: 200 },
        );
      }
      if (u.includes("/__email_drafts") && (!init?.method || init.method === "GET")) {
        listCalls += 1;
        if (listCalls >= 2) {
          return new Response(
            JSON.stringify({ __email_drafts: [{ id: draftId, source }] }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ __email_drafts: [] }), { status: 200 });
      }
      if (u.includes("/from_addresses")) {
        return new Response(JSON.stringify({ from_addresses: [] }), { status: 200 });
      }
      if (u.includes("/__email_drafts") && init?.method === "POST") {
        expect(String(init.body)).toContain("owner@example.com");
        return new Response(
          JSON.stringify({
            __email_drafts: [{ status: "success", details: { id: draftId } }],
          }),
          { status: 201 },
        );
      }
      return new Response("unexpected", { status: 500 });
    }) as unknown as typeof fetch;

    const { result, errors, draftId: createdId } = await createZohoDraft(
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
    expect(result.status).toBe("verified");
    expect(createdId).toBe(draftId);
    expect(errors).toEqual([]);
  });

  it("fails clearly when no from address and no owner email", async () => {
    const zohoLeadId = "1445645000000549005";
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/Leads/search")) {
        return new Response(JSON.stringify({ data: [{ id: zohoLeadId }] }), { status: 200 });
      }
      if (u.includes(`/Leads/${zohoLeadId}`) && u.includes("fields=Owner")) {
        return new Response(JSON.stringify({ data: [{ Owner: {} }] }), { status: 200 });
      }
      if (u.includes("/__email_drafts") && (!init?.method || init.method === "GET")) {
        return new Response(JSON.stringify({ __email_drafts: [] }), { status: 200 });
      }
      if (u.includes("/from_addresses")) {
        return new Response(JSON.stringify({ from_addresses: [] }), { status: 200 });
      }
      return new Response("unexpected", { status: 500 });
    }) as unknown as typeof fetch;

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
    expect(errors[0]?.code).toBe("ZOHO_FROM_ADDRESS_MISSING");
  });

  it("still supports qualification Notes mode as fallback", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/Leads/search")) {
        return new Response(JSON.stringify({ data: [{ id: "1445645000000549005" }] }), {
          status: 200,
        });
      }
      if (u.includes("/Notes") && init?.method === "POST") {
        expect(String(init.body)).toMatch(/\[DRAFT ONLY/);
        expect(String(init.body)).toContain("send_attempted=false");
        return new Response(JSON.stringify({ data: [{ details: { id: "1" } }] }), {
          status: 201,
        });
      }
      return new Response("unexpected", { status: 500 });
    }) as unknown as typeof fetch;

    const { result, errors } = await createZohoDraft(
      { apiDomain: "https://www.zohoapis.com", accessToken: "x", fetchImpl },
      {
        leadId: "L01",
        email: "a@b.com",
        fullName: "A",
        company: "C",
        subject: "Hi",
        body: "Qual body",
        idempotencyKey: "csv_L01",
        mode: "qualification_description",
      },
    );
    expect(result.status).toBe("created");
    expect(errors).toEqual([]);
  });
});

describe("config draft-only guard", () => {
  it("rejects non-draft ZOHO_SEND_MODE", () => {
    expect(() => loadConfig({ ZOHO_SEND_MODE: "send" } as NodeJS.ProcessEnv)).toThrow(
      /draft/,
    );
  });
});
