# Phase 6 — Multi-Profile & Household Mode

**Status:** SPEC DRAFT  
**Owner:** backend-engineer + prod-manager  
**Depends on:** All prior phases (profile_id propagates back through all storage layers)  
**Target milestone:** Milestone C  
**Version:** 1.0.0

---

## 1. Overview

Support for multiple financial profiles in a single local FinLogicOS installation. Each profile is fully isolated — its own SQLite database, its own localStorage namespace, its own snapshot/journal/scenario history. An optional household consolidation mode merges two profiles to compute shared financial metrics.

This is valuable for couples, families, and financial advisors running FinLogicOS for multiple clients entirely locally.

This phase delivers:
- Profile manager module in `@finlogic/core`
- CLI profile command suite
- UI profile switcher in the app header
- Profile-aware keying across all storage layers
- Household consolidation mode specification

---

## 2. Profile Storage Architecture

### 2.1 Profile registry file

Profiles are tracked in a single JSON file at `~/.finlogicos/profiles.json`:

```json
{
  "active_profile_id": "default",
  "profiles": [
    {
      "id": "default",
      "display_name": "My Finances",
      "created_at": "2024-01-01T00:00:00Z",
      "color": "#4F8EF7",
      "emoji": "💼",
      "db_path": "~/.finlogicos/profiles/default/snapshots.db"
    },
    {
      "id": "spouse",
      "display_name": "Sarah's Finances",
      "created_at": "2024-06-01T00:00:00Z",
      "color": "#E87040",
      "emoji": "🌱",
      "db_path": "~/.finlogicos/profiles/spouse/snapshots.db"
    }
  ]
}
```

### 2.2 Per-profile directory structure

```
~/.finlogicos/
  profiles.json                    ← profile registry
  profiles/
    default/
      snapshots.db                 ← snapshots + scenarios + journal
    spouse/
      snapshots.db
    household/
      snapshots.db                 ← household consolidation (optional)
```

### 2.3 Migration from single-profile layout

Existing installations have `~/.finlogicos/snapshots.db` at the root. On first upgrade:

1. Detect legacy layout (root `snapshots.db` exists, `profiles.json` does not)
2. Create `profiles/default/` directory
3. Copy (not move) `snapshots.db` to `profiles/default/snapshots.db`
4. Create `profiles.json` with `active_profile_id: "default"`
5. Keep old `snapshots.db` as a backup for one release cycle

---

## 3. `ProfileManager` API

New module: `packages/core/src/profile-manager.js`

```javascript
class ProfileManager {
  constructor(finlogicosDir = '~/.finlogicos')

  /**
   * Returns the currently active profile.
   */
  getActiveProfile(): Profile

  /**
   * Returns all profiles.
   */
  listProfiles(): Profile[]

  /**
   * Creates a new profile and its database directory.
   * @returns {Profile} The new profile
   */
  createProfile(displayName: string, options?: { color, emoji }): Profile

  /**
   * Switches the active profile.
   */
  setActiveProfile(profileId: string): void

  /**
   * Returns the absolute db path for a profile.
   */
  getDbPath(profileId: string): string

  /**
   * Deletes a profile and its database (with confirmation guard).
   * Cannot delete the last remaining profile.
   */
  deleteProfile(profileId: string): void

  /**
   * Renames a profile's display name.
   */
  renameProfile(profileId: string, newDisplayName: string): void
}
```

### 3.1 `Profile` type

```javascript
{
  id: string,           // lowercase kebab-case, e.g. "my-spouse"
  display_name: string,
  created_at: string,   // ISO 8601
  color: string,        // hex color for UI avatar
  emoji: string | null, // optional UI emoji
  db_path: string,      // resolved absolute path
}
```

---

## 4. Storage Layer Profile Isolation

All storage operations (SnapshotStore, JournalStore) are profile-isolated via the database file path. There is no shared state between profiles.

### 4.1 CLI integration

The CLI reads the active profile from `~/.finlogicos/profiles.json` on startup. The `--profile <id>` flag overrides the active profile for a single command.

```javascript
// In packages/cli/src/commands/run.js
const profileManager = new ProfileManager();
const activeProfile = profileManager.getActiveProfile();
const dbPath = profileManager.getDbPath(activeProfile.id);
const store = new SnapshotStore(dbPath);
```

### 4.2 UI integration

The UI does not directly use `SnapshotStore` (it runs models in-browser). Profile isolation in the UI is achieved by namespacing localStorage keys:

```javascript
// Current (single profile)
localStorage.getItem(`finlogic-inputs-${modelId}`)

// Profile-aware (Phase 6)
localStorage.getItem(`finlogic-inputs-${profileId}-${modelId}`)
```

A profile preference is stored in localStorage under `finlogic-active-profile`.

### 4.3 `profileStore.js` (UI)

New file: `packages/ui/src/data/profileStore.js`

```javascript
// Returns active profile ID from localStorage (default: 'default')
export function getActiveProfileId()

// Sets the active profile in localStorage
export function setActiveProfileId(profileId)

// Returns the namespaced key for any storage operation
export function profileKey(baseKey)   // → `${profileId}-${baseKey}`

// Loads profile list from a local manifest file (future: IPC call to CLI)
export function listProfiles()
```

---

## 5. CLI Profile Command Suite

New command module: `packages/cli/src/commands/profile.js`

```
finlogic profile list
finlogic profile show
finlogic profile create <name>
finlogic profile select <id>
finlogic profile rename <id> <new-name>
finlogic profile delete <id>
```

