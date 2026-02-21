# RFC-004 — Profile Isolation Architecture

**Status:** PROPOSED  
**Author:** backend-engineer  
**Affects:** `packages/core/src/snapshot.js`, new `packages/core/src/profile-manager.js`, CLI, UI  
**Depends on:** RFC-001, RFC-003  
**Version:** 1.0.0

---

## Summary

Introduce a per-profile SQLite database model. Each profile has its own `snapshots.db` file under `~/.finlogicos/profiles/{profileId}/`. A `profiles.json` manifest tracks all profiles and the active selection. This is a breaking change to the default db path but includes a one-time migration for existing installations.

---

## Motivation

Phase 6 requires full data isolation between profiles. The simplest and most auditable approach is one SQLite file per profile. This eliminates any possibility of cross-profile data leakage and makes backup/export/delete trivially simple (it's one file).

---

## New Directory Layout

```
~/.finlogicos/
  profiles.json                 ← NEW: profile registry
  snapshots.db                  ← LEGACY: present only during transition period
  profiles/
    default/
      snapshots.db              ← per-profile db (all tables: snapshots, journal)
    {profileId}/
      snapshots.db
```

---

## Legacy Migration (one-time, on upgrade)

Detection condition: `~/.finlogicos/snapshots.db` exists AND `~/.finlogicos/profiles.json` does NOT exist.

Migration steps:
1. Create `~/.finlogicos/profiles/default/` directory
2. Copy `snapshots.db` → `profiles/default/snapshots.db`
3. Write `profiles.json` with `active_profile_id: "default"`
4. Rename legacy `snapshots.db` → `snapshots.db.backup-pre-v0.2` (preserved for one release)

Migration is performed by `ProfileManager` constructor.

---

## `SnapshotStore` Path Contract Change

Before Phase 6:
```javascript
new SnapshotStore('~/.finlogicos/snapshots.db')
```

After Phase 6 (CLI integration):
```javascript
const pm = new ProfileManager();
const dbPath = pm.getDbPath(pm.getActiveProfile().id);
new SnapshotStore(dbPath);
```

The `SnapshotStore` class itself is unchanged — it still accepts an arbitrary `dbPath`. Profile resolution is the caller's responsibility.

---

## Profile ID Rules

- Must match `/^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/` (kebab-case, 2–50 chars)
- `default` is reserved for the initial profile
- `household` is reserved for the household consolidation virtual profile
- IDs are immutable after creation (rename only changes `display_name`)

---

## Security Constraints

1. Profile db paths must be under `~/.finlogicos/profiles/`. Path traversal is rejected.
2. The household profile db is read-only from the user perspective (no model runs write to it directly).
3. CLI and UI must never expose raw SQLite file paths in error messages visible to users.

---

## UI LocalStorage Isolation

UI input cache keys must include profile ID:

| Current | Phase 6 |
|---|---|
| `finlogic-inputs-{modelId}` | `finlogic-{profileId}-inputs-{modelId}` |
| `finlogic-active-model` | `finlogic-{profileId}-active-model` |

The active profile ID is stored under the global key `finlogic-active-profile-id` (not namespaced, since it's cross-profile).

---

## Testing Requirements

- [ ] Legacy migration: copy + profiles.json creation + backup file preserved
- [ ] ProfileManager constructor on fresh install: creates `default` profile
- [ ] `getDbPath()` rejects path traversal attempts
- [ ] Two profiles have zero shared data: write snapshot to profile A, list from profile B returns empty
- [ ] `deleteProfile()` removes the profile directory and db file
- [ ] `deleteProfile()` blocked when only one profile exists
- [ ] `SnapshotStore` constructed with profile-resolved path passes all existing tests
