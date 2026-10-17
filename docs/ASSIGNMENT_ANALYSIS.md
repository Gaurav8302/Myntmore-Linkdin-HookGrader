# Assignment Analysis — Myntmore Systems & AI Automation Intern Round 2

**Source:** Derived from the Round 2 assignment brief (original `.docx` / `.txt` removed from the repository; this analysis remains as the working summary).

---

## Document Structure & Page References

| Section | Pages | Key Content |
|---------|-------|-------------|
| Before You Begin | 1 | Name/Email fields, Guidelines (4 bullets) |
| About Myntmore | 1 | Company context, lead magnet system |
| Resources | 1 | Links: website, tools, product video, services doc, leads.csv |
| The Stack | 1 | Technology stack table |
| The Assignment: 3 Tasks | 2–3 | Task 01, Task 02, Task 03 |
| Ops Judgement | 3 | Questions 3a, 3b with templates |
| Loom Requirements | 3 | 4 required demo segments |
| Evaluation Criteria | 3 | 7 weighted categories |
| One Thing Before You Start | 3 | Read leads.csv first |
| Submission | 3 | Links table, PDF submission |

---

## Technology Stack (Explicit)

| Category | Required Tool | Notes |
|----------|---------------|-------|
| Automation | Make, Zapier, n8n, etc. | General permission |
| AI | Google Gemini (gemini-2.5-flash) | Free API key from Google AI Studio |
| Database | Supabase | |
| Web App | Next.js, GitHub, Vercel | |
| Video | Loom | |

**Critical distinction:** The stack section permits alternatives for automation (Make, Zapier, n8n, etc.), but **Task 02 explicitly names "Make.com webhook"** for the Task 2 → Task 1 connection. This must be flagged, not silently resolved.

---

## Task 01: Lead Follow-Up Engine (Main Task)

### Input
- `leads.csv` (20 fictional tool sessions, attached to email, some rows messy on purpose)
- 9 existing free AI tools on myntmore.com

### Requirements
1. **Import** leads.csv into Supabase table
2. **Build automation** (Make/Zapier/n8n) that:
   - **Cleans data**: Handle duplicates, test entries, non-buyers — record a reason. Never drop a row silently.
   - **Scores each lead 1–10** for fit with one of 4 services (personal branding, LinkedIn outreach, cold email, lead generation) with one-line reason. Explicitly separate rules vs Gemini.
   - **Writes follow-up email** with Gemini using what lead typed + tool returned. Constraints:
     - No jargon or em dashes
     - No invented numbers or claims
     - Under 120 words
     - Only `myntmore.com/founder-meeting` as call link
   - **Routes each lead**: Hot (draft email + alert), Warm (one nurture email drafted), Not a fit (tagged with reason, no email)
3. **Bonus**: Enrich leads with company size, funding, LinkedIn activity. Show on 3 real companies.

### Deliverable for Task 01
- Scoring rules documented with rules vs Gemini split (template provided on page 2)

---

## Task 02: Ship a 10th Free Tool — LinkedIn Hook Grader

### User Flow
1. Landing screen
2. Contact form (name, designation, email)
3. Tool: paste first two lines of LinkedIn post
4. Results screen

### Technical Requirements
- **Next.js on Vercel** — one plain page is enough
- **Scoring engine in code, not AI**: 4–6 explicit rules, score out of 100, deterministic (same hook = same score), one-line reason per failed rule
- **3 rewrites from Gemini** as structured JSON (responseSchema), following Task 01 writing rules
- **Save each session** as one Supabase row: contact, hook, score, rewrites
- **Send to Task 01 scenario through Make.com webhook** (explicit requirement)

---

## Task 03: Ops Judgement (Written, 1 Page Max)

### 3a. Silent Bug
**Scenario:** Leads from Battle Card and Case Study tools reach Zoho CRM but Supabase has none of their sessions. Other 7 tools fine.

**Given code:**
```typescript
constraint leads_source_check check (source in (
  'roi_calculator', 'icp_builder', 'profile_optimizer',
  'dm_angle_generator', 'lead_magnet_ideas',
  'posting_rhythm_builder', 'founder_presence_analyzer'
))

async function saveLead(source: LeadSource, lead: LeadForm) {
  postToZohoForm(source, lead);
  const { data, error } = await supabase
    .from("leads").insert({ source, ...lead }).select().single();
  if (error) console.error("lead insert failed", error);
  return data?.id;
}
```

**Required answer:** What is wrong, how to fix, how to prevent silent failure.

### 3b. AI Search
- Ask ChatGPT, Perplexity, Gemini 5 questions a potential client would ask
- Record: Does Myntmore appear? Position? Who appears instead? 1-line answer. Sources cited. Screenshot.
- Propose 3 website changes with why and which questions they help.

---

## Loom Video Requirements (5–7 minutes, camera on)

Must show in order:
1. Task 01 follow-up engine working: run on leads.csv, show results in Zoho CRM
2. Task 02 Hook Grader working: use like a visitor would
3. How you built it: walk through automation, point out fixed rules vs Gemini
4. What's missing: what doesn't work yet, what you'd fix next

---

## Evaluation Weights (Total 100%)

| Category | Weight | Description |
|----------|--------|-------------|
| End-to-end working | 25% | Task 01 on sample leads, Task 02 lead flowing through Task 01 |
| Follow-up quality | 15% | Personal, follows writing rules |
| Built to reuse | 15% | Easy to add tool/rule, failures visible |
| Hook Grader | 15% | Deployed, consistent score, structured AI output |
| Messy data handling | 10% | Every odd row handled on purpose |
| Judgement (Task 03) | 10% | Answers to 3a, 3b |
| Initiative & communication | 10% | Beyond brief, explained simply |

---

## Submission Requirements

| Item | Required Link |
|------|---------------|
| Loom video | Google Drive (Anyone with link can view) |
| Live Hook Grader URL | Deployed Vercel URL |
| GitHub repo | Public repository |

Submit: PDF copy of filled document, reply to email thread with attachment.

---

## Missing Inputs / Blockers

1. **leads.csv** — Not in repository. Attached to email. Must be obtained from human.
2. **Zoho CRM access** — Required for Task 01 demo and Loom recording. Human must provide.
3. **Make.com account** — Required for Task 02 webhook. Human must authenticate.
4. **Supabase project** — Must be created/linked. Human must provide credentials.
5. **Vercel project** — Must be created/linked. Human must provide.
6. **Gemini API key** — From Google AI Studio. Human must provide.
7. **GitHub repository** — Must be created. Human must create or authorize.
8. **Loom account** — For recording. Human must record.