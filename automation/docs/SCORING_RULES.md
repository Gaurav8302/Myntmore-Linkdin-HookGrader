# Scoring Rules vs Gemini

## Split of responsibility

| Concern | Owner | Notes |
|---------|-------|-------|
| Service selection (1 of 4) | **Deterministic rules** | Mapped from `source_tool` |
| Numeric score 1–10 | **Deterministic rules** | Pure functions; same input → same score |
| One-line `score_reason` | **Rules** | Built from top rule drivers |
| Follow-up email draft | **Gemini** (assignment: `gemini-2.5-flash`; override via `GEMINI_MODEL` when that model is unavailable — e.g. `gemini-3.8-flash`) | Only after routing says draft required; validated template fallback on failure |
| Email compliance check | **Deterministic validator** | Word count, CTA, no em dashes/jargon/extra URLs |
| Template fallback draft | **Rules** | Used when Gemini missing/invalid |

Gemini never sets `score`, `service`, or `routing_tier`.

## Service mapping

| Source tool | Service |
|-------------|---------|
| `profile_optimizer`, `founder_presence_analyzer`, `posting_rhythm_builder` | `personal_branding` |
| `dm_angle_generator`, `roi_calculator` | `linkedin_outreach` |
| `battle_card_generator` | `cold_email` |
| `icp_builder`, `lead_magnet_ideas`, `case_study_generator` | `lead_generation` |
| Unknown tool | `lead_generation` (default) |

## Score model

- Start at **5**.
- Apply additive rule deltas (role, company, session richness, B2B signals, discounts).
- Clamp to **1–10**.
- Blocking flags (`test_entry`, `non_buyer`, `prompt_injection`) apply large negative deltas so adversarial text cannot force Hot.

## Routing thresholds

| Tier | Condition | Actions |
|------|-----------|---------|
| Hot | Score ≥ 8 and email-eligible | Draft email + alert flag |
| Warm | Score 5–7 and email-eligible | One nurture draft |
| Not a fit | Blocking clean flags, incomplete session, or score ≤ 4 | Tag with reason; **no email** |

## Email writing rules (Gemini + validator)

- Under 120 words
- No jargon (synergy/leverage/unlock/game-changer/disrupt)
- No em dashes (`—`)
- No invented numbers/claims beyond tool input/output
- Only CTA: `myntmore.com/founder-meeting`
- Tool fields treated as untrusted data (injection ignored)
