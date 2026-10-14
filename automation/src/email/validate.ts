import { EMAIL_WRITING_RULES, countWords } from "./rules.js";

export function validateEmailDraft(
  subject: string,
  body: string,
  founderMeetingUrl: string,
): string[] {
  const errors: string[] = [];
  const words = countWords(body);
  if (words === 0) errors.push("Body is empty");
  if (words >= EMAIL_WRITING_RULES.maxWords) {
    errors.push(`Body has ${words} words; must be under ${EMAIL_WRITING_RULES.maxWords}`);
  }
  if (!subject.trim()) errors.push("Subject is empty");

  for (const pattern of EMAIL_WRITING_RULES.forbiddenPatterns) {
    if (pattern.re.test(body) || pattern.re.test(subject)) {
      errors.push(`Forbidden pattern: ${pattern.name}`);
    }
    pattern.re.lastIndex = 0;
  }

  const urls = body.match(EMAIL_WRITING_RULES.anyUrl) ?? [];
  for (const url of urls) {
    const normalized = url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    if (!normalized.startsWith(founderMeetingUrl)) {
      errors.push(`Disallowed URL: ${url}`);
    }
  }

  if (!body.includes(founderMeetingUrl) && !body.includes(`https://${founderMeetingUrl}`)) {
    // Warm/hot drafts should include CTA; flag if missing
    errors.push(`Missing required CTA ${founderMeetingUrl}`);
  }

  return errors;
}
