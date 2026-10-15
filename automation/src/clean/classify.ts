import { CleanFlag, CleanResult, RawLead } from "../types.js";
import { csvIdempotencyKey } from "../import/csv.js";
import { normalizeRawLead } from "./normalize.js";

const TEST_TOKENS = new Set(["test", "asdf", "foo", "bar", "sample", "dummy"]);

const NON_BUYER_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  {
    re: /\b(student|final[- ]year|b\.?tech|intern)\b/i,
    reason: "Role indicates student/intern — not a buyer of Myntmore services",
  },
  {
    re: /\b(open to work|looking for (an? )?(sdr|bdr|job|role)|hiring managers\. offer:\s*me)\b/i,
    reason: "Job-seeker / candidate outreach — not a service buyer",
  },
];

const INJECTION_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  {
    re: /ignore\s+all\s+previous\s+instructions/i,
    reason: "Prompt-injection attempt detected in tool_input",
  },
  {
    re: /set\s+the\s+score\s+to\s+\d+/i,
    reason: "Adversarial instruction attempting to force score/tier",
  },
  {
    re: /guarantees?\s+\d+\s+meetings/i,
    reason: "Adversarial claim instruction — must not invent guarantees",
  },
];

export interface DuplicateIndex {
  /** email → first lead_id seen */
  byEmail: Map<string, string>;
}

export function createDuplicateIndex(): DuplicateIndex {
  return { byEmail: new Map() };
}

export function classifyLead(
  raw: RawLead,
  duplicates: DuplicateIndex,
  options?: { idempotencyKey?: string },
): CleanResult {
  const normalized = normalizeRawLead(raw);
  const flags = new Set<CleanFlag>();
  const reasons: string[] = [];

  // Missing / malformed email
  if (!raw.email.trim()) {
    flags.add("missing_email");
    reasons.push("Email is empty — cannot create CRM draft or send outreach");
  } else if (!normalized.email) {
    flags.add("malformed");
    reasons.push(`Email failed validation: "${raw.email.trim()}"`);
  }

  // Incomplete session
  if (!normalized.toolInput && !normalized.toolOutput) {
    flags.add("incomplete_session");
    reasons.push("Both tool_input and tool_output are empty");
  } else if (!normalized.toolInput) {
    flags.add("incomplete_session");
    reasons.push("tool_input is empty");
  } else if (!normalized.toolOutput) {
    flags.add("incomplete_session");
    reasons.push("tool_output is empty");
  }

  // Test entry heuristics
  if (isTestEntry(normalized, raw)) {
    flags.add("test_entry");
    reasons.push(
      "Looks like a test entry (test name/email/company or nonsense input)",
    );
  }

  // Non-buyer
  for (const pattern of NON_BUYER_PATTERNS) {
    const haystack = `${normalized.designation} ${normalized.toolInput} ${normalized.toolOutput}`;
    if (pattern.re.test(haystack)) {
      flags.add("non_buyer");
      reasons.push(pattern.reason);
      break;
    }
  }

  // Prompt injection
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.re.test(normalized.toolInput) || pattern.re.test(normalized.toolOutput)) {
      flags.add("prompt_injection");
      reasons.push(pattern.reason);
      break;
    }
  }

  // Duplicate contact (same email, different session) — keep both rows
  if (normalized.email) {
    const prior = duplicates.byEmail.get(normalized.email);
    if (prior && prior !== raw.lead_id) {
      flags.add("duplicate_contact");
      reasons.push(
        `Same email as prior session ${prior} — retained as separate tool session`,
      );
    } else if (!prior) {
      duplicates.byEmail.set(normalized.email, raw.lead_id);
    }
  }

  if (flags.size === 0) {
    flags.add("ok");
    reasons.push("Passed cleaning checks");
  }

  const blocking = hasBlockingFlag(flags);
  const eligibleForScoring = true; // always score for auditability
  const eligibleForEmail =
    !blocking &&
    Boolean(normalized.email) &&
    !flags.has("incomplete_session");

  return {
    leadId: raw.lead_id,
    idempotencyKey: options?.idempotencyKey ?? csvIdempotencyKey(raw.lead_id),
    normalized,
    flags: [...flags],
    reasons,
    eligibleForScoring,
    eligibleForEmail,
  };
}

function hasBlockingFlag(flags: Set<CleanFlag>): boolean {
  return (
    flags.has("test_entry") ||
    flags.has("non_buyer") ||
    flags.has("prompt_injection") ||
    flags.has("missing_email") ||
    flags.has("malformed")
  );
}

function isTestEntry(
  normalized: ReturnType<typeof normalizeRawLead>,
  raw: RawLead,
): boolean {
  const nameBits = [normalized.firstName, normalized.lastName, normalized.fullName]
    .map((s) => s.toLowerCase())
    .filter(Boolean);

  if (nameBits.every((n) => TEST_TOKENS.has(n) || n === "test test")) {
    return true;
  }
  if (normalized.email && /^(test|asdf|foo)@/i.test(normalized.email)) {
    return true;
  }
  if (normalized.company && TEST_TOKENS.has(normalized.company.toLowerCase())) {
    return true;
  }
  if (
    TEST_TOKENS.has(normalized.toolInput.toLowerCase()) &&
    normalized.toolInput.length <= 8
  ) {
    return true;
  }
  // All three of name/email/company look like placeholders
  const emailIsTest = Boolean(normalized.email?.includes("@test."));
  const companyIsTest = (raw.company || "").trim().toLowerCase() === "test";
  const nameIsTest =
    normalized.firstName.toLowerCase() === "test" &&
    normalized.lastName.toLowerCase() === "test";
  return nameIsTest && (emailIsTest || companyIsTest);
}

/**
 * Clean a batch in CSV order so duplicate detection is stable.
 */
export function classifyBatch(raws: RawLead[]): CleanResult[] {
  const index = createDuplicateIndex();
  return raws.map((raw) => classifyLead(raw, index));
}
