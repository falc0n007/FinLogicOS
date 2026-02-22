# Phase 4 — Community Model Registry & Verified Pack System

**Status:** SPEC DRAFT  
**Owner:** backend-engineer + prod-manager  
**Depends on:** Phase 1–3 (model pack conventions fully established)  
**Target milestone:** Milestone B  
**Version:** 1.0.0

---

## 1. Overview

A local-first model registry that users optionally download. It lists community-contributed model packs with rich metadata: author, version, category, region, community rating, and a SHA-256 hash for integrity verification. The registry is a curated JSON file hosted at a well-known URL but consumed and verified entirely locally.

No model logic is fetched from a network at runtime. The install flow downloads a pack once, verifies it, and writes it to disk. After that, execution is 100% local.

This phase delivers:
- Registry manifest schema and hosting contract
- `finlogic install <pack-id>` CLI command
- `finlogic verify [pack-id]` CLI command
- Pack integrity verification hooks in `@finlogic/core`
- VERIFIED badge governance rubric
- Registry category seed plan

---

## 2. Registry Manifest Schema

### 2.1 Registry index file

The registry is a single JSON file at a deterministic URL:

```
https://registry.finlogicos.dev/registry.json
```

(or a GitHub raw URL for early versions)

### 2.2 `registry.json` schema

```json
{
  "registry_version": "1",
  "updated_at": "2025-01-01T00:00:00Z",
  "packs": [
    {
      "id": "roth-conversion-ladder",
      "name": "Roth Conversion Ladder",
      "version": "1.2.0",
      "description": "Optimal Roth IRA conversion amounts by marginal tax bracket.",
      "author": "jsmith",
      "author_url": "https://github.com/jsmith",
      "category": "retirement",
      "region": ["us"],
      "tags": ["roth", "ira", "tax", "retirement"],
      "license": "MIT",
      "source_url": "https://github.com/jsmith/finlogic-roth-conversion-ladder",
      "download_url": "https://registry.finlogicos.dev/packs/roth-conversion-ladder-1.2.0.tar.gz",
      "manifest_sha256": "abc123...",
      "logic_sha256": "def456...",
      "tarball_sha256": "ghi789...",
      "verified": false,
      "verified_at": null,
      "verified_by": null,
      "community_score": 4.7,
      "download_count": 1243,
      "created_at": "2024-06-01T00:00:00Z",
      "updated_at": "2024-11-15T00:00:00Z"
    }
  ]
}
```

### 2.3 `verified` field rules

A pack may only have `verified: true` if it has passed the full VERIFIED governance rubric (see Section 5). Only maintainers of the FinLogicOS core team may set this field. Community contributors submit for review; review is public.

---

## 3. CLI Commands

### 3.1 `finlogic registry update`

Fetches the latest `registry.json` and caches it locally at `~/.finlogicos/registry.json`.

```
finlogic registry update

Output:
  ✓ Registry updated (1,247 packs available)
  Last updated: 2025-01-15T10:30:00Z
```

### 3.2 `finlogic registry search <query>`

Searches the local registry cache by name, description, tags, region.

```
finlogic registry search roth

Output:
  ID                          NAME                         REGION   VERIFIED
  roth-conversion-ladder      Roth Conversion Ladder       us       ✓
  backdoor-roth-calculator    Backdoor Roth Calculator     us       -
```

### 3.3 `finlogic install <pack-id>`

Downloads, verifies, and installs a pack from the registry.

```
finlogic install roth-conversion-ladder

Step-by-step output:
  1. Looking up roth-conversion-ladder in registry...  ✓
  2. Downloading pack v1.2.0...                        ✓
  3. Verifying tarball SHA-256...                      ✓
  4. Extracting to packages/models/roth-conversion-ladder/...  ✓
  5. Verifying manifest.yaml SHA-256...                ✓
  6. Verifying logic.js SHA-256...                     ✓
  7. Validating manifest schema...                     ✓
  8. Running dry-run test...                           ✓
  ✓ Installed roth-conversion-ladder v1.2.0
    Author: jsmith  |  Verified: ✓  |  License: MIT
```

