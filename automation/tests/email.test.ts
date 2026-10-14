import { describe, expect, it } from "vitest";
import { classifyLead, createDuplicateIndex } from "../src/clean/classify.js";
import { draftFollowUpEmail } from "../src/email/gemini.js";
import { validateEmailDraft } from "../src/email/validate.js";
import { RawLead } from "../src/types.js";

const CTA = "myntmore.com/founder-meeting";

function cleanLead() {
  const raw: RawLead = {
    lead_id: "L01",
    created_at: "2026-09-22 10:14",
    source_tool: "roi_calculator",
    first_name: "Arjun",
    last_name: "Mehta",
    designation: "Founder & CEO",
    email: "arjun@ledgerloop.example",
    company: "LedgerLoop",
    company_website: "ledgerloop.example",
    linkedin_url: "https://linkedin.com/in/x",
    tool_input: "400 connection requests a month; average deal $6,000",
    tool_output: "Projected 3 deals, revenue $18,000",
  };
  return classifyLead(raw, createDuplicateIndex());
}

describe("email validation", () => {
  it("rejects em dashes, jargon, extra URLs, and long bodies", () => {
    const long = Array.from({ length: 130 }, () => "word").join(" ");
    expect(
      validateEmailDraft("Hi", `${long} — synergy https://evil.example`, CTA),
    ).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/words/i),
        expect.stringMatching(/em_dash/),
        expect.stringMatching(/jargon/),
        expect.stringMatching(/Disallowed URL/),
      ]),
    );
  });

  it("accepts a compliant short draft", () => {
    const body = [
      "Hi Arjun,",
      "Thanks for running the ROI calculator for LedgerLoop.",
      "You modeled 400 connection requests a month.",
      "Happy to discuss LinkedIn outreach next steps.",
      `Book here: https://${CTA}`,
      "Best, Myntmore",
    ].join("\n");
    expect(validateEmailDraft("Quick note", body, CTA)).toEqual([]);
  });
});

describe("draftFollowUpEmail", () => {
  it("skips not_a_fit", async () => {
    const { draft } = await draftFollowUpEmail(
      cleanLead(),
      "linkedin_outreach",
      "not_a_fit",
      { founderMeetingUrl: CTA },
    );
    expect(draft.blocked).toBe(true);
    expect(draft.body).toBe("");
    expect(draft.isFallback).toBe(true);
  });

  it("falls back when NVIDIA key missing and marks fallback", async () => {
    const { draft, errors } = await draftFollowUpEmail(
      cleanLead(),
      "linkedin_outreach",
      "hot",
      { founderMeetingUrl: CTA },
    );
    expect(draft.source).toBe("template_fallback");
    expect(draft.isFallback).toBe(true);
    expect(draft.body).toContain(CTA);
    expect(draft.wordCount).toBeLessThan(120);
    expect(draft.blocked).toBe(false);
    expect(errors.some((e) => e.code === "NVIDIA_MISSING_KEY")).toBe(true);
    expect(errors.every((e) => e.recoverable)).toBe(true);
  });

  it("uses NVIDIA JSON when generator provided", async () => {
    const { draft, errors } = await draftFollowUpEmail(
      cleanLead(),
      "linkedin_outreach",
      "warm",
      {
        founderMeetingUrl: CTA,
        generateText: async () =>
          JSON.stringify({
            subject: "About your ROI session",
            body: `Hi Arjun,\nThanks for the ROI calculator session for LedgerLoop. You shared connection request volume and deal size from the tool output. If useful, we can discuss LinkedIn outreach.\nBook a founder meeting: https://${CTA}\nBest,\nMyntmore`,
          }),
      },
    );
    expect(draft.source).toBe("nvidia");
    expect(draft.isFallback).toBe(false);
    expect(draft.blocked).toBe(false);
    expect(errors).toEqual([]);
  });

  it("falls back on malformed NVIDIA response", async () => {
    const { draft, errors } = await draftFollowUpEmail(
      cleanLead(),
      "linkedin_outreach",
      "warm",
      {
        founderMeetingUrl: CTA,
        generateText: async () => "not-json",
      },
    );
    expect(draft.source).toBe("template_fallback");
    expect(draft.isFallback).toBe(true);
    expect(errors.some((e) => e.code === "NVIDIA_MALFORMED")).toBe(true);
  });

  it("falls back when NVIDIA returns invalid content", async () => {
    const { draft, errors } = await draftFollowUpEmail(
      cleanLead(),
      "linkedin_outreach",
      "warm",
      {
        founderMeetingUrl: CTA,
        generateText: async () =>
          JSON.stringify({
            subject: "Hi",
            body: `We guarantee 50 meetings — synergy unlock https://spam.example`,
          }),
      },
    );
    expect(draft.source).toBe("template_fallback");
    expect(draft.body).not.toContain("spam.example");
    expect(errors.some((e) => e.code === "NVIDIA_VALIDATION_FAILED")).toBe(true);
  });

  it("falls back on timeout", async () => {
    const { draft, errors } = await draftFollowUpEmail(
      cleanLead(),
      "linkedin_outreach",
      "hot",
      {
        founderMeetingUrl: CTA,
        timeoutMs: 30,
        generateText: async () => {
          await new Promise((r) => setTimeout(r, 200));
          return "{}";
        },
      },
    );
    expect(draft.isFallback).toBe(true);
    expect(errors.some((e) => e.code === "NVIDIA_TIMEOUT")).toBe(true);
  });
});
