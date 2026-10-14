# 07 — Testing, Integration, and Git Workflow

## 7.1 Test pyramid per team **[SPEC, operationalizing Project Doc §7/§7.1/§6.1]**

| Level | What it covers | Who writes it | Runs against |
| --- | --- | --- | --- |
| Unit | Internal algorithms (B+Tree, hash index, lock manager, rule-chaining, ranking algorithms, AVL/RB tree) | Each team, for its own internals | In-process, no network |
| Contract | Does my service's request/response match the shared schema in doc 01? | **Consumer** writes it, against a mock of the producer, before the producer is done (Project Doc §7.1) | Mock JSON fixtures |
| Integration (pairwise) | A↔C, B↔C, C↔D, per Project Doc phase 3 | Both teams, jointly | Real running services, seed data |
| End-to-end | Apply → Evaluate → Rank → Notify → Update | Integration lead + one rep per team | Full deployed stack |

**Contract test mechanics — [SPEC]:** since Teams A/B/D may use different languages/stacks, use a language-agnostic contract format: JSON example payloads matching doc 01's object schemas, checked with a simple schema-validation script (or Postman/Newman collections) rather than assuming everyone uses Jest. Team C, being Node.js, uses Jest + Supertest for its own unit/contract tests.

**Fixtures:** every team must be able to run its own contract tests against the deterministic seed data in `04-team-c-implementation-plan.md` §4.3 — this is why that seed data is fixed-ID and non-random.

## 7.2 Integration gates **[PROJECT DOC §7, cross-referenced]**

Follow the Project Doc's 6-phase table exactly (Contract freeze → Independent engines → Pairwise integration → End-to-end workflow → Performance/resilience → Demonstration). This document adds only the operational detail:

- **Phase 1 exit criterion:** doc 01 is frozen and every team has committed at least one mock-based contract test against it, before any team starts Phase 2 implementation work in earnest.
- **Phase 3 exit criterion:** each pairwise integration (A↔C, B↔C, C↔D) has a passing contract test suite checked into the shared repo, runnable independently (i.e., Team D's C-integration tests don't require Team A or B to be running).
- **Phase 4 exit criterion:** one full trace (via `X-Correlation-ID`) for a single successful application, from Team D submission to `SHORTLISTED`/`WAITLISTED`, is captured and reviewable — this is the artefact, not just "it worked once in a demo."
- **Phase 5 exit criterion:** the KPI evidence pack (Project Doc §6.1) exists with raw results, not just screenshots, for every KPI table in the Project Doc.

## 7.3 Git workflow **[LOCKED — kept deliberately simple]**

- One repository, one `main` branch (protected: no direct pushes).
- One long-lived branch per team: `team-a`, `team-b`, `team-c`, `team-d`. Each team lead is the only one who merges feature branches into their team branch.
- Feature branches: `team-<x>/<short-feature-name>` (e.g. `team-c/b-plus-tree-index`, `team-c/offer-commit-transaction`).
- Merges from a team branch into `main` happen at integration-gate boundaries (end of Phase 2, Phase 3, Phase 4 in §7.2 above) — not continuously — to keep `main` always representing a coherent, demo-safe state.
- Commit messages: `[Team<X>] <short summary>` — e.g. `[TeamC] Implement B+Tree split/merge with unit tests`.
- Breaking a shared contract (doc 01) requires the change to land in `01-shared-contracts-and-data-model.md` first, reviewed by affected team leads, before any team branch implements against it.
- No force-pushes to `main` or any team branch other teams may have already branched from.

## 7.4 Definition of done pointer **[PROJECT DOC §6.1]**

Reuse the Project Doc's Definition of Done directly (OpenAPI contract per API, tests tied to KPIs, propagated correlation IDs, demonstrated failure cases, a real KPI evidence pack) — it is already complete and does not need restating here. Doc `08-requirements-traceability.md` tracks whether each of its five bullet points has been satisfied.