**Flags:**
- `--dir <path>`: install to custom directory instead of `packages/models/`
- `--skip-verify`: skip hash verification (shows a warning, requires explicit confirmation)
- `--dry-run`: show what would be installed without writing files

### 3.4 `finlogic verify [pack-id]`

Verifies one or all installed model packs against their registry hashes.

```
finlogic verify
finlogic verify roth-conversion-ladder

Output (all packs):
  compound-interest-growth      ✓ verified
  debt-payoff-calculator        ✓ verified
  roth-conversion-ladder        ✗ TAMPERED  (logic.js hash mismatch)
```

**Exit codes:**
- `0`: all verified
- `1`: one or more verification failures
- `2`: registry not available locally (run `registry update` first)

### 3.5 `finlogic registry list`

Lists all installed packs with their verification status.

### 3.6 Command module locations

```
packages/cli/src/commands/install.js       ← new
packages/cli/src/commands/verify.js        ← new
packages/cli/src/commands/registry.js      ← new (handles update/search/list subcommands)
packages/cli/src/registry-client.js        ← new (fetch, cache, search logic)
```

---

## 4. Pack Integrity Verification in `@finlogic/core`

### 4.1 New module: `packages/core/src/verifier.js`

```javascript
/**
 * Verifies the integrity of an installed model pack.
 *
 * @param {string} modelDir - Path to the model pack directory
 * @param {object} registryEntry - Entry from registry.json for this pack
 * @returns {{ valid: boolean, errors: string[] }}
 */
function verifyPack(modelDir, registryEntry)

/**
 * Computes the SHA-256 hash of a file.
 * @param {string} filePath
 * @returns {string} hex digest
 */
function hashFile(filePath)

/**
 * Computes the SHA-256 hash of a tarball stream.
 * @param {Buffer | ReadableStream} data
 * @returns {string} hex digest
 */
function hashBuffer(data)
```

### 4.2 Verification steps

1. Compute SHA-256 of `manifest.yaml`, compare to `registryEntry.manifest_sha256`
2. Compute SHA-256 of `logic.js`, compare to `registryEntry.logic_sha256`
3. If any mismatch: return `{ valid: false, errors: ['manifest.yaml hash mismatch'] }`
4. If no registry entry available: return `{ valid: null, errors: ['Pack not in registry — cannot verify'] }`

### 4.3 Loader integration

The `loadModel()` function in `packages/core/src/loader.js` accepts an optional `verifyOptions` parameter:

```javascript
// Optional: pass registry entry to verify before loading
loadModel(modelDir, { verify: true, registryEntry })
```

If `verify: true` and verification fails, `loadModel` throws with a clear message.

---

## 5. VERIFIED Badge Governance Rubric

A pack earns the `VERIFIED` badge by passing all of the following checks. Reviews are conducted publicly in GitHub issues.

### 5.1 Required criteria

| # | Category | Requirement |
|---|---|---|
| V-1 | Tests | `logic.test.js` exists with minimum 10 test cases |
| V-2 | Tests | All tests pass (`npm test` in pack directory) |
| V-3 | Tests | Boundary conditions covered (zero values, max values) |
| V-4 | Tests | Determinism test: same inputs = same outputs across 50 runs |
| V-5 | Math | All financial arithmetic uses Decimal.js (no native floats) |
| V-6 | Logic | No network calls (sandbox test must pass) |
| V-7 | Logic | No filesystem access (sandbox test must pass) |
| V-8 | Logic | No `require()` calls (pure self-contained function) |
| V-9 | Manifest | All required manifest fields present and correct |
| V-10 | Explainability | `explain` block present in all outputs (see explainability contract) |
| V-11 | Documentation | README.md explains methodology, assumptions, limitations |
| V-12 | Documentation | Data sources cited (for tax rates, benchmark data, etc.) |
| V-13 | Security | Logic reviewed by ≥1 core maintainer for security issues |
| V-14 | Logic audit | Formula verified against authoritative source (IRS pub, academic paper, etc.) |

### 5.2 Review process

1. Contributor submits pack to registry via GitHub PR to `finlogicos/registry`
2. Automated CI runs checks V-1 through V-12
3. Human reviewer completes V-13 and V-14
4. If all pass: `verified: true` is set in registry.json and PR is merged
5. Review comment links to evidence for V-14 (source citation)

