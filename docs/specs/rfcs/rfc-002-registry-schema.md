# RFC-002 — Community Registry Schema

**Status:** PROPOSED  
**Author:** generalPurpose + backend-engineer  
**Affects:** New registry infrastructure (no existing code changes)  
**Version:** 1.0.0

---

## Summary

Define the schema, hosting contract, versioning policy, and evolution rules for the FinLogicOS community model registry. The registry is consumed entirely locally after a one-time fetch; no registry data is required at runtime.

---

## Registry File Location

**Primary (future):** `https://registry.finlogicos.dev/registry.json`  
**v1 bootstrap:** `https://raw.githubusercontent.com/finlogicos/registry/main/registry.json`

Local cache: `~/.finlogicos/registry.json`

---

## Top-Level Schema

```json
{
  "$schema": "https://registry.finlogicos.dev/schemas/registry-v1.json",
  "registry_version": "1",
  "schema_version": "1.0.0",
  "updated_at": "2025-01-01T00:00:00Z",
  "total_packs": 12,
  "packs": [ /* array of PackEntry */ ]
}
```

---

## `PackEntry` Schema (full)

```typescript
interface PackEntry {
  // Identity
  id: string;                    // kebab-case, e.g. "roth-conversion-ladder"
  name: string;
  version: string;               // semver
  description: string;
  
  // Authorship
  author: string;                // GitHub username or handle
  author_url: string | null;
  
  // Classification
  category: string;              // see category list
  region: string[];              // e.g. ["us"], ["uk"], ["global"]
  tags: string[];
  license: string;               // SPDX identifier, e.g. "MIT"
  
  // Source and distribution
  source_url: string;            // GitHub repo URL
  download_url: string;          // Tarball URL
  
  // Integrity
  manifest_sha256: string;       // SHA-256 hex of manifest.yaml
  logic_sha256: string;          // SHA-256 hex of logic.js
  tarball_sha256: string;        // SHA-256 hex of the .tar.gz
  
  // Verification status
  verified: boolean;
  verified_at: string | null;    // ISO 8601
  verified_by: string | null;    // GitHub handle of reviewer
  verification_pr_url: string | null;
  
  // Community metrics (informational only)
  community_score: number | null; // 0.0–5.0
  download_count: number;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Deprecation
  deprecated: boolean;
  deprecated_reason: string | null;
  replacement_id: string | null;
}
```

---

## Schema Evolution Policy

The `registry_version` field is a major version number. Breaking schema changes require a major bump. The client must check compatibility:

```javascript
if (registry.registry_version !== SUPPORTED_REGISTRY_VERSION) {
  warn('Registry version not supported. Update finlogic CLI to latest version.');
}
```

Additive fields (new optional keys) do NOT require a version bump. Clients must ignore unknown keys.

---

## Category Taxonomy

| ID | Display Name |
|---|---|
| `tax-us` | US Tax |
| `tax-uk` | UK Tax |
| `tax-ca` | Canada Tax |
| `tax-in` | India Tax |
| `tax-eu` | EU Tax |
| `retirement-us` | US Retirement |
| `retirement-global` | Global Retirement |
| `debt` | Debt Strategies |
| `investment` | Investment Models |
| `insurance` | Insurance Gap |
| `housing` | Housing & Mortgage |
| `health` | Financial Health |
| `income` | Income & Career |
| `playbook` | Life Event Playbook |
| `other` | Other |

---

## Registry Update Frequency

- The hosted registry is rebuilt and published on each merged PR to the registry repository.
- Clients cache locally; cache expiry is 24 hours by default (configurable).
- `finlogic registry update` forces a refresh regardless of cache age.

---

## Security Considerations

1. **Tarball integrity:** Client verifies `tarball_sha256` before extracting. Any mismatch aborts install.
2. **File integrity:** After extraction, client verifies `manifest_sha256` and `logic_sha256` separately.
3. **HTTPS only:** All registry URLs must use HTTPS. HTTP URLs are rejected by the client.
4. **No code execution during install:** The install flow does NOT execute `logic.js`. Only `finlogic validate` (which uses the sandbox) runs a dry-run test.
5. **Pinned versions:** Once installed, a pack's version is locked. `finlogic update <pack-id>` is an explicit user action.
