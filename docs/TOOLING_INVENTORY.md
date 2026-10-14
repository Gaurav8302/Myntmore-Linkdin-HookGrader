# Tooling Inventory — Myntmore Assignment

**Audit date:** 2026-10-14  
**Workspace:** `/home/gaurav/Desktop/myntmore assignment`  
**Scope:** All tools required for the assignment (backend + frontend + integrations)  
**Note:** This extends the Cursor-specific inventory with assignment-required external services.

---

## Status Legend

| Label | Meaning |
|-------|---------|
| **Connected / Working** | Authenticated, tested, ready to use in implementation |
| **Configured** | Set up in config files, needs auth/restart to become live |
| **Account Exists** | Human has account, credentials not yet provided to agents |
| **Not Started** | Account creation or setup not yet done |
| **Blocked** | Known issue preventing use |

---

## Development Environment (Cursor + OpenCode)

| Tool | Status | Auth Required | Tested | Notes |
|------|--------|---------------|--------|-------|
| **Cursor IDE** | Connected / Working | — | Yes | Sole active implementer (Task 1 + Task 2 + Make.com) |
| **OpenCode** | Prior contributor | — | Yes | Hook Grader author; work preserved, not concurrent |
| **Git** | Connected / Working | — | Yes | Repo initialized, no commits |
| **GitHub MCP** | Configured | PAT in `~/.cursor/mcp.json` | Yes (API check) | Login: `Gaurav8302` |
| **Context7 MCP** | Configured | Optional API key | No | Remote URL configured |
| **Playwright MCP** | Configured | — | No | `npx @playwright/mcp@latest` |
| **Serena MCP** | Configured | — | No | `serena-agent` 2.0.0 |
| **codebase-memory MCP** | Configured | — | No | Official Cursor install |
| **Frontend Design Skill** | Installed | — | No | Anthropic skill at `~/.cursor/skills/frontend-design/` |
| **Supabase Plugin (Cursor)** | Needs Auth | `mcp_auth` required | No | Enabled in `.cursor/settings.json` |
| **Vercel Plugin (Cursor)** | Needs Auth | `mcp_auth` required | No | Enabled in `.cursor/settings.json` |

---

## Assignment-Required External Services

| Service | Purpose | Status | Auth Method | Credentials Held By | Tested |
|---------|---------|--------|-------------|---------------------|--------|
| **Supabase** | Database (PostgreSQL) | Not Started | Project URL + keys (anon, service_role) | Human | No |
| **Vercel** | Next.js hosting + deploy | Not Started | GitHub OAuth + project link | Human | No |
| **Make.com** | Automation (Task 01 + webhook) | Not Started | Account + scenario + webhook URL | Human | No |
| **Google Gemini (AI Studio)** | AI rewrites (gemini-2.5-flash) | Not Started | API key | Human | No |
| **Zoho CRM** | Lead destination (Task 01) | Not Started | OAuth / API token | Human | No |
| **Loom** | Video recording | Not Started | Account | Human | No |
| **Google Drive** | Submission file sharing | Not Started | Account | Human | No |

---

## Assignment Stack Compliance Check

| Required by Assignment | Status | Notes |
|------------------------|--------|-------|
| Next.js | Planned | Version 14+ with App Router |
| Supabase | Not Started | Human must create project |
| Google Gemini 2.5 Flash | Not Started | Human must provide API key |
| Vercel | Not Started | Human must link GitHub repo |
| Make.com webhook (Task 02) | Not Started | **Explicit requirement** — not Zapier/n8n |
| GitHub | Configured | MCP ready, repo not created |
| Loom | Not Started | Human records |

**Flag:** Assignment stack permits "Make, Zapier, n8n, etc." for automation generally, but **Task 02 explicitly requires "Make.com webhook"** for the Task 2 → Task 1 connection. This distinction is preserved in architecture.

**Durability Requirement:** The Make.com webhook must use durable delivery (outbox pattern + Vercel Cron) with idempotency keys and bounded retries. Fire-and-forget is not acceptable.

---

## Local Development Tooling

| Tool | Version | Installed | Notes |
|------|---------|-----------|-------|
| Node.js | 20+ | Check needed | `node --version` |
| npm/pnpm | Latest | Check needed | `npm --version` |
| TypeScript | 5+ | Via Next.js | |
| Tailwind CSS | 3.4+ | Via Next.js | |
| ESLint | 8+ | Via Next.js | Airbnb config planned |
| Prettier | 3+ | Via Next.js | |
| Jest / Vitest | Latest | Planned | Unit tests |
| Playwright | 1.40+ | Planned | E2E tests |
| Vercel CLI | Latest | Planned | Cron job deployment |

---

## Authentication & Secrets Management

