# FinLogicOS

![CI](https://github.com/falc0n007/FinLogicOS/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

Financial logic models — tax calculations, compound growth, debt schedules — typically run in black-box SaaS tools that have access to your data but no obligation to explain their math. FinLogicOS runs those models locally, in an auditable sandbox, using community-published packs you can read, verify, and fork.

---

## Key Features

- **Local execution only.** No network calls during model runs. Your inputs never leave your machine.
- **Sandboxed model packs.** Each pack runs in an isolated context with no filesystem or network access outside the pack directory.
- **Auditable by design.** Every model is a plain JavaScript function paired with a YAML manifest. Read the code before you trust the output.
- **Snapshot store.** Every run is saved locally. Replay, diff, and audit any prior calculation.
- **Community extensible.** Publish or install model packs via npm under the `finlogic-model-` prefix.

---

## Quick Start

Install dependencies and run the test suite:

```bash
npm install
npm test
```

List available models:

```bash
npx finlogic list
```

Run a model interactively:

```bash
npx finlogic run compound-interest-growth
```

Pass inputs directly without prompting:

```bash
npx finlogic run compound-interest-growth -i principal=10000 -i rate=0.07 -i years=20
```

Save a snapshot and review it later:

```bash
npx finlogic snapshot save compound-interest-growth
npx finlogic snapshot list
```

Validate a model pack before using or publishing it:

```bash
npx finlogic validate ./my-model-pack
```

---

## How It Works

A model pack is the core unit of FinLogicOS. Each pack contains two files:

- `manifest.yaml` — declares the pack name, version, author, inputs, and outputs
- `logic.js` — a pure JavaScript module that implements the financial calculation

When you run a model, FinLogicOS loads the pack into a sandboxed execution context with no network access and no filesystem access outside the pack directory. Inputs are validated against the manifest schema before execution. Results are written to a local snapshot store so you can replay, diff, and audit any prior calculation.

```
User Input -> Manifest Validation -> Sandboxed Execution -> Snapshot Storage -> Output
```

To create a new model pack, use the scaffolding tool:

```bash
npx create-finlogic-model my-model-name
```

This generates a `manifest.yaml`, a `logic.js` pure function, a `logic.test.js` test file, and a `README.md`. Publish to npm under the `finlogic-model-` prefix so the community can discover and install it.

---

## Packages

| Package | Description |
|---|---|
| `@finlogic/core` | Runtime engine: sandbox, manifest loader, snapshot store, and validation |
| `@finlogic/models` | Official curated model packs maintained by the FinLogicOS project |
| `@finlogic/cli` | Command-line interface for listing, running, and managing model packs |
| `create-finlogic-model` | Scaffolding tool for bootstrapping a new model pack with tests and manifest |
| `@finlogic/ui` | Local web interface (localhost only) for running models and browsing snapshots |

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

---

## License

MIT
