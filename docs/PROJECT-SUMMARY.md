# ApniLeap — Project Summary for AI Coding Agents

This is a condensed brief of a 10-document planning package (`00` through `09`). Give this file to any AI tool that needs to understand the project quickly. If that tool will actually **write code** for one of the four teams, also give it the full relevant docs listed at the end — this summary is for orientation, not a replacement for the detailed specs it's built on.

## What this project is

ApniLeap: a rule-driven campus placement eligibility and analytics platform, built by four student teams that integrate through versioned HTTP/JSON contracts. Team C is the system of record; Teams A, B, D are independent services that call it and each other only through APIs. Timeline: 1–2 months. This is an academic mini-project — assessed on real engineering artefacts (working code, tests, benchmarks), not just a working demo screen.

## Team boundaries (fixed, not changeable by any agent)

| Team | Owns | Mandated tech |
| --- | --- | --- |
| **A** | Eligibility rule evaluation + interview-slot scheduling | Node.js/TS (see stack) |
| **B** | Skill/requirement graph, ranking/shortlisting, cohort analytics | Node.js/TS |
| **C** | Authoritative data + transactions (the only system of record) | **Node.js/TS + a hand-built JSON-file database — no external DBMS allowed** |
| **D** | Portal UI + backend-for-frontend (aggregates A/B/C for the browser) | React/TS |

Only Team C writes durable, authoritative state. Teams A/B/D hold working state in memory or local JSON for their own use, never as a second source of truth.

## Non-negotiable rules (apply to every AI tool touching this project)

1. No AI agent may change: team boundaries, data ownership, the technology stack (doc 09), required algorithms, or the shared API contract (doc 01) — these are locked by the project/Team C lead.
2. **Do not fake required subsystems.** If a spec says "must genuinely implement X" (B+Tree, hash index, WAL, lock manager, rule-chaining strategies, AVL/RB tree), a thin wrapper around a library or standard-library structure that quietly does the work does not satisfy it.
3. If something is ambiguous or contradicts a doc, **stop and flag it** — don't silently invent an architecture-level decision.
4. Every cross-team endpoint uses the shared envelope, `X-Correlation-ID`, and `Idempotency-Key` — no exceptions, no simplifying these away "for now."
5. Keep scope realistic for the timeline — build the specific feature required, not a generic framework around it.

## Final tech stack (locked — see full doc 09 for detail)

- **Language/runtime:** Node.js + TypeScript, project-wide, all four teams.
- **Backend:** Express + TypeScript, one small service per team.
- **API contracts:** OpenAPI 3 (YAML) is the single source of truth per team; contract-test mocks are generated from it, not hand-written separately.
- **Frontend (Team D):** React + TypeScript (Vite or Next.js).
- **Persistence:** Team C = custom JSON-file engine only (no Postgres/SQLite/Mongo/ORM). Teams A/B/D = in-memory or local JSON for their own working state; Team C's API is the only durable store.
- **Communication:** HTTPS/JSON REST + outbox pattern (append-only JSONL) + SSE/WebSocket for live updates. No message broker, no Kubernetes.
- **Auth:** JWT with role claims (`Student`, `Faculty_TPO`, `Placement_Admin`); shared signing secret via `.env`, distributed out-of-band, never committed.
- **Testing:** Jest (unit), Supertest (contract/integration), Playwright (Team D E2E). Every KPI needs a file-based evidence artefact, not a screenshot.
- **Tooling:** ESLint + Prettier + Husky, `pnpm` + `tsc`, GitHub Actions CI that hard-gates every PR (lint → typecheck → unit → contract tests must all pass).
- **Optional, not required:** Docker Compose (nice-to-have for local runs, never a blocker). Storybook was considered and explicitly removed from the required stack.

## Shared API contract essentials (full detail in doc 01)

**Every request/response:**
```
Headers: Authorization, X-Correlation-ID, Idempotency-Key (on create/commit ops), Content-Type: application/json
Success: {"data": {...}, "meta": {"correlation_id": "...", "api_version": "v1"}}
Error:   {"error": {"code": "...", "message": "...", "details": [...]}, "meta": {"correlation_id": "..."}}
```

