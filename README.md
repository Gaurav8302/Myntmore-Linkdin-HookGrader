# Myntmore Systems & AI Automation Intern — Round 2 Assignment

This repository contains the implementation for the Myntmore Round 2 assignment, organized as two independently deployable applications.

## Structure

```
myntmore-assignment/
├── linkedin-hook-grader/     # Task 2: LinkedIn Hook Grader (Next.js on Vercel)
├── automation/               # Task 1: Lead Follow-up Automation (Make.com/n8n/Zapier)
├── supabase/                 # Shared database migrations
├── docs/                     # Assignment-wide documentation
├── leads.csv                 # Task 1 input data (read-only, do not modify)
├── AGENTS.md                 # Agent ownership and collaboration rules
└── .gitignore
```

## Applications

### Task 2 — LinkedIn Hook Grader (`linkedin-hook-grader/`)
- **Owner**: Cursor (sole active implementer; OpenCode work preserved)
- **Stack**: Next.js 14, TypeScript, Tailwind CSS, Supabase, **NVIDIA NIM**
- **Deployment**: Vercel (project root = `linkedin-hook-grader/`)
- **Key features**:
  - Deterministic hook scoring (6 rules, 0–100)
  - 3 structured NVIDIA rewrites (score is never from the model)
  - Supabase session persistence
  - Durable Make.com webhook delivery (outbox pattern + Vercel Cron)
  - Idempotency keys for Task 1 deduplication

### Task 1 — Lead Follow-up Automation (`automation/`)
- **Owner**: Cursor
- **Stack**: **n8n** (local orchestrator), supporting TypeScript, Supabase, Zoho CRM (draft-only), NVIDIA NIM for email drafts
- **Make.com**: mandatory **Task 2 → Task 1** bridge (n8n may stay local; tunnel required for Make → n8n)
- **Key features**:
  - Import and clean `leads.csv` (20 rows, messy on purpose)
  - Score leads 1–10 for 4 services with reasons
  - Generate follow-up emails with NVIDIA (validated template fallback; drafts only)
  - Route: Hot / Warm / Not a fit

## Shared Requirements

- **Stack**: Next.js, Supabase, NVIDIA NIM, Vercel, Make.com, GitHub, n8n (local)
- **Secrets**: Never committed. Use `.env.example` placeholders. Never put API keys in `NEXT_PUBLIC_*`.
- **Gemini**: abandoned after observed 404/quota — see `docs/AI_PROVIDER_FAILURES.md`
- **Make.com bridge**: Hook Grader → Make → n8n Task 1
- **Loom demo**: 5–7 minutes, camera on, 4 segments
- **Submission**: PDF with Loom link, live URL, GitHub repo
- **Live URL**: set after Vercel deploy (update this line with the production URL)

## Documentation

| Location | Contents |
|----------|----------|
| `/docs/` | Assignment analysis, acceptance criteria, implementation plan, agent handoff, tooling inventory, project memory |
| `/linkedin-hook-grader/docs/` | Hook Grader architecture, API contract, scoring specification |
| `/automation/docs/` | Task 1 workflow docs (Cursor-managed) |

## Getting Started

Each application has its own `package.json`, dependencies, and README. See the respective directory for setup instructions.

## Agent Boundaries

See `AGENTS.md` and `docs/AGENT_HANDOFF.md`. Cursor owns both apps and the Make.com bridge. Completion priorities: `docs/COMPLETION_PLAN.md`.