import { createReadStream } from "node:fs";
import { parse } from "csv-parse";
import { RawLead, RawLeadSchema } from "../types.js";

export interface CsvImportResult {
  rows: RawLead[];
  parseWarnings: string[];
}

/**
 * Import every row from leads.csv. Malformed rows are still returned with
 * empty strings for missing fields and a warning — never silently dropped.
 */
export async function importLeadsCsv(filePath: string): Promise<CsvImportResult> {
  const parseWarnings: string[] = [];
  const rows: RawLead[] = [];

  const parser = createReadStream(filePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    }),
  );

  let index = 0;
  for await (const record of parser) {
    index += 1;
    const coerced = coerceRecord(record as Record<string, unknown>);
    const parsed = RawLeadSchema.safeParse(coerced);
    if (!parsed.success) {
      parseWarnings.push(
        `row_${index}: schema issues — ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      );
      // Retain a best-effort row so nothing is silently dropped.
      rows.push(coerced as RawLead);
      continue;
    }
    rows.push(parsed.data);
  }

  return { rows, parseWarnings };
}

function coerceRecord(record: Record<string, unknown>): Record<string, string> {
  const keys = [
    "lead_id",
    "created_at",
    "source_tool",
    "first_name",
    "last_name",
    "designation",
    "email",
    "company",
    "company_website",
    "linkedin_url",
    "tool_input",
    "tool_output",
  ] as const;

  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = record[key];
    out[key] = value == null ? "" : String(value).trim();
  }
  if (!out.lead_id) {
    out.lead_id = `unknown_${Date.now()}`;
  }
  return out;
}

/** Stable idempotency key for CSV-origin sessions. */
export function csvIdempotencyKey(leadId: string): string {
  return `csv_${leadId}`;
}
