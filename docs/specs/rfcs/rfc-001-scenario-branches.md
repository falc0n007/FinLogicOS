# RFC-001 — Scenario Branch Storage Migration

**Status:** PROPOSED  
**Author:** backend-engineer  
**Affects:** `packages/core/src/snapshot.js`  
**Depends on:** none  
**Version:** 1.0.0

---

## Summary

Extend the `snapshots` table in `SnapshotStore` to support named scenario branches. This is a non-breaking additive migration using `PRAGMA user_version` as a guard. All existing data and APIs remain unchanged.

---

## Motivation

Phase 2 (Scenario Simulation Engine) requires users to fork existing snapshots into "what if" scenarios with isolated execution results. The current flat `snapshots` table has no parent/child relationship, no naming, and no scenario flag.

---

## Schema Changes

### New columns added to `snapshots`

```sql
ALTER TABLE snapshots ADD COLUMN parent_snapshot_id INTEGER REFERENCES snapshots(id);
ALTER TABLE snapshots ADD COLUMN branch_name TEXT;
ALTER TABLE snapshots ADD COLUMN scenario_meta TEXT;   -- JSON: {label, description}
ALTER TABLE snapshots ADD COLUMN is_scenario INTEGER NOT NULL DEFAULT 0;
```

### New indices

```sql
CREATE INDEX IF NOT EXISTS idx_snapshots_parent_id
  ON snapshots (parent_snapshot_id);

CREATE INDEX IF NOT EXISTS idx_snapshots_is_scenario
  ON snapshots (is_scenario);
```

### `user_version` bump

```sql
PRAGMA user_version = 1;
```

---

## Migration Guard Pattern

```javascript
_migrateIfNeeded() {
  const version = this._db.pragma('user_version', { simple: true });
  if (version < 1) {
    this._db.transaction(() => {
      this._db.exec(`
        ALTER TABLE snapshots ADD COLUMN parent_snapshot_id INTEGER REFERENCES snapshots(id);
        ALTER TABLE snapshots ADD COLUMN branch_name TEXT;
        ALTER TABLE snapshots ADD COLUMN scenario_meta TEXT;
        ALTER TABLE snapshots ADD COLUMN is_scenario INTEGER NOT NULL DEFAULT 0;
        CREATE INDEX IF NOT EXISTS idx_snapshots_parent_id ON snapshots (parent_snapshot_id);
        CREATE INDEX IF NOT EXISTS idx_snapshots_is_scenario ON snapshots (is_scenario);
        PRAGMA user_version = 1;
      `);
    })();
  }
}
```

Migration runs synchronously inside a transaction. On any error, the transaction rolls back and the database remains at version 0.

---

## Backward Compatibility

- All existing rows acquire `parent_snapshot_id = NULL`, `branch_name = NULL`, `scenario_meta = NULL`, `is_scenario = 0` via SQLite column defaults.
- Existing `save()` and `list()` APIs continue to work without modification.
- New `saveScenario()` and `listScenarios()` methods are additive.

---

## Rollback Strategy

If the migration causes issues, operators can revert by:
1. Stopping the application
2. Dropping the new columns (SQLite ≥ 3.35.0 supports `ALTER TABLE DROP COLUMN`)
3. Setting `PRAGMA user_version = 0`

For earlier SQLite versions: copy data to a new table without the new columns.

---

## Testing Requirements

- [ ] Migration runs cleanly on a fresh database
- [ ] Migration runs cleanly on a database with existing snapshot rows
- [ ] Running migration twice is idempotent
- [ ] All existing `save()` / `list()` unit tests pass after migration
- [ ] New scenario API tests pass
- [ ] Transaction rollback occurs on error (test by mocking `ALTER TABLE` failure)
