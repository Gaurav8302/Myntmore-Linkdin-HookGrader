import {
  classifyLead,
  createDuplicateIndex,
  DuplicateIndex,
} from "../clean/classify.js";
import { ProcessOptions, processLead } from "./processLead.js";
import { ProcessedLead, RawLead } from "../types.js";

export interface IncomingLeadOptions extends ProcessOptions {
  /** Override CleanResult.idempotencyKey (required for Hook Grader). */
  idempotencyKey?: string;
  /** Shared duplicate index when processing a batch. */
  duplicates?: DuplicateIndex;
}

/**
 * Shared pipeline entry for every lead source (CSV rows and Hook Grader via Make).
 *
 * Flow: RawLead → classify (clean/dedupe/exclude) → qualify → score → route →
 * draft artifact → native Zoho email draft (live) → Supabase upsert.
 *
 * Hook quality scores must already live in RawLead.tool_output only — they are
 * never used as the lead qualification score.
 */
export async function processIncomingLead(
  raw: RawLead,
  options: IncomingLeadOptions,
): Promise<ProcessedLead> {
  const duplicates = options.duplicates ?? createDuplicateIndex();
  const clean = classifyLead(raw, duplicates, {
    idempotencyKey: options.idempotencyKey,
  });
  return processLead(raw, clean, options);
}
