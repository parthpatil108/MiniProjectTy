# 09 — Technology Stack (Final, Locked)

This is the finalized stack for the entire project, across all four teams. It uses the same tagging convention as `00-overview-and-decisions.md`. Everything in this document is **[LOCKED]** unless explicitly marked otherwise — it does not change during the build, including by AI coding agents (see `06-ai-agent-rules.md` §6.1.1).

## 9.1 Language and runtime **[LOCKED]**

**Node.js + TypeScript, project-wide, for all four teams — including Teams A, B, and D, not just Team C.**

This resolves the open clarification in doc 00 §0.4 / doc 08 §8.5 about whether Teams A, B, D have a course-mandated stack per their academic theme (OS / Data Structures / Web). Confirmed decision: **no**, a uniform language is acceptable. Rationale:
- The Project Doc itself already scopes Team A's concurrency work as "mutex/semaphore **simulations**" and a wait-for graph, not real kernel-level primitives — it does not require a systems language.
- Team B's required structures (adjacency list/matrix, AVL/Red-Black tree, hashing, ranking algorithms) are algorithmic requirements, not language-bound ones.
- A single language lets all four teams share DTOs, contract-test tooling, CI configuration, and reviewer familiarity — significant for a 1–2 month timeline.

If your course rubric is later found to require a systems language for Team A specifically, that reopens this decision — but until then, treat it as settled, not to be silently changed by an agent.

## 9.2 Backend framework **[LOCKED]**

`express` + TypeScript, one small service per team (Team A service, Team B service, Team C service, Team D BFF), all following the same project conventions (folder layout, middleware pattern, response envelope). Team C's internal layering is further constrained by `02-team-c-architecture.md` §2.1 — that constraint is unique to Team C and does not apply to A/B/D.

## 9.3 API contracts **[LOCKED]**

**OpenAPI 3 (YAML) is the single source of truth for every cross-team endpoint**, superseding the plain-JSON-Schema approach mentioned informally earlier. One OpenAPI file per team, plus one shared file for the common envelope/error shapes:

```
shared/contracts/openapi/
  common-envelope.yaml     # success/error envelope, error-code enum (doc 01 §1.1–1.2)
  team-a.openapi.yaml
  team-b.openapi.yaml
  team-c.openapi.yaml
  team-d.openapi.yaml
```

Rules:
- Every endpoint in every team's API exposure matrix (Project Doc §4.1–4.4) and every Team C endpoint in doc 04 §4.2 must have a corresponding OpenAPI operation before that endpoint is implemented — not written retroactively.
- `team-*.openapi.yaml` files `$ref` the shared object schemas from `common-envelope.yaml` and from doc 01 §1.3 (`ApplicationRequest`, `EligibilityDecision`, `Drive`, etc.) — object shapes are defined once, referenced everywhere, never redefined per team.
- Mock examples and consumer-driven contract-test fixtures are **generated from these OpenAPI files** (via CI, see §9.9), not hand-maintained separately, so they cannot drift out of sync with the real contract.
- Swagger UI is served locally by each team's service in dev mode, reading its own OpenAPI file, so any teammate can browse a live contract without reading YAML directly.

## 9.4 Frontend (Team D) **[LOCKED]**

React + TypeScript. Vite for a pure SPA, or Next.js if Team D wants SSR/BFF colocated in one framework — this specific choice is **[AGENT CHOICE]** for Team D, but React + TypeScript itself is not. Team D's BFF layer follows the aggregator-only rule in doc 05 §5.3 regardless of which of the two is chosen.

## 9.5 Persistence **[LOCKED, restates doc 00 §0.2.5–0.2.7 for stack completeness]**

- **Team C:** custom JSON-file storage engine only — B+Tree, hash index, WAL, lock manager, per `03-team-c-database-engine-design.md`. No Postgres, SQLite, MongoDB, or any embedded/file DB library. This is non-negotiable and does not get revisited.
- **Teams A, B, D:** in-process memory, or simple JSON files/local caches for their own working state during dev. They are never a second system of record — Team C's HTTP API is the only source of authoritative data (doc 05 §5.1–5.2).

## 9.6 Inter-service communication **[LOCKED]**

HTTPS/JSON REST per doc 01, with `Idempotency-Key` and `X-Correlation-ID` on every cross-team call. No message broker (Kafka/RabbitMQ) — the outbox pattern (append-only JSONL, doc 03 §3.10) plus SSE/WebSocket tailing covers the live-update requirement without one.

## 9.7 Auth **[LOCKED, resolves doc 05 §5.3's open item]**

Simple JWT-signed sessions, role claims (`Student`, `Faculty_TPO`, `Placement_Admin`) per doc 01/doc 05. Signing secret distribution — resolving the clarification flagged in doc 05 §5.3 and doc 08 §8.5:
- A `.env.example` with a placeholder key (`JWT_SIGNING_SECRET=changeme`) is committed to the repo root, one copy referenced by every team's service.
- The real secret is generated once by the project lead and shared out-of-band (not committed) before any team needs cross-service auth to work — i.e., before Phase 3 pairwise integration (doc 07 §7.2).
- This clarification is now resolved; doc 08 §8.5 item 3 should be marked closed.

