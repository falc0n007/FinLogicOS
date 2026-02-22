# RFC-001: Scenario Branch Schema Migration

**Status:** Accepted  
**Author:** backend-engineer  
**Date:** 2026-02-21  
**Implements:** Phase 2 — Scenario Simulation Engine  
**Target file:** `packages/core/src/snapshot.js`

---

## 1. Summary

This RFC specifies the SQLite schema migration that adds scenario branching to the `SnapshotStore`. The migration is non-destructive, backward-compatible, and guarded by SQLite's `PRAGMA user_version` mechanism to ensure it runs exactly once per database file.

---

## 2. Problem Statement

The Phase 1 `SnapshotStore` stores model execution results as flat, independent rows. There is no concept of a "what if" branch: a snapshot derived from another with modified inputs that can be compared side-by-side.

Phase 2 requires:
- A way to fork an existing snapshot into a named scenario branch
- Efficient lookup of all branches for a given parent snapshot
- Safe deletion of scenario rows without cascading to the parent

---

## 3. Schema Changes

### 3.1 New Columns (added to `snapshots` table)

```sql
ALTER TABLE snapshots ADD COLUMN parent_snapshot_id INTEGER REFERENCES snapshots(id);
ALTER TABLE snapshots ADD COLUMN branch_name TEXT;
ALTER TABLE snapshots ADD COLUMN scenario_meta TEXT;  -- JSON: { label, description, created_by }
ALTER TABLE snapshots ADD COLUMN is_scenario INTEGER NOT NULL DEFAULT 0;
```

**Column semantics:**

| Column | Type | Default | Description |
|---|---|---|---|
| `parent_snapshot_id` | INTEGER | NULL | Foreign key to the baseline snapshot this scenario branches from. NULL for baseline snapshots. |
| `branch_name` | TEXT | NULL | Human-readable name for the scenario (e.g. "20% raise"). NULL for baselines. |
| `scenario_meta` | TEXT | NULL | JSON-encoded metadata bag: `{ label, description, created_by }`. Optional. |
| `is_scenario` | INTEGER | 0 | Boolean flag (0 = baseline, 1 = scenario). Default 0 ensures all existing rows are classified as baselines. |

### 3.2 New Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_snapshots_parent_id ON snapshots (parent_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_is_scenario ON snapshots (is_scenario);
```

`idx_snapshots_parent_id` makes `listScenarios(parentId)` efficient (O(log n) lookup).  
`idx_snapshots_is_scenario` makes `listAllScenarios()` efficient when scenarios are a small fraction of all rows.

---

## 4. Migration Guard

The migration is controlled by SQLite's `user_version` PRAGMA, which is stored in the database header and persists across connections.

```javascript
_migrateIfNeeded() {
  const version = this._db.pragma('user_version', { simple: true });
  if (version < 1) {
    this._db.exec(`
      ALTER TABLE snapshots ADD COLUMN parent_snapshot_id INTEGER REFERENCES snapshots(id);
      ALTER TABLE snapshots ADD COLUMN branch_name TEXT;
      ALTER TABLE snapshots ADD COLUMN scenario_meta TEXT;
      ALTER TABLE snapshots ADD COLUMN is_scenario INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_snapshots_parent_id ON snapshots (parent_snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_is_scenario ON snapshots (is_scenario);
    `);
    this._db.pragma('user_version = 1');
  }
}
```

**Why `user_version`?**  
- It is an integer stored in the DB header (not a user table row) — zero chance of collision with application data.  
- Incrementing it is atomic in SQLite.  
- Check is O(1) — no table scan required.

**Version table:**

| user_version | Schema state |
|---|---|
| 0 | Phase 1 schema: original 5 columns only |
| 1 | Phase 2 schema: +4 columns, +2 indexes |

---

## 5. Backward Compatibility

### 5.1 Existing data

All existing rows in a v0 database are unaffected. After migration:
- `parent_snapshot_id` = `NULL` for all old rows
- `branch_name` = `NULL` for all old rows
- `scenario_meta` = `NULL` for all old rows
- `is_scenario` = `0` for all old rows (enforced by `DEFAULT 0`)

### 5.2 Existing API methods

`save()` and `list()` are not modified:
- `save()` inserts with only the original 4 columns; the new columns default correctly.
- `list()` selects only the original 5 columns (`id`, `model_id`, `inputs`, `outputs`, `created_at`), so its return shape is unchanged.

### 5.3 Fresh databases

For a fresh in-memory or new file database:
1. `CREATE TABLE IF NOT EXISTS` creates the v0 schema (5 columns).
2. `_migrateIfNeeded()` detects `user_version = 0`, runs the migration, and sets `user_version = 1`.

This means all new databases are immediately at schema v1.

---

## 6. WAL Mode Compatibility

The `SnapshotStore` constructor enables WAL mode before migration runs:

```javascript
this._db.pragma('journal_mode = WAL');
```

SQLite's `ALTER TABLE ... ADD COLUMN` is compatible with WAL mode. The operation takes an exclusive write lock for the schema change, which is fine for a local-first single-process application.

---

## 7. `deleteScenario` Safety

The `deleteScenario(id)` method uses:

```sql
DELETE FROM snapshots WHERE id = ? AND is_scenario = 1
```

The `AND is_scenario = 1` guard ensures that passing a baseline snapshot's ID to `deleteScenario` is a no-op (no rows deleted, no error thrown). This prevents accidental deletion of baseline data.

There is no `ON DELETE CASCADE` on the foreign key. Deleting a baseline snapshot while child scenario rows still exist leaves orphan rows with a dangling `parent_snapshot_id`. This is intentional: the UI layer is responsible for managing scenario lifecycle (e.g., offering to delete children when a baseline is deleted). The orphan rows remain valid standalone records.

---

## 8. Future Migrations

To add a schema change in a future phase, increment `user_version`:

```javascript
if (version < 2) {
  // Phase 3 migration
  this._db.pragma('user_version = 2');
}
```

Each migration block should be guarded by a strict `< N` check, not `=== N`, so older databases catch up through all versions in a single constructor call.

---

## 9. Acceptance Criteria Coverage

| AC | Status | Notes |
|---|---|---|
| AC-1: Migration runs without error on existing DB | ✅ | Verified by `snapshot-scenarios.test.js` migration suite |
| AC-2: Existing `save()` / `list()` return identical results | ✅ | `list()` selects only original columns; result shape unchanged |
| AC-3: `saveScenario()` correctly links `parent_snapshot_id` | ✅ | Verified by unit test: retrieve by ID and assert FK |
| AC-4: `listScenarios(parentId)` returns only children | ✅ | SQL `WHERE is_scenario = 1 AND parent_snapshot_id = ?` |

---

*See also: [phase-2-scenario-simulation.md](../phases/phase-2-scenario-simulation.md)*
