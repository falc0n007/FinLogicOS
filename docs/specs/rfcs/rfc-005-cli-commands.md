# RFC-005 — New CLI Command Groups: install, verify, registry, profile, journal

**Status:** PROPOSED  
**Author:** backend-engineer  
**Affects:** `packages/cli/src/index.js` + new command modules  
**Depends on:** RFC-002 (registry schema), RFC-004 (profile isolation)  
**Version:** 1.0.0

---

## Summary

Adds five new top-level command groups to `packages/cli/src/index.js` via Commander.js. Each group is implemented as a dedicated command module under `packages/cli/src/commands/`.

---

## Command Groups

### 1. `finlogic install <pack-id>`

Single command (not a subcommand group).

```javascript
program
  .command('install <pack-id>')
  .description('Install a model pack from the community registry')
  .option('--dir <path>', 'install to custom directory instead of packages/models/')
  .option('--skip-verify', 'skip hash verification (shows warning, requires confirmation)')
  .option('--dry-run', 'show what would be installed without writing files')
  .action(async (packId, opts) => {
    const { installCommand } = require('./commands/install');
    await installCommand(packId, opts, chalk);
  });
```

### 2. `finlogic verify [pack-id]`

Single command. Verifies one or all installed packs.

```javascript
program
  .command('verify [pack-id]')
  .description('Verify integrity of installed model packs against registry hashes')
  .action(async (packId, opts) => {
    const { verifyCommand } = require('./commands/verify');
    await verifyCommand(packId, opts, chalk);
  });
```

### 3. `finlogic registry`

Subcommand group.

```javascript
const registryCmd = program
  .command('registry')
  .description('Manage the community model pack registry');

registryCmd
  .command('update')
  .description('Fetch the latest registry index from the remote')
  .action(async () => { ... });

registryCmd
  .command('search <query>')
  .description('Search registry by name, tag, or region')
  .option('--region <region>', 'filter by region (e.g. us, uk, global)')
  .option('--category <category>', 'filter by category')
  .option('--verified-only', 'only show verified packs')
  .action(async (query, opts) => { ... });

registryCmd
  .command('list')
  .description('List all installed packs with verification status')
  .action(() => { ... });
```

### 4. `finlogic profile`

Subcommand group.

```javascript
const profileCmd = program
  .command('profile')
  .description('Manage financial profiles');

profileCmd.command('list').description('List all profiles').action(...);
profileCmd.command('show').description('Show the active profile').action(...);
profileCmd.command('create <name>').description('Create a new profile').action(...);
profileCmd.command('select <id>').description('Switch the active profile').action(...);
profileCmd.command('rename <id> <new-name>').description('Rename a profile').action(...);
profileCmd.command('delete <id>').description('Delete a profile and its data').action(...);
```

### 5. `finlogic journal`

Subcommand group.

```javascript
const journalCmd = program
  .command('journal')
  .description('Financial decision journal');

journalCmd.command('list').option('--category <cat>').option('--year <year>').action(...);
journalCmd.command('add').description('Interactively add a journal entry').action(...);
journalCmd.command('show <id>').action(...);
journalCmd.command('export').option('--year <year>').option('--output <path>').action(...);
journalCmd.command('health').option('--year <year>').description('Show Decision Health metric').action(...);
```

---

## Global `--profile` Flag

All commands that interact with the snapshot/journal database must respect a `--profile <id>` global option:

```javascript
program.option('--profile <id>', 'use a specific profile for this command (overrides active profile)');
```

This option is read before command dispatch in the global `.hook('preAction')`:

```javascript
program.hook('preAction', (thisCommand, actionCommand) => {
  const profileId = thisCommand.opts().profile;
  if (profileId) {
    process.env.FINLOGIC_PROFILE_OVERRIDE = profileId;
  }
});
```

Command modules read `process.env.FINLOGIC_PROFILE_OVERRIDE` when resolving the active profile.

---

## New Command Module Files

```
packages/cli/src/commands/install.js
packages/cli/src/commands/verify.js
packages/cli/src/commands/registry.js
packages/cli/src/commands/profile.js
packages/cli/src/commands/journal.js
packages/cli/src/registry-client.js
packages/cli/src/profile-manager-cli.js   ← thin wrapper over @finlogic/core ProfileManager
```

---

## Exit Code Policy

All new commands follow this exit code convention:

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Operational failure (e.g. hash mismatch, profile not found) |
| 2 | Usage error (e.g. unknown pack ID, missing required arg) |
| 3 | Configuration error (e.g. registry not cached) |

---

## Testing Strategy

Each new command module gets a `__tests__/<module>.test.js` file. Tests use:
- `jest.spyOn` to mock filesystem, network, and database operations
- Snapshot assertions for formatted CLI output
- Exit code assertions via `process.exit` mocks

Integration tests (using `better-sqlite3` `:memory:` databases) cover:
- `finlogic journal add` → entry persisted
- `finlogic profile create` + `select` → active profile changes
- `finlogic verify` → detects tampered logic.js
