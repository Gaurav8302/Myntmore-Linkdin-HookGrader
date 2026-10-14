# leads.csv vs .gitignore conflict

## Facts

- Assignment expects the fictional `leads.csv` in the **public GitHub submission**.
- Root `.gitignore` currently contains `leads.csv` (line ~56).
- File exists on disk with 20 fictional rows and is used by Task 1.
- Cursor must not modify root `.gitignore` without approval.

## Smallest safe correction (proposed)

In root `.gitignore`, **remove** the `leads.csv` line under “Assignment specific”, OR replace it with a comment:

```gitignore
# leads.csv is fictional assignment data and MUST be committed for submission.
# Do not ignore it.
```

Optionally keep ignoring real PII exports if any:

```gitignore
leads.local.csv
leads.production.csv
```

## Approval needed

Please approve the root `.gitignore` one-line change. Cursor will not apply it until then.
