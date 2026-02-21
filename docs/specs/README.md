# FinLogicOS Engineering Specs

This directory contains all implementation specs, RFC documents, and model-pack design docs for the FinLogicOS v0.2.0+ roadmap.

---

## Navigation

### Phase Specs

All phase specs are under `phases/`. Each spec covers: overview, storage contracts, model packs, UI requirements, acceptance criteria, and sub-agent task assignments.

| Phase | Doc | Status |
|---|---|---|
| Phase 1 — Financial Health Score Engine | [phases/phase-1-health-score-engine.md](phases/phase-1-health-score-engine.md) | SPEC DRAFT |
| Phase 2 — Scenario Simulation Engine | [phases/phase-2-scenario-simulation.md](phases/phase-2-scenario-simulation.md) | SPEC DRAFT |
| Phase 3 — Life Event Playbooks | [phases/phase-3-life-event-playbooks.md](phases/phase-3-life-event-playbooks.md) | SPEC DRAFT |
| Phase 4 — Community Registry | [phases/phase-4-community-registry.md](phases/phase-4-community-registry.md) | SPEC DRAFT |
| Phase 5 — Financial Decision Journal | [phases/phase-5-decision-journal.md](phases/phase-5-decision-journal.md) | SPEC DRAFT |
| Phase 6 — Multi-Profile & Household Mode | [phases/phase-6-multi-profile.md](phases/phase-6-multi-profile.md) | SPEC DRAFT |

### Cross-Phase Contracts

| Doc | Scope |
|---|---|
| [explainability-contract.md](explainability-contract.md) | Universal "Explain This Number" schema — applies to ALL model packs |

### RFCs

Technical migration and protocol specs.

| RFC | Summary | Status |
|---|---|---|
| [RFC-001](rfcs/rfc-001-scenario-branches.md) | Snapshot table scenario branch columns | PROPOSED |
| [RFC-002](rfcs/rfc-002-registry-schema.md) | Community registry JSON schema | PROPOSED |
| [RFC-003](rfcs/rfc-003-decision-journal.md) | Decision journal SQLite migration | PROPOSED |
| [RFC-004](rfcs/rfc-004-profile-isolation.md) | Per-profile database isolation | PROPOSED |
| [RFC-005](rfcs/rfc-005-cli-commands.md) | New CLI command groups | PROPOSED |

### Model Pack RFCs (v0.2.0 Quick-Win Queue)

| Pack ID | Region | Category | Doc |
|---|---|---|---|
| `roth-conversion-ladder` | us | retirement-us | [model-packs/roth-conversion-ladder.md](model-packs/roth-conversion-ladder.md) |
| `social-security-timing` | us | retirement-us | [model-packs/social-security-timing.md](model-packs/social-security-timing.md) |
| `uk-isa-optimizer` | uk | tax-uk | [model-packs/uk-isa-optimizer.md](model-packs/uk-isa-optimizer.md) |
| `rent-vs-buy-calculator` | global | housing | [model-packs/rent-vs-buy-calculator.md](model-packs/rent-vs-buy-calculator.md) |
| `emergency-fund-target` | global | health | [model-packs/emergency-fund-target.md](model-packs/emergency-fund-target.md) |
| `hsa-triple-tax-optimizer` | us | tax-us | [model-packs/hsa-triple-tax-optimizer.md](model-packs/hsa-triple-tax-optimizer.md) |
| `net-worth-trajectory` | global | health | [model-packs/net-worth-trajectory.md](model-packs/net-worth-trajectory.md) |
| `tax-loss-harvesting` | us | tax-us / investment | [model-packs/tax-loss-harvesting.md](model-packs/tax-loss-harvesting.md) |

---

## Milestone Gates

| Milestone | Requires | Gate criteria |
|---|---|---|
| **A** | Phase 1 + Phase 2 specs signed off + RFC-001 approved | Architecture spec complete, test plan complete, code-review checklist defined |
| **B** | Phase 3 + Phase 4 specs signed off + RFC-002 approved | Registry trust model approved, playbook runner design signed off |
| **C** | Phase 5 + Phase 6 specs signed off + RFC-003 + RFC-004 approved | Profile isolation threat review passed, journal privacy review passed |

---

## Sub-Agent Ownership Summary

| Agent | Owns |
|---|---|
| **backend-engineer** | All core/storage migrations, CLI command implementations, model pack `logic.js` files, test suites |
| **prod-manager** | Phase PRDs, acceptance criteria sign-off, user journeys, retention and governance policies |
| **generalPurpose** | Model pack methodology docs, README files, playbook schemas, scoring rubrics |
| **code-reviewer** | Security/isolation threat checklists, math audit, explainability quality review |
| **explore** | Repo drift validation before each phase implementation round begins |

---

## Implementation Order (Recommended)

```
1. Explainability contract → backfill existing model packs
2. RFC-001 → snapshot migration
3. Phase 1 → health score model packs + dashboard
4. Phase 2 → scenario packs + storage API + scenarios UI
5. RFC-003 → journal migration
6. Phase 5 → journal (simpler than Phases 3 & 4)
7. Phase 3 → playbooks (depends on model runner maturity)
8. RFC-002 → registry schema
9. Phase 4 → registry install/verify
10. RFC-004 → profile isolation
11. Phase 6 → multi-profile
12. v0.2.0 model packs → ship in any order after Phase 1
```

This order minimizes dependency risk: storage migrations first, UX features second, community infrastructure third.
