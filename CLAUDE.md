# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FinLogicOS is a local-first financial intelligence platform. Users run community-published financial logic model packs entirely on their own machine with no network dependency at runtime. Emphasizes privacy, auditability, and extensibility.

## Commands

```bash
npm install                  # Install all dependencies (run from repo root)
npm test                     # Run full test suite via Turbo
npm run build                # Build all packages
npm run lint                 # Lint all packages
npm run dev                  # Start all packages in watch mode

# Run tests for a single package
npx turbo run test --filter=@finlogicos/core
npx turbo run test --filter=compound-interest-growth

# Run a single test file directly
npx jest packages/models/compound-interest-growth/logic.test.js
npx jest packages/core/src/__tests__/sandbox.test.js

# CLI during development
node packages/cli/bin/finlogic.js list
node packages/cli/bin/finlogic.js run compound-interest-growth
node packages/cli/bin/finlogic.js validate ./packages/models/my-model
node packages/cli/bin/finlogic.js journal list
node packages/cli/bin/finlogic.js journal add
node packages/cli/bin/finlogic.js profile list
node packages/cli/bin/finlogic.js registry search <query>
node packages/cli/bin/finlogic.js verify

# Scaffold a new model pack
npx create-finlogic-model <name>
```

## Architecture

**Monorepo:** npm workspaces + Turbo. Workspaces: `packages/*`, `packages/models/*`, and `packages/playbooks/*`.

### Core (`packages/core`)
Runtime engine with these modules:
- **sandbox.js** -- Node.js `vm`-based isolation. Blocks all network/FS/timer globals. Injects `Decimal`, `Math`, `JSON`, `Date`, frozen `inputs`, and a restricted `console`. 5s default timeout. Wraps logic in IIFE, then invokes exported function.
- **loader.js** -- Reads `manifest.yaml` (via js-yaml) and `logic.js` (CommonJS require) from a model directory. Required manifest fields: `id`, `name`, `version`, `inputs`, `outputs`. Supports optional `verifyOptions` for registry hash verification.
- **validator.js** -- Validates user inputs against manifest schema (types: number, string, boolean, enum).
- **formatter.js** -- Formats raw outputs for display (currency, percent, integer, decimal). Unwraps Decimal.js instances via `.toNumber()`.
- **snapshot.js** -- SQLite persistence (better-sqlite3) at `~/.finlogicos/snapshots.db`. Supports scenario branching (parent snapshots, branch names, what-if analysis). WAL mode. Schema versioning via `PRAGMA user_version` (v0: base, v1: scenarios, v2: journal_entries).
- **journal.js** -- JournalStore class for financial decision journaling. Supports save/update/soft-delete/list/linkSnapshot/decisionHealth/exportYearMarkdown. Uses the same SQLite DB as snapshots (migration v2).
- **playbook-runner.js** -- PlaybookRunner class that orchestrates running multiple model packs from a playbook manifest. Includes safe expression parser for derived inputs (no eval), condition evaluation, and error handling (abort/warn_and_continue).
- **verifier.js** -- SHA-256 hash verification of installed model packs against registry entries. Uses Node.js built-in crypto.
- **profile-manager.js** -- ProfileManager class for multi-profile support. Each profile gets isolated SQLite database. Handles legacy migration from single-DB layout.

### CLI (`packages/cli`)
Commander.js + Inquirer + Chalk. Commands:
- `list`, `run`, `validate` -- model operations
- `snapshot save`, `snapshot list` -- snapshot management
- `journal list`, `journal add`, `journal show`, `journal health`, `journal export` -- decision journal
- `profile list`, `profile show`, `profile create`, `profile select`, `profile rename`, `profile delete` -- multi-profile
- `registry update`, `registry search`, `registry list` -- community registry
- `install <pack-id>`, `verify [pack-id]` -- pack management
- Global `--profile <id>` flag overrides active profile for any command.

### UI (`packages/ui`)
React 18 + Vite (port 4200, localhost-only). Uses HashRouter. **Important:** The UI does NOT import `@finlogicos/core`. It contains browser-compatible reimplementations of model logic in `src/data/models.js` (no Decimal.js, no CommonJS). This is a separate code path from the sandbox-based CLI execution.

