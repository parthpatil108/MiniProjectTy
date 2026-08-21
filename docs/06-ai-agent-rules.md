# 06 — AI Coding Agent Rules

These rules govern any AI coding agent working on this project, for any team. They are binding regardless of which files or documents an agent is directly looking at.

## 6.1 Global rules

1. **No architectural authority.** An agent may not change: the four-team boundary, data ownership (Team C owns all authoritative data), Team C's technology mandate (Node.js, no external DBMS), required algorithms named in the Project Doc or in `03-team-c-database-engine-design.md`, or any shared contract in `01-shared-contracts-and-data-model.md`. These are **[LOCKED]** or **[PROJECT DOC]** per the tagging in `00-overview-and-decisions.md`.
2. **No faking required subsystems.** If a document says "must genuinely implement X" (e.g., B+Tree, hash index, WAL, lock manager, rule-chaining strategies, AVL/Red-Black tree), a wrapper around a library or standard-library structure that does the real work internally does not satisfy the requirement. When in doubt whether a package/approach crosses this line, treat it as disallowed (see doc 02 §2.4 for the explicit Team C list).
3. **Escalate instead of inventing.** Anywhere a document is tagged **[NEEDS CLARIFICATION]**, or an agent hits an ambiguity not covered by any document, the agent must stop and produce a clearly marked note (e.g. a `CLARIFICATION-NEEDED.md` entry or a flagged TODO comment referencing the exact open question) rather than silently deciding an architecture-level or contract-level question itself. Implementation-level details genuinely marked **[AGENT CHOICE]** do not require escalation.
4. **Contracts are append-only, not editable in place.** If a real gap in `01-shared-contracts-and-data-model.md` is found during implementation, the agent proposes an addition (new optional field, new error code) rather than altering existing field names/types/semantics. Breaking changes require an explicit `/v2` decision from the leads — see doc 01 §1.5.
5. **Every feature ships with the tests the relevant doc assigns it.** Doc 04 §4.4 for Team C; Project Doc's "minimum test scenarios" per team for A/B/D. A feature without its assigned tests is not done.
6. **Idempotency and correlation IDs are non-negotiable on every cross-team endpoint** — an agent must not "simplify" these away even temporarily, since other teams' contract tests depend on them from day one (doc 07 §7.1).
7. **Realistic scope.** Don't build generic frameworks, plugin systems, config DSLs, or abstractions beyond what the assigned feature needs. If a Project Doc feature contract can be built directly, build it directly.

## 6.2 Team C agent — additional rules

1. Follow the layer boundary in `02-team-c-architecture.md` §2.1 exactly: L1 (API) never touches L5 (storage) directly; every mutation goes through the Transaction Manager (L3).
2. The B+Tree, hash index, WAL, and lock manager (doc 03) must each have standalone unit tests that exercise their real algorithmic behavior (split/merge, collision/resize, replay-after-crash, deadlock/timeout) — not just "endpoint returns 200" tests.
3. Never write directly to a table's JSON file outside the WAL-then-apply-then-checkpoint sequence in doc 03 §3.6, even for "just seeding test data" — use the seed script (doc 04 §4.3), which itself goes through the same Storage Manager API.
4. Any new index (beyond doc 03 §3.11's initial set) must be added to `indexConfig.js`, not created ad hoc inside a service file.

## 6.3 Team A / Team B agents — additional rules

1. Build the specific data structures and algorithm variants the Project Doc names for your team (Team A: queue variants + rule-chaining strategies + wait-for graph; Team B: adjacency-list/matrix graph + AVL/RB tree + hash-based shortlist index + ranking algorithms) as real, benchmarkable code — same "no faking" standard as Team C, scoped to what your team's mission requires.
2. Do not implement a JSON-file DBMS of your own or attempt to become a second system of record — any state you hold is your team's working state, not authoritative data (doc 05 §5.1/§5.2).
3. Honor the exact handoff sequences in `05-teams-a-b-d-specifications.md` for your team — these are the concrete mechanics behind the Project Doc's feature contracts.

## 6.4 Team D agent — additional rules

1. The BFF is an aggregator/proxy — it must not cache or persist domain data beyond a request's lifecycle, and must never let the UI infer authorization from hidden elements (Project Doc D1).
2. Every backend error code from doc 01 §1.2 must map to a distinct, testable UI state (message, retry affordance, or corrective action) — not a generic error toast for everything.
3. Follow the simplified auth scheme in doc 05 §5.3 unless the leads resolve the flagged clarification about secret distribution differently.

## 6.5 What "done" means for an agent's task

A task is complete when: the code exists, it's covered by its assigned tests (and they pass), it conforms to the shared contract without modification, and any open question it surfaced has been recorded rather than silently resolved. Partial implementations should be clearly marked incomplete in code comments and in the relevant PR description — never presented as finished.
