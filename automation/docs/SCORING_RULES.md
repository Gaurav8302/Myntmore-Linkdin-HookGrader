# Scoring and routing (Task 1)

Service qualification is separate from numeric scoring. See [`QUALIFICATION_RUBRIC.md`](QUALIFICATION_RUBRIC.md) for the seven Myntmore services and NVIDIA usage.

## Split of responsibility

| Concern | Owner | Notes |
|---------|-------|-------|
| Primary / secondary service fit | **Rules** (+ optional NVIDIA on ambiguous ties) | Validated against seven official names |
| Numeric score 1–10 | **Rules only** | Never NVIDIA |
| Hot / Warm / Not-fit | **Rules only** | Score thresholds + hard exclusions |
| Follow-up email draft | **NVIDIA** with validated template fallback | Hot/Warm only; JSON artifact, never sent |
| Email compliance check | **Deterministic validator** | Word count, CTA, no em dashes/jargon/extra URLs |

NVIDIA never sets `score`, `routing_tier`, or hard exclusions.

## Score model

- Start at **5**.
- Apply additive rule deltas (role, company, session richness, B2B signals, discounts).
- Clamp to **1–10**.
- Blocking flags (`test_entry`, `non_buyer`, `prompt_injection`) apply large negative deltas so adversarial text cannot force Hot.

## Routing thresholds

| Tier | Condition | Actions |
|------|-----------|---------|
| Hot | Score ≥ 8 and email-eligible | JSON draft artifact + alert flag |
| Warm | Score 5–7 and email-eligible | One nurture JSON draft |
| Not a fit | Blocking clean flags, incomplete session, or score ≤ 4 | Tag with reason; **no draft** |

## Email writing rules (NVIDIA + validator)

- Under 120 words
- No jargon (synergy/leverage/unlock/game-changer/disrupt)
- No em dashes (`—`)
- No invented numbers/claims beyond tool input/output
- Only CTA: `https://myntmore.com/founder-meeting` (host form `myntmore.com/founder-meeting` also accepted)
- Tool fields treated as untrusted data (injection ignored)
- Persist as JSON with `status: draft_only` and `send_attempted: false`