**Error codes (closed vocabulary for cross-team errors):**
`VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `IDEMPOTENCY_CONFLICT` (409), `RULE_CONFLICT` (409), `STATE_CONFLICT` (409), `VERSION_MISMATCH` (409), `SLOT_UNAVAILABLE` (409), `LOCK_TIMEOUT` (423), `RATE_LIMITED` (429), `UPSTREAM_UNAVAILABLE` (502), `INTERNAL_ERROR` (500).

**Core shared objects** (owner in parentheses): `Application` (C), `EligibilityRequest`/`EligibilityDecision` (A), `RankingRequest`/`RankingResult` (B), `Drive` (C), `DashboardAggregate` (D, assembled from A+B+C). Full field lists in doc 01 §1.3.

**Application state machine** (Team C is the only writer):
```
APPLIED → SCREENING → RULE_EVALUATED → SHORTLISTED → INTERVIEW_SCHEDULED → SELECTED → OFFER_ISSUED
Side states: NOT_ELIGIBLE, WAITLISTED, WITHDRAWN, EXPIRED, COMPENSATION_REQUIRED
```
Full legal-transition table is in doc 01 §1.4 — any transition not listed there must be rejected.

## Team C: the custom database engine (full detail in docs 02–04)

Team C is layered: **API → Service/Orchestration → Transaction Manager → Concurrency Control (lock manager) → Storage Engine (B+Tree + hash index + WAL + recovery + audit)**, on top of one JSON file per table. No layer skips the one below it; nothing above the Transaction Manager touches a JSON file directly.

Required to be **real, tested implementations** (not library wrappers):
- **B+Tree** — real node splitting/merging, leaf-linked for range scans. Used for `applications.drive_id`, `applications.created_at`, `students.cgpa`.
- **Hash index** — hand-written hash function + bucket array with collision handling + resize. Used for `application_id`, `idempotency_key`, `student_id`, `drive_id` exact-match lookups.
- **Write-ahead log + recovery** — every commit is WAL-logged before being applied; crash recovery replays the WAL from the last checkpoint.
- **Transaction manager** — serializable isolation via strict two-phase locking; multi-record commits (e.g. application + seat + audit + outbox) are atomic.
- **Lock manager** — per-record shared/exclusive locks; deadlock handled via wait-for-graph cycle detection or timeout.
- **Query processor** — small internal filter/range/sort interface, uses an index when one matches, full-scans otherwise (and reports which).
- **Audit + outbox** — append-only `audit.jsonl` for every state change; `outbox.jsonl` feeds Team D's live-update stream.

Build order: storage engine + indexes → WAL/transactions/locking → master data CRUD → applications with idempotency → integration with Team A/B → offer commit/compensation → audit/reporting/recovery → outbox stream → load/fault testing.

## Integration handoffs (full detail in doc 05)

- **Team A ↔ C:** Team C creates an `EligibilityRequest` after committing a new application; polls Team A for the decision (push/callback is an open question, default to polling). A granted `lease_id` is released by Team C if the offer commit later fails.
- **Team B ↔ C:** Team C pushes master-data changes to Team B's profile endpoints to keep its graph current; requests rankings when a drive needs candidate ordering; treats a stale `graph_version` result as degraded and retries.
- **Team D ↔ everyone:** Team D's BFF aggregates A/B/C per-request, never persists anything itself, and tails Team C's outbox for live dashboard updates via an internal Team-C endpoint (this endpoint isn't in the original brief — it's an addition Team C must build).

## Process (full detail in doc 07)

- One GitHub repo. Branches: `main` (protected) + one long-lived branch per team + feature branches (`team-c/feature-name`).
- Contract (doc 01) frozen before implementation starts. Consumer writes mock-based contract tests before the producer is done.
- Six integration phases: contract freeze → independent builds → pairwise integration (A↔C, B↔C, C↔D) → end-to-end workflow → performance/resilience → demo. Each phase has an explicit exit criterion before the next starts.
- CI (GitHub Actions) must pass — lint, typecheck, unit, contract tests — before any PR merges.

## Known open items (resolve before the relevant team starts, don't guess)

1. Whether Team A needs a push-based callback from Team C instead of polling.
2. Exact secret-sharing mechanics beyond "put it in `.env`, share out of band" (who generates it, when).

## Full document index (go here for anything this summary compresses)

| Doc | Contents |
| --- | --- |
| `00-overview-and-decisions.md` | Locked decisions, module map, decision-tagging system |
| `01-shared-contracts-and-data-model.md` | Full API contract: envelopes, objects, state machine, error codes |
| `02-team-c-architecture.md` | Team C's layers, folder structure, allowed/disallowed packages |
| `03-team-c-database-engine-design.md` | Full DBMS design: storage, B+Tree, hashing, WAL, transactions, locking |
| `04-team-c-implementation-plan.md` | Team C build sequence, endpoint specs, seed data, test plan |
| `05-teams-a-b-d-specifications.md` | What A/B/D need beyond the project brief to integrate with Team C |
| `06-ai-agent-rules.md` | Binding rules for any AI coding agent on this project |
| `07-testing-integration-and-workflow.md` | Test pyramid, integration gates, Git workflow |
| `08-requirements-traceability.md` | Checklist mapping every requirement to where it's covered |
| `09-stack.md` | Final locked technology stack, full detail and rationale |

**Instruction to any AI tool reading this:** treat this summary as orientation only. Before writing code for a specific team, request and read that team's relevant full documents from the list above — this file intentionally omits field-level schemas, exact endpoint bodies, and algorithmic detail that the full docs contain.
