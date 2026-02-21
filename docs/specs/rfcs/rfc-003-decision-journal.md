# RFC-003 — Decision Journal Storage Migration

**Status:** PROPOSED  
**Author:** backend-engineer  
**Affects:** `packages/core/src/snapshot.js`, new `packages/core/src/journal.js`  
**Depends on:** RFC-001 (user_version pattern established)  
**Version:** 1.0.0

---

## Summary

Add a `journal_entries` table to the existing `SnapshotStore` SQLite database via a `user_version = 2` migration. This co-locates financial decision journal data with snapshot data, simplifying backup, export, and profile isolation.

---

## Motivation

Phase 5 requires a journal that links user decisions to model run evidence (snapshot IDs). Co-locating both in the same database enables FK integrity, atomic export, and a single file to back up per profile.

---

## Schema Addition

```sql
CREATE TABLE IF NOT EXISTS journal_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id      TEXT    NOT NULL DEFAULT 'default',
  entry_date      TEXT    NOT NULL,
  category        TEXT    NOT NULL,
  title           TEXT    NOT NULL,
  amount          REAL,
  amount_currency TEXT    NOT NULL DEFAULT 'USD',
  notes           TEXT,
  outcome         TEXT,
  snapshot_id     INTEGER REFERENCES snapshots(id),
  playbook_report_id TEXT,
  tags            TEXT    NOT NULL DEFAULT '[]',
  deleted_at      TEXT,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_journal_profile_date
  ON journal_entries (profile_id, entry_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_journal_category
  ON journal_entries (category)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_journal_snapshot
  ON journal_entries (snapshot_id);

PRAGMA user_version = 2;
```

---

## Migration Guard Update

```javascript
if (version < 2) {
  this._db.transaction(() => {
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS journal_entries ( ... );
      CREATE INDEX ...;
      PRAGMA user_version = 2;
    `);
  })();
}
```

---

## Soft Delete

Journal entries are soft-deleted (set `deleted_at` timestamp) rather than hard-deleted. This preserves audit trails and allows a future "undo" feature. All `list()` queries filter `WHERE deleted_at IS NULL`.

Hard delete is a separate `purge(id)` method available only via CLI (`finlogic journal purge <id>`), requiring explicit confirmation.

---

## FK Integrity

`snapshot_id` is a nullable FK to `snapshots.id`. Constraints:
- Deleting a snapshot does NOT cascade-delete journal entries. The FK becomes null (the decision log is preserved even if the model run is deleted).
- This is enforced at the application layer since SQLite FK cascade behavior requires explicit `PRAGMA foreign_keys = ON`.

---

## Testing Requirements

- [ ] Migration version 2 runs cleanly after version 1 (scenario columns) has already been applied
- [ ] Migration version 2 runs cleanly on a fresh database (versions 0 → 2 in one call)
- [ ] All scenario API tests still pass after version 2 migration
- [ ] Soft-delete filters are correct (deleted entries hidden from all list queries)
- [ ] FK snapshot_id → null when snapshot is deleted (application-layer nullification test)
