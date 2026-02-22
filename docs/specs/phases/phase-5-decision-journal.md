# Phase 5 — Financial Decision Journal

**Status:** SPEC DRAFT  
**Owner:** backend-engineer + prod-manager  
**Depends on:** Phase 2 (extended SnapshotStore), Phase 3 (playbook report IDs)  
**Target milestone:** Milestone C  
**Version:** 1.0.0

---

## 1. Overview

A local SQLite-backed journal where users log financial decisions with context. Each entry can be optionally linked to a model run snapshot so the math behind the decision is preserved alongside the record. In three years, the user can look back and see exactly why they made a choice and which model they ran to support it.

This is financial memory — the only tool that links decisions to the reasoning and evidence behind them.

This phase delivers:
- Journal storage contract and SQLite migration
- `JournalStore` API in `@finlogic/core`
- `Decision Health` metric definition and computation
- UI: journal list, create/edit, linkage from `ResultsDisplay`
- CLI: journal entry commands
- Yearly export to Markdown

---

## 2. Storage: Journal Schema Migration

### 2.1 Migration RFC: `rfc-003-decision-journal.md`

See `docs/specs/rfcs/rfc-003-decision-journal.md` for the full migration spec.

### 2.2 New table: `journal_entries`

The journal lives in the same SQLite database as snapshots (`~/.finlogicos/snapshots.db`), making export, backup, and profile isolation trivial.

```sql
CREATE TABLE IF NOT EXISTS journal_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id      TEXT    NOT NULL DEFAULT 'default',
  entry_date      TEXT    NOT NULL,              -- ISO 8601 date string
  category        TEXT    NOT NULL,              -- enum: see categories
  title           TEXT    NOT NULL,
  amount          REAL,                          -- optional monetary amount
  amount_currency TEXT    NOT NULL DEFAULT 'USD',
  notes           TEXT,                          -- free-form decision rationale
  outcome         TEXT,                          -- optional: what happened as a result
  snapshot_id     INTEGER REFERENCES snapshots(id),  -- optional model run linkage
  playbook_report_id TEXT,                       -- optional playbook run ID
  tags            TEXT    NOT NULL DEFAULT '[]', -- JSON array of tag strings
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_journal_profile_date ON journal_entries (profile_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_category ON journal_entries (category);
CREATE INDEX IF NOT EXISTS idx_journal_snapshot ON journal_entries (snapshot_id);
```

### 2.3 Decision categories

```javascript
const DECISION_CATEGORIES = [
  'savings',           // Emergency fund, savings account contributions
  'debt',              // Debt payoff, refinancing decisions
  'investment',        // Buy/sell/rebalance decisions
  'insurance',         // Policy changes, new coverage
  'tax',               // Tax moves (Roth conversion, HSA contribution, etc.)
  'housing',           // Rent/buy, refinance, sale
  'income',            // Job change, raise, freelance launch
  'retirement',        // 401k/IRA contribution changes, rollover
  'estate',            // Will, trust, beneficiary updates
  'major_purchase',    // Car, appliance, travel
  'business',          // Business formation, investment, sale
  'other',
];
```

### 2.4 Migration guard

This migration runs on SnapshotStore construction via `PRAGMA user_version` check. Version 2 adds the journal table.

```javascript
_migrateIfNeeded() {
  const version = this._db.pragma('user_version', { simple: true });
  if (version < 1) { /* ... scenario columns ... */ }
  if (version < 2) {
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS journal_entries ( ... );
      CREATE INDEX ...;
      PRAGMA user_version = 2;
    `);
  }
}
```

---

## 3. `JournalStore` API

New class in `packages/core/src/journal.js`.

```javascript
class JournalStore {
  constructor(db)   // Accepts an already-open better-sqlite3 Database instance

  /**
   * Creates a new journal entry.
   * @returns {number} New entry ID
   */
  save(entry: JournalEntry): number

  /**
   * Updates an existing entry. Only non-null fields in updates are changed.
   */
  update(id: number, updates: Partial<JournalEntry>): void

