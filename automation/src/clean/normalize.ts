import { RawLead } from "../types.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeEmail(raw: string): string | null {
  const email = normalizeWhitespace(raw).toLowerCase();
  if (!email) return null;
  if (!EMAIL_RE.test(email)) return null;
  return email;
}

export function normalizeOptional(raw: string): string | null {
  const v = normalizeWhitespace(raw);
  return v.length === 0 ? null : v;
}

export function buildFullName(first: string, last: string): string {
  return normalizeWhitespace(`${first} ${last}`);
}

export function normalizeRawLead(raw: RawLead) {
  return {
    firstName: normalizeWhitespace(raw.first_name),
    lastName: normalizeWhitespace(raw.last_name),
    fullName: buildFullName(raw.first_name, raw.last_name),
    designation: normalizeWhitespace(raw.designation),
    email: normalizeEmail(raw.email),
    company: normalizeOptional(raw.company),
    companyWebsite: normalizeOptional(raw.company_website),
    linkedinUrl: normalizeOptional(raw.linkedin_url),
    sourceTool: normalizeWhitespace(raw.source_tool).toLowerCase(),
    createdAt: normalizeWhitespace(raw.created_at),
    toolInput: normalizeWhitespace(raw.tool_input),
    toolOutput: normalizeWhitespace(raw.tool_output),
  };
}