**Routes:**
- `/` -- Dashboard (health score widget, dimensions, actions, quick models)
- `/models` -- ModelBrowser + ModelRunner
- `/scenarios` -- Scenario management + comparison
- `/playbooks` -- Life event playbook library
- `/playbooks/:id` -- Playbook intake form
- `/playbooks/:id/report` -- Playbook results
- `/journal` -- Decision journal list + Decision Health widget
- `/journal/new` -- New journal entry form
- `/journal/:id` -- Entry detail/edit

**Data stores (localStorage-backed):**
- `data/models.js` -- Browser-compatible model registry (1,184+ lines)
- `data/scenarioStore.js` -- Scenario persistence
- `data/journalStore.js` -- Decision journal
- `data/profileStore.js` -- Multi-profile management
- `data/inputCache.js` -- Form input caching

### Model Packs (`packages/models/*`)
Each model has: `manifest.yaml`, `logic.js`, `logic.test.js`, `package.json`, `README.md`. Logic files export a single pure function: `module.exports = function(inputs) { return outputs; }`. All financial math uses `Decimal` (provided by sandbox context, not imported).

**9 model packs:** compound-interest-growth, debt-payoff-calculator, financial-health-score, health-score-explainer, income-change-simulator, relocation-tax-delta, early-debt-payoff-impact, freelance-vs-employed, us-federal-income-tax-2024.

### Playbooks (`packages/playbooks/*`)
Each playbook has: `playbook.yaml`, `README.md`. Playbooks define intake fields, ordered model runs with input mapping, conditions, derived expressions, and report sections. Executed by PlaybookRunner in core.

**4 playbooks:** playbook-home-purchase, playbook-new-child, playbook-freelance-launch, playbook-inheritance.

### Runtime Flow
```
loadModel(dir) -> validateInputs(manifest, inputs) -> sandbox.execute(logic, inputs) -> formatOutput(manifest, outputs) -> SnapshotStore.save()
```

### Playbook Flow
```
PlaybookRunner.run(playbookId, intakeInputs) -> load playbook.yaml -> for each model: evaluate condition -> map inputs (resolve derived expressions) -> loadModel -> sandbox.execute -> compose PlaybookReport
```

## Key Constraints (Non-Negotiable)

- **No network access in models.** Sandbox blocks all outbound calls. Model logic must be self-contained.
- **Decimal.js for all financial math.** Never use native JS floating-point for monetary/tax calculations.
- **Pure functions only in logic.js.** No side effects. Same inputs always produce same outputs.
- **UI is localhost-only.** Must never bind to a public interface (`127.0.0.1` only).
- **No telemetry.** Nothing is sent off the user's machine.
- **Never use emojis in codebase.** Use professional SVG icons instead.
- **Safe expression parser only.** PlaybookRunner derived expressions use a tokenizer -- never eval() or new Function().
- **Profile isolation.** Each profile has its own SQLite database. No shared state between profiles.

## Code Style

- ESLint: `eslint:recommended`, ES2022, Node environment, Jest globals enabled
- Prettier: single quotes, semicolons, 2-space tabs, trailing commas (es5), 100 char print width
- Unused vars warning with `^_` pattern ignored
- Tests colocated: `__tests__/*.test.js` (core) or `logic.test.js` (models)
- Model tests use tolerance-based assertions for financial accuracy

## When Modifying

- **Adding a model:** Scaffold with `npx create-finlogic-model`, implement `logic.js` using `Decimal` global (not imported), update `manifest.yaml` with proper input/output schemas.
- **Changing sandbox:** Verify network/FS isolation is preserved in tests. Check that blocked globals list is complete.
- **Updating CLI:** Keep help output and command signatures consistent with README examples. All DB-touching commands must use `resolveDbPath()` for profile support.
- **Touching core schemas/types:** Check all downstream packages (cli, models, ui) for breakage.
- **Updating model logic:** Remember the UI has separate reimplementations in `packages/ui/src/data/models.js` -- keep them in sync.
- **Adding a playbook:** Create `packages/playbooks/<name>/playbook.yaml` with intake_fields, models, and report_sections. Ensure referenced model packs exist.
- **Changing snapshot schema:** Increment `PRAGMA user_version` in snapshot.js `_migrateIfNeeded()`. Current version: 2.
- **Adding journal features:** JournalStore uses the same SQLite DB as SnapshotStore. Access via `new JournalStore(snapshotStore._db)`.
- **Profile changes:** ProfileManager reads/writes `~/.finlogicos/profiles.json`. Each profile's DB is at `~/.finlogicos/profiles/{id}/snapshots.db`.