  /**
   * Soft-deletes an entry (sets deleted_at). Does not remove the row.
   */
  delete(id: number): void

  /**
   * Lists journal entries for a profile, newest first.
   * Optional filters: category, dateFrom, dateTo, hasSnapshot, tags
   */
  list(profileId: string, filters?: JournalFilters): JournalEntry[]

  /**
   * Fetches a single entry by ID.
   */
  getById(id: number): JournalEntry | null

  /**
   * Links a journal entry to a snapshot ID.
   */
  linkSnapshot(entryId: number, snapshotId: number): void

  /**
   * Computes the Decision Health metric for a profile over a date range.
   */
  decisionHealth(profileId: string, dateFrom?: string, dateTo?: string): DecisionHealthReport
}
```

### 3.1 `JournalEntry` type

```javascript
{
  id: number,
  profile_id: string,
  entry_date: string,          // YYYY-MM-DD
  category: string,
  title: string,
  amount: number | null,
  amount_currency: string,
  notes: string | null,
  outcome: string | null,
  snapshot_id: number | null,
  playbook_report_id: string | null,
  tags: string[],
  created_at: string,
  updated_at: string,
}
```

---

## 4. Decision Health Metric

### 4.1 Definition

Decision Health measures the percentage of major financial decisions that had a model run to support them.

```
Decision Health = (entries with snapshot_id linked / total entries) * 100
```

Rounded to nearest integer, displayed as a percentage.

### 4.2 `DecisionHealthReport` type

```javascript
{
  score_pct: number,                    // 0-100
  total_decisions: number,
  decisions_with_model_evidence: number,
  decisions_without_model_evidence: number,
  by_category: {
    [category: string]: {
      total: number,
      with_evidence: number,
      score_pct: number
    }
  },
  date_range: { from: string | null, to: string | null },
  trend: Array<{ month: string, score_pct: number }>  // last 12 months
}
```

### 4.3 Score labels

| Range | Label |
|---|---|
| 80–100 | Evidence-based |
| 60–79 | Mostly tracked |
| 40–59 | Partially tracked |
| 0–39 | Untracked |

---

## 5. Yearly Export

### 5.1 Export format

A Markdown file named `finlogic-decisions-{year}.md` containing:

```markdown
# Financial Decision Journal — 2025
Generated by FinLogicOS on 2026-01-15

## Summary
- Total decisions logged: 24
- Decision Health score: 79% (Mostly tracked)
- Total amount tracked: $47,200

## By Category
### Debt (6 decisions)
...

