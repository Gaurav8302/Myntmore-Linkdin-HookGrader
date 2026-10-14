# Zoho draft-only capability (re-checked 2026-10-14 final)

## Live-tested

- **Zoho MCP connected** as org user (Administrator).
- **Lead create works**: fictional Lead created via `ZohoCRM_createRecords` on module `Leads`.
  - Record id: `1445645000000547001`
  - Email: `fictional.myntmore.test@example.com` (do not contact)
- **Lead Description updated** with labeled `[DRAFT ONLY — DO NOT SEND]` body — CRM-visible draft text for Loom; **not** an email-composer draft.
- n8n Zoho CRM node supports Lead create/upsert/get — **same class of API** as MCP (records), not email composer drafts.
- **Re-inspection of `user-Email-Followup`**: still only exposes `ZohoCRM_sendMail` (send-mail API). Schema has from/to/content/template fields and **no draft / save-as-draft flag**. **Never called.** No new draft-create tool appeared in the namespace.

## Blocker (genuine email draft)

Zoho CRM REST / available MCPs expose **record** APIs and **send mail**, not “create draft in Email composer without sending.” Assignment-safe path: store draft body on Lead `Description` + n8n `zoho_draft_status=dry_run_queued` / never send.

## Cannot create a genuine CRM email draft via available APIs

| Path | Result |
|------|--------|
| Module `Emails` | `api_supported: false`, `creatable: false` |
| Module `Email_Drafts__s` | Exists in org catalog but `api_supported: false`, `creatable: false` |
| Zoho MCP tool set | Records / fields / workflows / webhooks — **no send_mail / draft_mail tool** |
| n8n `n8n-nodes-base.zohoCrm` | Lead/Contact/Deal/… CRUD only — **no email draft operation** |

Creating a **Note** on a Lead is **not** equivalent to a draft in Zoho’s email composer. We will not fake that as a draft.

## Blocker (exact)

Zoho CRM REST/MCP access available to this account cannot create an item in **Email Drafts**. Typical Zoho “send mail as draft” APIs require Zoho Mail / CRM email integration scopes that are **not exposed** through the connected MCP and not present on the n8n Zoho CRM node.

## Safe interim for demo (without claiming draft success)

1. Create/upsert Lead with score, tier, and draft body stored in Description / custom fields (**Lead only**).
2. Mark `zoho_status=lead_created_draft_pending` until a verified draft path exists.
3. Human can paste the generated draft into Zoho Mail/CRM composer for the Loom if API drafts stay blocked.

## Human action required

1. In Zoho CRM: confirm whether **Zoho Mail for CRM** / IMAP is enabled for the org.
2. If yes, grant OAuth scopes for mail draft APIs (or provide a self-client with `ZohoCRM.send_mail` / Mail API draft create) and re-test.
3. Do **not** enable any auto-send workflow.
