# leads.csv vs .gitignore — resolved

## Facts (verified 2026-10-17)

- Assignment expects the fictional `leads.csv` in the **public GitHub submission**.
- Root `.gitignore` does **not** ignore `leads.csv` (comment only under “Assignment specific”).
- `git ls-files leads.csv` shows the file is **tracked**.
- File remains read-only for agents: do not modify lead content.

## Historical note

An earlier draft ignored `leads.csv`. That conflict was fixed by removing the ignore rule and committing the fictional sample. No further `.gitignore` change is required for submission.

## Optional hygiene (not required)

If real PII exports appear later, ignore those instead:

```gitignore
leads.local.csv
leads.production.csv
```