---

## 6. Registry Categories (Seed Plan)

The following categories are seeded in the first registry release:

| Category ID | Display name | Target pack count v1 |
|---|---|---|
| `tax-us` | US Tax | 8 |
| `tax-uk` | UK Tax | 4 |
| `tax-ca` | Canada Tax | 4 |
| `tax-in` | India Tax | 4 |
| `retirement-us` | US Retirement | 6 |
| `retirement-global` | Global Retirement | 3 |
| `debt` | Debt Strategies | 5 |
| `investment` | Investment Models | 6 |
| `insurance` | Insurance Gap | 3 |
| `housing` | Housing | 4 |
| `health` | Financial Health | 3 |

---

## 7. Acceptance Criteria

| # | Criterion | How verified |
|---|---|---|
| AC-1 | `finlogic install` downloads, verifies, and writes pack to disk | Integration test with mock server |
| AC-2 | Hash mismatch during install aborts with clear error | Unit test: corrupt tarball |
| AC-3 | `finlogic verify` detects tampered logic.js | Unit test: modify file, run verify, assert failure |
| AC-4 | `finlogic verify` exits 0 for all unmodified packs | Integration test |
| AC-5 | `--skip-verify` requires explicit confirmation prompt | CLI interaction test |
| AC-6 | Registry is consumed entirely from local cache at runtime | Assert no network calls during `run` command |
| AC-7 | `verifyPack()` returns `{ valid: null }` when no registry entry available | Unit test |
| AC-8 | VERIFIED badge criteria checklist passes against `compound-interest-growth` | Manual review gate |
| AC-9 | `finlogic registry search` returns correct results for tag/region queries | Unit test against fixture registry.json |
| AC-10 | CI automated checks cover V-1 through V-12 | CI pipeline test |

---

## 8. File Creation Checklist

- [ ] `packages/core/src/verifier.js`
- [ ] `packages/core/src/__tests__/verifier.test.js`
- [ ] `packages/core/src/index.js` — export `verifyPack`, `hashFile`
- [ ] `packages/cli/src/commands/install.js`
- [ ] `packages/cli/src/commands/verify.js`
- [ ] `packages/cli/src/commands/registry.js`
- [ ] `packages/cli/src/registry-client.js`
- [ ] `packages/cli/src/__tests__/install.test.js`
- [ ] `packages/cli/src/__tests__/verify.test.js`
- [ ] `packages/cli/src/__tests__/registry.test.js`
- [ ] `packages/cli/src/index.js` — register `install`, `verify`, `registry` commands
- [ ] `docs/specs/rfcs/rfc-002-registry-schema.md` — registry schema RFC
- [ ] `CONTRIBUTING.md` — update with VERIFIED badge submission process

---

## 9. Sub-Agent Task Assignments

### backend-engineer tasks
- Implement `verifier.js` (SHA-256 hashing, comparison, error reporting)
- Implement `install.js` CLI command with progress steps
- Implement `verify.js` CLI command with per-pack status table
- Implement `registry-client.js` (fetch + cache + search)
- Write all tests for verifier and CLI commands
- Add `verifyOptions` to `loadModel()` in `loader.js`

### prod-manager tasks
- Write the VERIFIED badge submission process for CONTRIBUTING.md
- Define contributor lifecycle (how does someone get a pack into the registry?)
- Define registry hosting strategy for v1 (GitHub raw vs. dedicated endpoint)

### generalPurpose tasks
- Draft `rfc-002-registry-schema.md` with full field definitions and evolution policy
- Write registry category taxonomy and tagging guidelines for contributors

### code-reviewer tasks
- Threat model: supply-chain attack vectors (tarball substitution, hash collision, etc.)
- Review `--skip-verify` UX to ensure it never silently bypasses checks
- Verify SHA-256 implementation uses Node.js crypto (no third-party hash library)

---

*Previous: [phase-3-life-event-playbooks.md](phase-3-life-event-playbooks.md)*  
*Next: [phase-5-decision-journal.md](phase-5-decision-journal.md)*