## 9.8 Testing **[LOCKED]**

- **Jest** — unit tests, all teams (B+Tree/hash index/lock manager for Team C; rule-chaining/queues for Team A; graph/tree/ranking for Team B).
- **Supertest** — contract and integration tests (HTTP-level), all teams.
- **Playwright** — Team D end-to-end/browser tests (per Project Doc D's "keyboard-only, responsive-layout, cross-browser critical-flow tests").
- Every KPI table in the Project Doc must produce a **file-based evidence artefact** (JSON/CSV/log output from the relevant test run), not a screenshot or a verbal claim — per doc 04 §4.4 and doc 07 §7.2's Phase 5 exit criterion.

## 9.9 Lint, build, and CI **[LOCKED]**

- **ESLint + Prettier**, shared root config, extended (not overridden) per team if a team genuinely needs an addition.
- **Husky** pre-commit hook: lint + typecheck on staged files.
- **`pnpm`** as the package manager (workspaces for the four team packages + `shared/`), **`tsc`** for type-checking.
- **GitHub Actions** — required CI pipeline, running on every PR into any team branch and into `main`:
  1. Install (`pnpm install`)
  2. Lint (`eslint`)
  3. Typecheck (`tsc --noEmit`)
  4. Unit tests (`jest`)
  5. Contract tests (validate implementation against `shared/contracts/openapi/*.yaml`, using generated mocks per §9.3)
  6. (On `main` only, at integration-gate merges) integration test suite
- A PR **cannot merge if CI fails.** This is a hard gate, not a recommendation — it is what turns doc 07's Definition of Done from a checklist into something enforced.

## 9.10 Local dev and reproducibility **[SPEC — optional tooling, do not make it a blocker]**

- **Docker + Docker Compose:** available for anyone who wants a one-command reproducible run of all four services plus seed data, but **optional**, not required for day-to-day development. Nobody should be blocked on learning Docker before they can work on their team's actual feature (e.g., the B+Tree). A working `docker-compose.yml` is a nice-to-have for the final demo, not a Phase 1–3 dependency.
- Seed data: deterministic, per doc 04 §4.3, exported to `shared/fixtures/seed/` so all teams can build fixtures against identical IDs regardless of whether they run via Docker or `pnpm dev` directly.

## 9.11 Dev tooling — trimmed **[SPEC, changed from the earlier draft]**

- **Swagger UI** — kept, since it's the natural companion to the OpenAPI-as-source-of-truth decision in §9.3 and costs nothing extra to run.
- **Postman/Newman collections** — kept as an alternative/companion to Supertest for teams that prefer it, generated from OpenAPI per §9.3.
- **Storybook — removed from the required stack.** For a 4-team, 1–2 month academic build, it's real setup and maintenance overhead that doesn't map to any Project Doc requirement or KPI. If Team D wants it later purely for their own convenience, that's an individual **[AGENT CHOICE]**, never a project-wide requirement, and never something another team needs to install to work.

## 9.12 Logging **[LOCKED]**

Structured logs via **Pino** (preferred for Node/TS performance) or **Winston** — pick one project-wide **[AGENT CHOICE — pick once, apply everywhere]**, don't mix per team. Every log line in a cross-team flow must include `correlation_id`, matching doc 01 §1.1. No external log aggregation/monitoring service — local log files are sufficient for this scope.

## 9.13 Summary table

| Layer | Choice | Status |
| --- | --- | --- |
| Language/runtime (all teams) | Node.js + TypeScript | Locked |
| Backend framework | Express + TypeScript | Locked |
| API contract format | OpenAPI 3 (YAML), single source of truth | Locked |
| Frontend | React + TypeScript (Vite or Next.js) | Locked (framework choice is agent's) |
| Team C persistence | Custom JSON-file DBMS (B+Tree, hash, WAL, locks) | Locked |
| Teams A/B/D persistence | In-memory / local JSON, Team C is sole system of record | Locked |
| Communication | HTTPS/JSON REST + outbox/SSE, no broker | Locked |
| Auth | JWT, shared env secret, role claims | Locked |
| Unit/contract/E2E testing | Jest / Supertest / Playwright | Locked |
| Lint/format/hooks | ESLint, Prettier, Husky | Locked |
| Package manager / typecheck | pnpm, tsc | Locked |
| CI | GitHub Actions, hard-gates PRs | Locked |
| Local dev reproducibility | Docker Compose | Optional |
| API docs / contract browsing | Swagger UI, Postman/Newman | Locked |
| UI component catalog | Storybook | Removed — not required |
| Logging | Pino or Winston (pick one, apply everywhere) | Locked, single choice |

## 9.14 Instruction to coding agents

This document is binding alongside `06-ai-agent-rules.md`. An agent may not substitute a different language, framework, contract format, or testing tool for any row marked **Locked** above, even if it seems like a reasonable simplification for its own team's task. Rows marked **Optional** or where the table says "agent's choice" are the only places local judgment applies. Any perceived need to deviate from this table is a **[NEEDS CLARIFICATION]** event per doc 06 §6.1.3 — flag it, don't act on it.
