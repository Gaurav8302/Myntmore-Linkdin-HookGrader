# Zoho draft-only capability (re-checked 2026-10-14 integration fix)

## Live-tested this pass

- **Lead still exists**: `1445645000000547001` (`fictional.myntmore.test@example.com`).
- **`user-Email-Followup` MCP**: still exposes only `ZohoCRM_sendMail` (Send Mail API). Schema has from/to/content/template fields and **no draft / save-as-draft flag**. **Never called.**
- **No new draft-create tool** appeared in any Zoho MCP namespace after the user email-capability update.
- **`Email_Drafts__s` create probe** via `ZohoCRM_createRecords`:
  - Result: `NO_PERMISSION`
  - Required permission named by API: `Crm_Implied_Create_EmailDrafts`
  - Module catalog still reports `api_supported: false`, `creatable: false` for `Email_Drafts__s` and `Emails`
- Lead Description text remains a **CRM note workaround only**, not an email-composer draft.

## Genuine draft status

| Path | Result |
|------|--------|
| MCP draft-create tool | **Not present** |
| `ZohoCRM_sendMail` | Send-only — must not be used for this assignment |
| `Email_Drafts__s` create | Permission denied (`Crm_Implied_Create_EmailDrafts`) |
| Lead Description / Notes | Not a genuine email draft |

**No email was sent.** `sendMail` / `/actions/send_mail` were not invoked.

## Blocker (exact)

Zoho CRM access available here cannot create an Email Drafts item. Missing org permission / API surface: `Crm_Implied_Create_EmailDrafts` (and likely Zoho Mail for CRM / mail draft scopes not granted to the connected OAuth client).

## Safe interim (Task 1)

1. Upsert Lead with score, tier, and draft body stored for review (`zoho_draft_status=dry_run_queued`).
2. Hot/Warm: template draft text only — never send.
3. Not fit: reason recorded, no email draft generated.

## Human action required

1. In Zoho CRM admin: enable Zoho Mail for CRM if available, and grant `Crm_Implied_Create_EmailDrafts` (or equivalent Email Drafts create permission) to the connected integration user/client.
2. Re-test `POST` create on `Email_Drafts__s` (or a future MCP draft tool) and read the draft back by id.
3. Do **not** enable auto-send workflows.
