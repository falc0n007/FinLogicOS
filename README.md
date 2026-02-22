# FinLogicOS

Your local-first operating system for financial logic.

---

## Value Pillars

**Privacy First**
All data stays on your machine. No telemetry, no cloud sync, no external API calls. Your financial logic and inputs never leave localhost.

**Community Models**
Install model packs built and published by the community. Each pack is a self-contained bundle of financial logic you can audit, fork, and extend.

**Open Source**
MIT licensed and fully transparent. Read every line, propose changes, or build your own distribution on top of the platform.

---

## Quick Start

```bash
npm install
npm test
npx finlogic list
npx finlogic run compound-interest-growth
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
