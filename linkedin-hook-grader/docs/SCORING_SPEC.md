# Scoring Specification — LinkedIn Hook Grader

**Status:** Provisional — part of Task 2 implementation  
**Source:** Derived from `ARCHITECTURE.md` and assignment requirements

---

## Overview

The scoring engine is **deterministic, in-code, and uses no AI**. Same hook input always produces the same score (0–100). The engine applies 6 explicit rules with configurable weights and thresholds.

---

## Rules

| Rule ID | Name | Weight | Description | Pass Condition | Fail Reason (one line) |
|---------|------|--------|-------------|----------------|------------------------|
| R1 | Length | 20% | Optimal character count for two-line hook | 80–160 chars inclusive | "Hook length outside optimal range (80-160 chars)" |
| R2 | Curiosity Gap | 20% | Question mark or curiosity-triggering words | Contains `?` OR any of: how, why, what, secret, mistake, discovered, learned, realized | "No question or curiosity gap detected" |
| R3 | Specificity | 20% | Concrete details: numbers, timeframes, proper nouns, metrics | Contains ≥1 of: digit, timeframe (month/year/week/day), capitalized proper noun, %, $, ₹, AED | "Lacks specific numbers, timeframes, or concrete outcomes" |
| R4 | Authority Signal | 15% | First-person + outcome/claim | Contains (I/we/my/our) AND (achieved/grew/built/scaled/reached/increased/decreased/launched) | "Missing first-person authority signal with outcome" |
| R5 | Action Orientation | 15% | Starts with verb or implies reader action | Starts with verb (imperative) OR contains: here's how, step by step, playbook, roadmap, framework, template | "Not action-oriented; no imperative or reader-focused structure" |
| R6 | Clickbait Penalty | -10% | Penalty for manipulative patterns | NONE of: ALL CAPS word >3 chars, ≥3 exclamation marks, "you won't believe", "shocking", "secret revealed", "doctors hate" | "Clickbait pattern detected" (subtracts 10 points) |

---

## Scoring Algorithm

```typescript
function scoreHook(hook: string): ScoreResult {
  const rules = [
    { id: 'R1', weight: 20, check: lengthRule },
    { id: 'R2', weight: 20, check: curiosityRule },
    { id: 'R3', weight: 20, check: specificityRule },
    { id: 'R4', weight: 15, check: authorityRule },
    { id: 'R5', weight: 15, check: actionRule },
    { id: 'R6', weight: -10, check: clickbaitPenalty }, // negative weight = penalty
  ];

  let score = 0;
  const passedRules: string[] = [];
  const failedRules: string[] = [];

  for (const rule of rules) {
    const passed = rule.check(hook);
    if (passed) {
      score += rule.weight;
      passedRules.push(getPassReason(rule.id));
    } else {
      failedRules.push(getFailReason(rule.id));
    }
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  return { score, passedRules, failedRules };
}
```

---

## Thresholds & Constants

| Constant | Value | Rationale |
|----------|-------|-----------|
| MIN_LENGTH | 80 | Two meaningful lines minimum |
| MAX_LENGTH | 160 | LinkedIn preview truncation ~160 chars |
| CURIOSITY_WORDS | how, why, what, secret, mistake, discovered, learned, realized | Common curiosity triggers |
| TIMEFRAME_PATTERNS | \d+\s*(day|week|month|year)s? | Regex for timeframes |
| PROPER_NOUN_PATTERN | [A-Z][a-z]+(?:\s+[A-Z][a-z]+)* | Capitalized multi-word names |
| CLICKBAIT_CAPS_THRESHOLD | 3 | Words in ALL CAPS longer than this |
| EXCLAMATION_THRESHOLD | 3 | Maximum exclamation marks before penalty |
| CLICKBAIT_PHRASES | you won't believe, shocking, secret revealed, doctors hate, this one trick | Case-insensitive substring match |

---

## Determinism Guarantees

- **No randomness**: No `Math.random()`, no timestamps, no external state
- **No AI**: Pure string matching and regex
- **Same input → same output**: Verified by unit tests (100 identical runs)
- **Configurable**: Weights and thresholds in `lib/scoring/constants.ts` (not hardcoded)

---

## Test Fixtures

| Hook | Expected Score | Expected Failed Rules |
|------|----------------|----------------------|
| "I grew ARR from 0 to 1M in 12 months. Here's how." | ~87 | R2 (no ?) |
| "How I scaled to $1M ARR in 12 months?" | ~100 | None |
| "YOU WON'T BELIEVE THIS SECRET!!!" | ~0 | R1, R2, R3, R4, R5, R6 |
| "Random thoughts on leadership." | ~30 | R2, R3, R4, R5 |
| "3 mistakes I made scaling to 50 employees." | ~85 | R4 (weak authority) |

---

## Output Format

```typescript
interface ScoreResult {
  score: number;           // 0-100 (clamped)
  failedRules: string[];   // One-line reasons for each failed rule
  passedRules: string[];   // Descriptions for transparency
}
```

---

## Integration Notes

- Scoring runs **before** Gemini call
- Failed rules shown to user for transparency
- Score included in webhook payload for Task 1 routing
- Rules are **independent** — can be added/removed without affecting others
- Weights sum to 100% (before penalty); penalty subtracts from total