Sample output:

```
$ finlogic profile list

  ACTIVE  ID          DISPLAY NAME         CREATED
  ★       default     My Finances          2024-01-01
          spouse      Sarah's Finances     2024-06-01

$ finlogic profile select spouse
  ✓ Active profile set to: Sarah's Finances

$ finlogic run compound-interest-growth
  [Running as profile: Sarah's Finances]
  ...
```

Add `--profile <id>` global flag to all commands that interact with the database:

```javascript
// packages/cli/src/index.js — global option
program.option('--profile <id>', 'profile to use for this command');
```

---

## 6. UI Profile Switcher

### 6.1 Header component update

Add profile switcher to the right side of `app-header`:

```jsx
<header className="app-header">
  <div className="header-inner">
    <div className="header-brand"> ... </div>
    <ProfileSwitcher />           {/* ← new */}
  </div>
</header>
```

### 6.2 `ProfileSwitcher` component spec

- Avatar: colored circle + emoji (or initials if no emoji)
- Click: dropdown with profile list
- Bottom of dropdown: "+ New Profile" button → profile creation modal
- Active profile shown with a checkmark

### 6.3 Profile creation modal

Fields:
- Display name (required)
- Color picker (6 preset colors)
- Emoji (optional, emoji picker)

On save: creates localStorage namespace for the new profile, switches to it.

---

## 7. Household Consolidation Mode

### 7.1 What household mode does

Household mode creates a read-only "virtual" profile called `household` that merges selected data from two or more profiles. It is a computed view — no data is written to the household DB from model runs; it only aggregates existing snapshots.

### 7.2 Consolidation rules

| Data type | Consolidation method |
|---|---|
| Net worth | Sum of all profiles |
| Monthly income | Sum (for joint tax calculations) |
| Total debt | Sum |
| Savings rate | Weighted average by income |
| Retirement balance | Sum |
| Insurance coverage | Union (either person covered = household covered) |
| Health score | Run `financial-health-score` on combined inputs |
| Journal entries | Merged timeline, source-attributed |

### 7.3 Household setup

```
finlogic household create --profiles default,spouse --name "Our Finances"
finlogic household compute-health-score
```

UI: "Household" section under profile switcher. Shows combined health score + net worth only. Detailed runs are always done per-profile.

### 7.4 Household data isolation policy

- Household DB is read-only from model runs.
- Deleting a member profile prompts: "Remove from household consolidation?" before final deletion.
- No individual profile data is exposed to another profile through household mode (aggregated totals only).

---

## 8. Acceptance Criteria

| # | Criterion | How verified |
|---|---|---|
| AC-1 | Legacy `snapshots.db` migration preserves all existing data | Migration integration test |
| AC-2 | Two profiles have fully isolated SQLite databases | Write to profile A, assert nothing in profile B |
| AC-3 | `--profile <id>` flag overrides active profile for CLI run | Integration test |
| AC-4 | Deleting the last profile is blocked with an error | Unit test |
| AC-5 | UI localStorage keys are namespaced by profile ID | Unit test: switch profiles, assert different cache keys |
| AC-6 | Profile switcher renders all profiles from profileStore | UI render test |
| AC-7 | Household net worth equals sum of member profile net worths | Integration test with two profiles |
| AC-8 | Journal entries from profile A are not visible to profile B | Isolation test |
| AC-9 | `finlogic profile delete` prompts for confirmation | CLI interaction test |
| AC-10 | New profile starts with empty snapshot DB (no data inherited) | Integration test |

---

## 9. File Creation Checklist

- [ ] `packages/core/src/profile-manager.js`
- [ ] `packages/core/src/__tests__/profile-manager.test.js`
- [ ] `packages/core/src/index.js` — export `ProfileManager`
- [ ] `packages/cli/src/commands/profile.js`
- [ ] `packages/cli/src/__tests__/profile.test.js`
- [ ] `packages/cli/src/index.js` — register profile commands + `--profile` global flag
- [ ] `packages/ui/src/data/profileStore.js`
- [ ] `packages/ui/src/components/ProfileSwitcher.jsx`
- [ ] `packages/ui/src/components/ProfileCreationModal.jsx`
- [ ] Update `packages/ui/src/data/inputCache.js` — profile-aware key generation
- [ ] Update `packages/ui/src/App.jsx` — pass profileId through to all stores
- [ ] `docs/specs/rfcs/rfc-004-profile-isolation.md`

---

## 10. Sub-Agent Task Assignments

### backend-engineer tasks
- Implement `ProfileManager` with full API
- Implement legacy migration (root db → profiles/default/db)
- Write all profile manager tests
- Implement CLI profile commands
- Add `--profile` global flag to all DB-touching CLI commands

### prod-manager tasks
- Define maximum profile count (recommendation: no hard limit for local use)
- Write household mode user story (target persona: couple managing joint finances)
- Define what happens when a household member profile is deleted

### generalPurpose tasks
- Write profile color/emoji defaults and accessibility considerations
- Draft household consolidation methodology document (how income and debt are aggregated)

### code-reviewer tasks
- Verify complete data isolation: no shared state between profiles at any layer
- Review household aggregation for correctness (especially savings rate weighted average)
- Confirm migration does not corrupt existing data for users upgrading from v0.1.x

---

*Previous: [phase-5-decision-journal.md](phase-5-decision-journal.md)*  
*Next: [explainability-contract.md](../explainability-contract.md)*
