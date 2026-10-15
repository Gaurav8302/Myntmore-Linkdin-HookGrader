/**
 * Create / verify a native Zoho email draft for a lead already in Supabase.
 * Usage: tsx src/cli-zoho-draft.ts --idempotency-key <key>
 * Never prints tokens.
 */
import { createZohoDraft } from "./adapters/zoho.js";
import { resolveZohoClient } from "./adapters/resolveZohoClient.js";
import { loadConfig } from "./config.js";
import { loadLocalEnv } from "./env.js";

interface LeadRow {
  id: string;
  idempotency_key: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email_subject: string | null;
  email_draft: string | null;
  zoho_lead_id: string | null;
  zoho_draft_status: string | null;
  routing_tier: string | null;
}

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

async function fetchLeadByIdempotency(
  supabaseUrl: string,
  serviceKey: string,
  idempotencyKey: string,
): Promise<LeadRow | null> {
  const url = new URL(`${supabaseUrl.replace(/\/+$/, "")}/rest/v1/leads`);
  url.searchParams.set("idempotency_key", `eq.${idempotencyKey}`);
  url.searchParams.set("select", "*");
  url.searchParams.set("limit", "1");
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase lead fetch failed (HTTP ${res.status})`);
  }
  const rows = (await res.json()) as LeadRow[];
  return rows[0] ?? null;
}

async function patchLeadZoho(
  supabaseUrl: string,
  serviceKey: string,
  leadId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const url = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/leads?id=eq.${encodeURIComponent(leadId)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(`Supabase lead patch failed (HTTP ${res.status})`);
  }
}

async function main(): Promise<void> {
  loadLocalEnv();
  const config = loadConfig();
  const idem = argValue("--idempotency-key") || argValue("-k");
  if (!idem) {
    console.error("Usage: tsx src/cli-zoho-draft.ts --idempotency-key <key>");
    process.exitCode = 1;
    return;
  }
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    console.error("Supabase credentials missing in environment");
    process.exitCode = 1;
    return;
  }

  const lead = await fetchLeadByIdempotency(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
    idem,
  );
  if (!lead) {
    console.error("Lead not found for idempotency key");
    process.exitCode = 1;
    return;
  }

  const subject = (lead.email_subject || "").trim();
  const body = (lead.email_draft || "").trim();
  if (!subject || !body) {
    console.error("Lead has no email_subject/email_draft to push as Zoho draft");
    await patchLeadZoho(config.supabaseUrl, config.supabaseServiceRoleKey, lead.id, {
      zoho_draft_status: "skipped",
    });
    process.exitCode = 1;
    return;
  }
  if (!lead.email) {
    console.error("Lead has no email");
    process.exitCode = 1;
    return;
  }

  const zoho = await resolveZohoClient(config);
  if (!zoho) {
    console.error(
      "Zoho OAuth not configured (need ZOHO_CLIENT_ID/SECRET/REFRESH_TOKEN or ACCESS_TOKEN)",
    );
    await patchLeadZoho(config.supabaseUrl, config.supabaseServiceRoleKey, lead.id, {
      zoho_draft_status: "skipped",
    });
    process.exitCode = 1;
    return;
  }

  const fullName =
    (lead.full_name || "").trim() ||
    [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() ||
    "Lead";

  const created = await createZohoDraft(zoho, {
    leadId: lead.id,
    zohoLeadId: lead.zoho_lead_id || undefined,
    email: lead.email,
    fullName,
    company: lead.company,
    subject,
    body,
    idempotencyKey: lead.idempotency_key,
    mode: "native_email_draft",
  });

  const persistStatus = created.result.status;
  const ok =
    !!created.draftId &&
    (persistStatus === "created" || persistStatus === "verified");

  await patchLeadZoho(config.supabaseUrl, config.supabaseServiceRoleKey, lead.id, {
    zoho_lead_id: created.zohoLeadId,
    zoho_draft_status: persistStatus,
  });

  console.log(
    JSON.stringify({
      ok,
      zoho_draft_status: persistStatus,
      zoho_lead_id: created.zohoLeadId,
      draft_id_present: !!created.draftId,
      error_count: created.errors.length,
      error_codes: created.errors.map((e) => e.code),
    }),
  );

  if (!ok) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
