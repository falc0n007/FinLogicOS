# Contributing to FinLogicOS

Thank you for your interest in contributing. This document covers everything you need to get started.

---

## Contributor Journey

### 1. Fork and Clone the Repo

Fork the repository on GitHub, then clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/FinLogicOS.git
cd FinLogicOS
```

### 2. Install Dependencies

This is a monorepo managed with npm workspaces. Install all dependencies from the root:

```bash
npm install
```

### 3. Create a Feature Branch

Branch off of `main` using a descriptive name:

```bash
git checkout -b feat/my-feature
```

Use the `feat/` prefix for new features, `fix/` for bug fixes, and `docs/` for documentation changes.

### 4. Make Changes and Write Tests

Implement your changes. Every non-trivial change should include tests. Tests live alongside source files in `__tests__` directories or in files named `*.test.js`.

If you are contributing a model pack, see the Model Pack Development Guide below.

### 5. Run Tests

Run the full test suite from the repo root before pushing:

```bash
npm test
```

All tests must pass before a pull request can be merged. New code should not reduce overall test coverage.

### 6. Open a Pull Request

Push your branch to your fork and open a pull request against `main` on the upstream repository. Fill in the pull request template completely, including a description of what changed and why, and a note on how you tested the change.

---

## Model Pack Development Guide

Model packs are the primary extension point for FinLogicOS. Use the official scaffolding tool to create a new pack:

```bash
npx create-finlogic-model my-model-name
```

This generates the following structure:

```
my-model-name/
  manifest.yaml   # Pack metadata, input schema, output schema
  logic.js        # Pure function implementing the calculation
  logic.test.js   # Jest tests for the logic
  README.md       # Human-readable explanation of the model
```

**Rules for model packs:**

- `logic.js` must export a single default function that accepts an inputs object and returns an outputs object.
- The function must be pure: no side effects, no network calls, no filesystem access.
- All decimal arithmetic must use `decimal.js`. Do not use native JavaScript floating-point arithmetic for financial calculations.
- The input and output shapes must exactly match the schemas declared in `manifest.yaml`.
- Tests must cover all tax brackets, edge cases, and boundary conditions relevant to the model.

Once your pack is ready, publish it to npm under the `finlogic-model-` prefix so that the community can discover and install it:

```bash
npm publish --access public
```

---

## Code Style

This project uses ESLint and Prettier for consistent formatting.

Run the linter:

```bash
npm run lint
```

Run the formatter:

```bash
npm run format
```

Both tools are configured at the repo root. Do not disable lint rules inline unless you include a comment explaining why.

---

## Commit Conventions

This project follows the Conventional Commits specification. Every commit message must have a structured prefix:

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

Common types:

| Type | When to use |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `test` | Adding or updating tests |
| `refactor` | Code change that is neither a fix nor a feature |
| `chore` | Maintenance tasks, dependency updates |

Examples:

```
feat(cli): add --json flag to run command
fix(core): handle missing manifest version field gracefully
docs(contributing): add model pack development guide
```

Commits that do not follow this format will fail the commit message lint check.
