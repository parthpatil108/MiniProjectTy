# 05 — Teams A, B, D: Specifications Beyond the Project Doc

The Project Doc already fully specifies each team's mission, feature contracts, API exposure matrix, internal building blocks, minimum test scenarios, and KPIs (§4.1, §4.2, §4.4). Coding agents for Teams A, B, D should treat those sections as their primary spec. This document only adds what those sections leave open, plus the exact handoff rules with Team C (whose implementation is now fixed by docs 02–04).

## 5.1 Team A — additions

**Technology:** **[AGENT CHOICE]** — no language/stack mandate (unlike Team C). Team A does not need to build a JSON-file DBMS; its own state (queues, leases, rule sets) can live in memory or in whatever lightweight storage the team chooses, since Team A is not the system of record and does not need to survive its own restart in the same way Team C does. If your course requires Team A to use a specific language (matching an "Operating Systems" course pairing), that is **[NEEDS CLARIFICATION]**.

**Exact handoff with Team C (C2/C3 integration):**
1. Team C calls `POST /api/v1/eligibility/requests` right after committing a new `Application` in `APPLIED`/`SCREENING` state (doc 04 §4.2).
2. Team A processes its queue and, when ready, either (a) exposes the result via `GET /api/v1/eligibility/requests/{requestId}` for Team C to poll, or (b) if your integration design prefers a push model, Team A may call back to a Team C internal endpoint — **this callback endpoint does not exist in the Project Doc or in doc 02's Team C surface, so push-based notification is [NEEDS CLARIFICATION]; default to Team C polling** unless the leads agree to add one.
3. When `eligibility_result` is `ELIGIBLE` and a slot is granted, Team A's decision includes `lease_id` (doc 01 §1.3). Team C then either commits immediately (`POST /internal/v1/offers/commit`) or, if the commit later fails, calls Team A's `DELETE /internal/v1/locks/{leaseId}` to release the lease — this release call is Team A's compensation contract and must be idempotent (a duplicate release for an already-released lease is a no-op, not an error).
4. Team A must honor `Idempotency-Key`/`request_id` uniqueness the same way doc 01 §1.1 defines it — a duplicate `POST /api/v1/eligibility/requests` for the same `request_id` must not re-enqueue or re-lease.

**Required algorithms remain exactly as the Project Doc states** (pluggable rule-chaining strategies, queue variants, wait-for-graph deadlock handling for slot locks) — this document adds no new algorithmic requirement for Team A.

## 5.2 Team B — additions

**Technology:** **[AGENT CHOICE]**, same reasoning as Team A. Team B's AVL/Red-Black tree and hash-map "shortlist index" (Project Doc B3) is a **separate, Team-B-owned data structure requirement** — do not confuse it with Team C's B+Tree/hash index (doc 03 §3.4/§3.5), which serves Team C's own storage and is not reused by Team B. Each team builds its own required structures independently; there is no code sharing between Team B's index and Team C's index.

**Exact handoff with Team C:**
1. Master data sync: Team C is the source of truth for student/drive master data (doc 02 §2.5). Whenever Team C's `masterDataService` (C1) commits a student or drive change, it must call Team B's `PUT /internal/v1/profiles/students/{studentId}` or `PUT /internal/v1/profiles/drives/{driveId}` so Team B's graph stays current. **Sync timing — [SPEC]:** synchronous, best-effort, immediately after Team C's own commit (not inside the same transaction — Team B is a separate service and cannot participate in Team C's WAL). If the sync call fails, Team C logs it and Team B's `graph_version` will simply lag until the next successful sync; this is acceptable because `RankingResult` always echoes the `graph_version` it used (doc 01 §1.3), so staleness is visible, not silent.
2. Team C requests rankings via `POST /api/v1/rankings/compute` (Project Doc B2) when a drive needs candidate ordering — typically triggered from the C3 offer-commit flow when multiple eligible candidates compete for limited seats.
3. `graph_version` mismatch handling: if Team B returns a ranking computed against a `graph_version` older than Team C's latest known master-data version, Team C should treat the result as `DEGRADED` (per the Project Doc §5.1 step 8 failure behavior) and retry rather than commit an offer against stale ranking data.

## 5.3 Team D — additions

**Technology:** **[AGENT CHOICE]** for the frontend framework; the BFF layer should be a thin proxy/aggregator, not a second system of record (Project Doc §1.2).

**Authentication — [SPEC, simplified for course scope]:** Build a simplified session scheme rather than a real institutional SSO integration:
- Team D issues its own signed JWT after a demo login step (e.g., a seeded user list with `role: Student | Faculty_TPO | Placement_Admin`), per `POST /api/v1/ui/session`.
- That JWT is what Team D forwards as `Authorization: Bearer ...` to Team A/B/C. Each of those services validates the JWT's signature and role claim locally (shared signing secret via environment config — **[NEEDS CLARIFICATION]**: whether the secret is shared via a config file in the repo, an `.env.example`, or a documented manual step, needs a lead decision before M3 of any team's build).
- This satisfies the Project Doc's "Authenticated institutional session, role-based authorization" security baseline (§2) without requiring a real campus IdP.

**Exact handoff with Team C:**
- `GET /api/v1/ui/dashboard` and `GET /api/v1/ui/applications/{id}` are pure aggregation: Team D calls Team C for `Application`, Team A for decision/queue detail, Team B for ranking, and assembles the `DashboardAggregate` shape (doc 01 §1.3). Team D must not persist any of this beyond request-scoped memory/cache — Team C remains the only durable store.
- `GET /api/v1/ui/stream` (SSE/WebSocket) should be implemented by having Team D's BFF itself tail Team C's outbox (via a Team-C-exposed stream, not by reading `outbox.jsonl` directly — file access across team boundaries is exactly what §0.2 point 9 in doc 00 forbids). **This means Team C needs an outbox-tailing endpoint of its own (e.g. `GET /internal/v1/outbox/stream`) that is not explicitly listed in the Project Doc's Team C API matrix — treat this as [SPEC]: add it to Team C's implementation (doc 04) as an additional internal endpoint, consumed only by Team D.**
- Never render data straight from a downstream 5xx/timeout as if it succeeded — map every doc 01 §1.2 error code to a specific UI state, per the Project Doc's D4 error-handling KPI.

## 5.4 Cross-cutting reminder for all three teams

Every team must adopt, unmodified: the response envelope, correlation-id propagation, idempotency-key semantics, the error code registry, and the shared object schemas from `01-shared-contracts-and-data-model.md`. A team's coding agent proposing a different envelope shape "because it's easier in my framework" is exactly the kind of silent contract change §0.2 point 10 (doc 00) forbids — flag it instead, per `06-ai-agent-rules.md`.
