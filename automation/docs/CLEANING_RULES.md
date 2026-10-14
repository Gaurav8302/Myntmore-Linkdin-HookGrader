# Task 1 Cleaning Rules

**Source of truth for CSV messy-data handling.** Every imported row is retained with at least one explicit reason. Nothing is silently dropped.

## Provenance

| Field | Purpose |
|-------|---------|
| `lead_id` | Original CSV identifier (`L01`–`L20`) |
| `idempotency_key` | `csv_<lead_id>` for CSV imports |
| `clean.flags` | Machine-readable classifications |
| `clean.reasons` | Human-readable explanation (always present) |

Future Hook Grader leads (via Make.com only) will use `idempotency_key = hook_grader_<session_id>` per provisional API contract. That path is **not implemented** in this iteration.

## Flags

| Flag | Meaning | Email draft? |
|------|---------|--------------|
| `ok` | Passed checks | Yes (if routed hot/warm) |
| `test_entry` | Placeholder/test identity or nonsense input | No |
| `non_buyer` | Student / job-seeker / candidate patterns | No |
| `duplicate_contact` | Same email as an earlier session; row kept | Yes if otherwise eligible |
| `missing_email` | Empty email | No |
| `malformed` | Email present but invalid | No |
| `incomplete_session` | Empty tool input and/or output | No |
| `prompt_injection` | Adversarial instructions in tool fields | No |

## CSV row accounting (20/20)

| Lead | Primary findings | Outcome |
|------|------------------|---------|
| L01 | Clean founder ROI session | Score + route |
| L02 | Clean ICP builder | Score + route |
| L03 | Clean profile optimizer | Score + route |
| L04 | Clean battle card | Score + route |
| L05 | Empty tool_input + tool_output | `incomplete_session` |
| L06 | Clean posting rhythm (consumer ICP → score discount) | Typically Warm |
| L07 | test/test/test@test.com + `asdf` | `test_entry` → not_a_fit |
| L08 | Clean founder presence | Score + route |
| L09 | Final-year B.Tech student, no company | `non_buyer` → not_a_fit |
| L10 | Clean case study | Score + route |
| L11 | Same email as L03 (Karan / BrightForge) | `duplicate_contact` — **kept** |
| L12 | Clean DM angles | Score + route |
| L13 | Clean ICP / payments | Score + route |
| L14 | Open to work / looking for SDR role | `non_buyer` → not_a_fit |
| L15 | Marketing manager analyzing CEO presence | Score + route |
| L16 | Ghostwriter founder (adjacent offer) | Score + route (score discount) |
| L17 | Clean lead magnet ideas | Score + route |
| L18 | Empty email | `missing_email` → not_a_fit |
| L19 | “Ignore all previous instructions…” | `prompt_injection` → not_a_fit |
| L20 | Clean ROI calculator (AED) | Score + route |

## Idempotency

- Re-importing the same CSV produces the same `idempotency_key` per row.
- Persistence adapter upserts on `idempotency_key` (proposed schema).
- Duplicate **contacts** are not collapsed: L03 and L11 are two tool sessions.
