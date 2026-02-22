# FinLogicOS — Claude Code Session Context

## Project Overview

FinLogicOS is a local-first financial intelligence platform. It allows users to run community-published financial logic model packs entirely on their own machine with no network dependency at runtime. The platform emphasizes privacy, auditability, and extensibility.

---

## Monorepo Structure

```
FinLogicOS/
  packages/
    core/          # @finlogic/core — runtime engine, sandbox, manifest loader, snapshot store
    models/        # @finlogic/models — official curated model packs
    cli/           # @finlogic/cli — command-line interface
    create-model/  # create-finlogic-model — model scaffolding tool
    ui/            # @finlogic/ui — localhost-only web interface
  jest.config.js
  turbo.json
  package.json
  CONTRIBUTING.md
  README.md
```

Workspaces are managed via npm workspaces. Turbo is used for task orchestration across packages.

---

## Key Constraints

These constraints are non-negotiable and must be preserved in all contributions:

- **No network access in models.** The sandbox explicitly blocks all outbound network calls. Model logic must be fully self-contained.
- **Decimal.js for all financial math.** Native JavaScript floating-point arithmetic is not acceptable for monetary or tax calculations. Always import and use `decimal.js`.
- **Pure functions only in logic.js.** Model logic must have no side effects. The same inputs must always produce the same outputs.
- **UI is localhost-only.** The `@finlogic/ui` package must never bind to a public interface. It listens on `127.0.0.1` only.
- **No telemetry.** No usage data, error reports, or any other information is sent off the user's machine.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | JavaScript (Node.js) |
| Monorepo tooling | npm workspaces + Turbo |
| Financial arithmetic | decimal.js |
| Testing | Jest |
| CLI framework | To be confirmed — check `packages/cli/package.json` |
| UI framework | To be confirmed — check `packages/ui/package.json` |
| Manifest format | YAML (`manifest.yaml` per model pack) |
| Sandbox | Node.js VM module or equivalent isolation layer |

---

## How to Run

Install all dependencies from the repo root:

```bash
npm install
```

Run the full test suite:

```bash
npm test
```

Start the development environment (all packages in watch mode):

```bash
npm run dev
```

Run the CLI directly during development:

```bash
node packages/cli/bin/finlogic.js list
node packages/cli/bin/finlogic.js run compound-interest-growth
```

---

## Testing

- Framework: Jest
- Tests are colocated with source files in `__tests__` directories or named `*.test.js`
- Run all tests from the repo root with `npm test`
- Turbo handles running tests per package in dependency order
- All tests must pass before merging any change
- Model packs require tests covering boundary conditions, edge cases, and all logical branches

---

## Common Tasks for Claude Code Sessions

- When adding a new model pack, use `npx create-finlogic-model <name>` to scaffold it, then implement `logic.js` and update `manifest.yaml`.
- When modifying the sandbox, verify that network and filesystem isolation is preserved in tests.
- When updating the CLI, ensure the help output and command signatures stay consistent with the README Quick Start examples.
- When touching shared types or schemas, check all packages that depend on `@finlogic/core` for breakage.
