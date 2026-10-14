# Agent Boundaries — Myntmore Assignment

This repository contains two applications for the Myntmore Systems & AI Automation Intern Round 2 assignment.

## Ownership (current)

| Agent | Scope |
|-------|--------|
| **Cursor** | Sole active implementation owner for **Task 1** (`/automation/`), **Task 2** (`/linkedin-hook-grader/`), and the **Make.com Task 2 → Task 1 bridge** |
| **OpenCode** | Prior contributor to `linkedin-hook-grader/`. Existing work is to **audit, preserve, and complete** — not rebuild |
| **Human** | Account access, authentication, approval prompts, manual checks, Loom, and submission steps that require the user |

Do **not** run two agents against the same files concurrently.

## Runtime rules

1. **n8n** is the actual Task 1 workflow orchestrator. Supporting TypeScript/CLI may implement rules and dry-runs, but a CLI-only pipeline does **not** satisfy the assignment.
2. **Make.com** is mandatory for Task 2 → Task 1. Do not replace it with direct imports, shared app code, or an n8n-only bridge from Hook Grader.
3. **Shared files** (`/docs/`, `/supabase/`, `/AGENTS.md`, `/README.md`, `/.gitignore`, root config): change deliberately; do not overwrite unapproved work. Shared Supabase migrations and the Hook Grader API contract must be reconciled before applying schema or bridge changes.
4. **Git safety**: no `git add .` / `git add -A`; no commits/pushes/history rewrites without separate authorization; never amend another agent's work.
5. **Secrets**: no API keys, credentials, or real lead data in Git. `.env.example` placeholders only.
6. **Honest reporting**: do not claim live integrations work without evidence.
7. **`leads.csv`**: read-only. Do not modify. Root `.gitignore` currently ignores it — document the smallest fix and wait for Human approval before changing `.gitignore`.

## Document locations

- Assignment-wide: `/docs/`
- Hook Grader (Task 2): `/linkedin-hook-grader/docs/`
- Automation (Task 1): `/automation/docs/`

## Shared resources

- `leads.csv` at repository root — fictional sample data; preserve unchanged.
- `/supabase/` — shared migrations. Coordinate Task 1 `leads` schema with Hook Grader tables before editing.