## Full Journal
### 2025-11-20 — Refinanced Mortgage
Category: housing | Amount: $340,000
Model run: mortgage-refinance-savings v1.0.0 (snapshot #42)

Notes:
Locked in 6.2% rate, down from 7.1%. Saves $187/month.

Model evidence:
- Monthly savings: $187
- Break-even month: 28
- Total interest savings: $23,450
...
```

### 5.2 CLI export command

```
finlogic journal export [--year 2025] [--profile default] [--output ./my-decisions.md]
```

### 5.3 UI export

"Export Year Review" button in the journal view generates and downloads the Markdown file via browser download API.

---

## 6. UI Spec

### 6.1 Navigation

```
/journal             → Journal entry list
/journal/new         → New entry form
/journal/:id         → Entry detail / edit
```

### 6.2 Journal list (`/journal`)

- Chronological list of entries (newest first)
- Row: date, category badge, title, amount (if set), model evidence indicator (chain icon if linked)
- Filter bar: category, date range, "has model evidence" toggle
- Decision Health score card at top of page
- "New Entry" button

### 6.3 New entry form (`/journal/new`)

Fields:
- Date (required, default today)
- Category (required, select from enum)
- Title (required, text)
- Amount (optional, currency)
- Notes (optional, textarea — "Why did you make this decision?")
- Link model run (optional, opens snapshot picker)
- Tags (optional, tag input)

### 6.4 Model run linkage

In `ResultsDisplay.jsx`, after a model run completes, show a "Log this decision" button. It pre-opens the new journal entry form with:
- `snapshot_id` pre-filled
- Category inferred from model category
- Key outputs summarized in the notes field pre-fill

### 6.5 Entry detail (`/journal/:id`)

- All entry fields (read mode, edit button)
- If linked to snapshot: inline model run output summary with full explainability block
- Outcome field (add result after the fact: "Ended up saving $X" or "Bad call — should have waited")
- Delete button (with confirmation)

---

## 7. CLI Commands

Add to `packages/cli/src/index.js`:

```
finlogic journal list [--profile default] [--category debt] [--year 2025]
finlogic journal add                    ← interactive prompts via inquirer
finlogic journal show <id>
finlogic journal export [--year 2025]
finlogic journal health [--year 2025]   ← show Decision Health metric
```

---

## 8. Acceptance Criteria

| # | Criterion | How verified |
|---|---|---|
| AC-1 | Journal table migration runs without error on existing DB | Migration integration test |
| AC-2 | `save()` returns new entry ID | Unit test |
| AC-3 | `list()` filters by category correctly | Unit test |
| AC-4 | `linkSnapshot()` updates snapshot_id FK | Unit test: link, fetch, assert |
| AC-5 | `decisionHealth()` returns correct score_pct | Unit test: 3 of 5 entries linked = 60% |
| AC-6 | Decision Health trend covers last 12 months | Unit test with varied dates |
| AC-7 | Yearly export includes all entries and model evidence summaries | Integration test: create entries, export, parse markdown |
| AC-8 | "Log this decision" button in UI pre-fills journal form from run context | UI state test |
| AC-9 | Deleting a journal entry does not delete the linked snapshot | Integrity test |
| AC-10 | Journal entries are profile-scoped (profile A cannot see profile B entries) | Multi-profile isolation test (Phase 6) |

---

## 9. File Creation Checklist

- [ ] `packages/core/src/journal.js` — JournalStore class
- [ ] `packages/core/src/__tests__/journal.test.js`
- [ ] `packages/core/src/index.js` — export `JournalStore`
- [ ] Update `packages/core/src/snapshot.js` — integrate migration version 2
- [ ] `packages/cli/src/commands/journal.js`
- [ ] `packages/cli/src/__tests__/journal.test.js`
- [ ] `packages/cli/src/index.js` — register journal commands
- [ ] `packages/ui/src/components/DecisionJournal.jsx`
- [ ] `packages/ui/src/components/JournalEntryForm.jsx`
- [ ] `packages/ui/src/components/JournalEntryDetail.jsx`
- [ ] `packages/ui/src/components/DecisionHealthWidget.jsx`
- [ ] `packages/ui/src/data/journalStore.js` — UI-side journal state (calls core via IPC or mirrors localStorage)
- [ ] Update `packages/ui/src/components/ResultsDisplay.jsx` — add "Log this decision" button
- [ ] Update `packages/ui/src/App.jsx` — add journal routes
- [ ] `docs/specs/rfcs/rfc-003-decision-journal.md`

---

## 10. Sub-Agent Task Assignments

### backend-engineer tasks
- Implement `JournalStore` class with full API
- Write migration version 2 in snapshot.js
- Implement `decisionHealth()` computation
- Implement markdown export generator
- Write all tests
- Implement CLI journal commands

### prod-manager tasks
- Define which categories are "major" for Decision Health weighting
- Write user story for "outcome" field — how does it change behavior?
- Define yearly review report structure and narrative copy

### generalPurpose tasks
- Write pre-fill templates for "Log this decision" by model category
- Draft the "outcome" field prompts (encourage follow-up logging)

### code-reviewer tasks
- Privacy review: what is stored in journal_entries.notes? Ensure no network path
- Verify soft-delete doesn't expose entries to other profiles after Phase 6

---

*Previous: [phase-4-community-registry.md](phase-4-community-registry.md)*  
*Next: [phase-6-multi-profile.md](phase-6-multi-profile.md)*