| Secret | Required By | Storage | Rotation |
|--------|-------------|---------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | OpenCode (Task 2) | 1Password → `.env.local` | Per Supabase policy |
| `GEMINI_API_KEY` | OpenCode (Task 2) | 1Password → `.env.local` | Per Google policy |
| `MAKE_WEBHOOK_URL` | OpenCode (Task 2) | 1Password → `.env.local` | N/A |
| `MAKE_WEBHOOK_SECRET` | OpenCode (Task 2) | 1Password → `.env.local` | Rotate if compromised |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cursor (Task 2 frontend) | 1Password → `.env.local` | Per Supabase policy |
| Vercel deploy token | Human (deploy) | Vercel dashboard | N/A |
| GitHub PAT | GitHub MCP | `~/.cursor/mcp.json` (mode 600) | Rotate periodically |

**Policy:** No secrets in repo. No secrets in Loom video. No secrets in screenshots. Human provides via secure channel (1Password share or direct entry).

---

## Testing & Verification Status

| Integration | Test Performed | Result | Evidence |
|-------------|----------------|--------|----------|
| GitHub MCP → API | `GET /user` | ✅ 200 OK | Login `Gaurav8302` |
| Supabase Plugin | Not tested | — | Needs `mcp_auth` |
| Vercel Plugin | Not tested | — | Needs `mcp_auth` |
| Playwright MCP | Not tested | — | Needs Cursor restart |
| Context7 MCP | Not tested | — | Needs Cursor restart |
| Supabase DB connection | Not tested | — | Needs project + keys |
| Vercel deploy | Not tested | — | Needs project + GitHub link |
| Vercel Cron | Not tested | — | Needs project + vercel.json |
| Make.com webhook | Not tested | — | Needs scenario |
| Gemini API | Not tested | — | Needs API key |
| Webhook outbox pattern | Not tested | — | Needs implementation |
| Atomic RPC transaction | Not tested | — | Needs Supabase SQL execution |

---

## Gaps & Required Human Actions

| # | Action | Owner | Blocking |
|---|--------|-------|----------|
| 1 | Create Supabase project, share keys | Human | Phase 0 |
| 2 | Create Vercel project, link GitHub | Human | Phase 0, 4 |
| 3 | Create Make.com account, build Task 01 scenario, generate webhook URL | Human | Phase 0, 3 |
| 4 | Generate Gemini API key (Google AI Studio) | Human | Phase 1 |
| 5 | Provide Zoho CRM access (Task 01) | Human | Phase 1, 5 |
| 6 | Create GitHub repository, add collaborators | Human | Phase 0 |
| 7 | Provide `leads.csv` from email | Human | Phase 0, Task 01 |
| 8 | Complete `mcp_auth` for Supabase & Vercel plugins | Human | Cursor frontend work |
| 9 | Restart Cursor to load MCP servers | Human | All Cursor MCP tools |
| 10 | Record Loom video (5–7 min, camera on) | Human | Phase 5 |
| 11 | Prepare submission PDF with 3 links | Human | Phase 5 |

---

## Verification Checklist (Pre-Implementation)

Before Phase 1 begins, verify:

- [ ] All "Not Started" services above have accounts created
- [ ] All "Configured" Cursor MCPs show green status after restart
- [ ] `leads.csv` obtained and reviewed (per assignment: "read every row before you build")
- [ ] GitHub repo exists and both agents have write access
- [ ] Human has confirmed Make.com (not Zapier/n8n) for Task 02 webhook
- [ ] Environment variable template (`.env.example`) committed to repo at `linkedin-hook-grader/.env.example`
- [ ] `.gitignore` includes `.env.local`, `leads.csv`, `*.log` (root and `linkedin-hook-grader/`)

---

## Reference: Cursor MCP Config (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "codebase-memory-mcp": {
      "command": "/home/gaurav/.local/bin/codebase-memory-mcp",
      "args": []
    },
    "context7": {
      "url": "https://mcp.context7.com/mcp"
    },
    "github": {
      "command": "/home/gaurav/.local/bin/github-mcp-server",
      "args": ["stdio"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    },
    "serena": {
      "command": "/home/gaurav/.local/bin/serena",
      "args": [
        "start-mcp-server",
        "--context",
        "ide",
        "--project-from-cwd"
      ]
    }
  }
}
```

**Project plugins (`.cursor/settings.json`):**
```json
{
  "plugins": {
    "supabase": { "enabled": true },
    "vercel": { "enabled": true }
  }
}
```

---

## Next Steps

1. Human completes all "Gaps & Required Human Actions" items
2. Cursor restarts, authenticates Supabase/Vercel plugins
3. OpenCode indexes project with codebase-memory
4. Phase 0 → Phase 1 transition per `docs/AGENT_HANDOFF.md` and `linkedin-hook-grader/AGENTS.md`