# AI provider failures and replacement (observed)

## Gemini (abandoned for this submission)

| Item | Observed |
|------|----------|
| Configured model | `gemini-2.5-flash` (assignment default) |
| Endpoint | `generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` |
| Error | **HTTP 404** — message stated the model is no longer available to **new users**, suggesting `gemini-3.8-flash` |
| Follow-up | Alternate flash models also failed for this key (404 EOL / unavailable). `gemini-3.8-flash` returned **HTTP 429** quota / overload when tried earlier in the sprint |
| Effect | Hook Grader and Task 1 email generation fell back to labelled template / echo rewrites; score stayed deterministic |

These are **observed** API responses against the configured key, not assumptions.

## NVIDIA replacement (active)

| Item | Value |
|------|--------|
| API | `https://integrate.api.nvidia.com/v1/chat/completions` (OpenAI-compatible) |
| Env | `NVIDIA_API_KEY` (server-only), optional `NVIDIA_MODEL`, `NVIDIA_API_URL` |
| Model live-tested | `meta/llama-3.2-11b-vision-instruct` (2026-10-14) — auth OK, short reply OK, structured JSON sample OK |
| Hook Grader | Deterministic `lib/scoring` for 0–100; NVIDIA only generates exactly 3 validated rewrites |
| Task 1 email | NVIDIA JSON draft with the same writing validators; labelled `template_fallback` on failure |
| Fallback | Never fabricated as live AI success — `fallback: true` / `source: template_fallback` |
| Production | Live Vercel smoke (2026-10-14): `POST /api/grade-hook` returned `fallback: false`, exactly 3 rewrites, score 83; session persisted in Supabase |

Several other NVIDIA catalog IDs returned 404/410 for this account or timed out; only the tested model above is claimed working.

Earlier production smoke hit `NVIDIA_UNAVAILABLE` because the model sometimes wrapped JSON (smart quotes / prose). Parser now extracts the JSON object; that fix is what passed the live production check above.

## Remaining limitations

- Vision-capable instruct model used for text JSON rewrites (smallest live-tested chat model for this key).
- Vercel must receive `NVIDIA_API_KEY` as a **server** env var (not `NEXT_PUBLIC_*`).
- Vercel Hobby cron for webhook retries is daily (`0 12 * * *`), not every minute.
- Zoho: never use `sendMail`. Native `__email_drafts` via OAuth refresh token is documented separately in [`../automation/docs/ZOHO_DRAFT_CAPABILITY.md`](../automation/docs/ZOHO_DRAFT_CAPABILITY.md) (do not treat MCP tool gaps as the full story).
- Make → n8n bridge needs a reachable public tunnel URL when n8n stays local.
