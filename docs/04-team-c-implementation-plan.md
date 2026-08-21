# 04 — Team C Implementation Plan

Build order, endpoint-level specification, seed data, and the Team C-specific test plan. This is what an agent should follow sequentially — it does not restate feature contracts already in the Project Doc §4.3, only sequences and operationalizes them.

## 4.1 Build sequence **[SPEC]**

| Milestone | Deliverable | Depends on |
| --- | --- | --- |
| M1 | Storage Manager + hash index + B+Tree, unit-tested standalone (no HTTP yet) | doc 03 |
| M2 | WAL + Transaction Manager + Lock Manager, unit-tested with simulated concurrent transactions | M1 |
| M3 | C1 — student/drive/company master data CRUD over HTTP, using M1+M2 | M2 |
| M4 | C2 — application create/withdraw with idempotency, optimistic concurrency, full transaction | M3 |
| M5 | Outbound integration: `teamAClient.js`, `teamBClient.js` against Team A/B mocks (contract tests, doc 07) | M4, doc 01 |
| M6 | C3 — offer commit/compensate, wiring the real multi-record transaction (application+seat+audit+outbox) | M5 |
| M7 | C4 — audit query, placement-performance report, recovery-verify endpoint | M6 |
| M8 | Outbox → SSE endpoint for Team D | M7 |
| M9 | Load test, fault-injection (recovery) test, KPI evidence pack | M8 |

This sequence intentionally builds the DBMS internals (M1–M2) before any HTTP surface, so the required algorithms can be tested in isolation and don't get rushed at the end.

## 4.2 Endpoint specifications **[PROJECT DOC endpoints, SPEC for request/response bodies]**

All endpoints use the doc-01 response envelope and header rules. Bodies below show the success `data` payload only.

### `POST /api/v1/students` (C1)
Request: student profile fields (name, branch, cgpa, backlogs, attendance, skill_tags[]).
Response: `{ student_id, version, created_at }`.

### `GET /api/v1/drives`, `GET /api/v1/drives/{driveId}/criteria` (C1)
Returns `Drive` objects per doc 01 §1.3, filtered/paginated via the query processor (doc 03 §3.9).

### `PATCH /internal/v1/drives/{driveId}` (C1)
Request: partial `Drive` fields + `expectedVersion`. On version mismatch, returns `VERSION_MISMATCH`.

### `POST /api/v1/applications` (C2)
Request: `ApplicationRequest` (doc 01 §1.3) + `Idempotency-Key` header.
Flow: Transaction Manager checks idempotency hash index → begins transaction → validates drive is `OPEN` and student meets no *hard* pre-filter (full rule evaluation is Team A's job, not Team C's) → inserts `Application` in `APPLIED` state → commits → asynchronously (still within the same request, but after commit) calls `teamAClient` to create the `EligibilityRequest`.
Response: `{ application_id, state, version, queue_position? }` (queue_position pass-through from Team A if available synchronously).

### `GET /api/v1/applications/{applicationId}` (C2)
Returns current `Application` plus last-known `decision` and `ranking` snapshot (from the caches in doc 03 §3.2), per doc 01's `DashboardAggregate` shape trimmed to what Team C itself owns (Team D does the full aggregate).

### `POST /api/v1/applications/{applicationId}/withdraw` (C2)
Transitions to `WITHDRAWN` per the state table (doc 01 §1.4) only from allowed source states; triggers compensation if a lease/seat was held.

### `POST /internal/v1/offers/commit` (C3)
Request: `{ application_id, decision_id, lease_id, ranking_id?, expectedVersion }`.
Flow: single transaction — verify `expectedVersion`, transition application state forward, decrement drive seat count, write audit record, write outbox event. On any failure after Team A already granted the lease, call `POST /internal/v1/offers/compensate` equivalent internally and call Team A's lock-release endpoint (doc 02 §2.5).
Response: `{ commit_status: "COMMITTED" | "REJECTED", application, conflict_details? }`.

### `POST /internal/v1/offers/compensate` (C3)
Explicit compensation trigger (also invoked internally by the commit flow on failure). Releases held resources, sets state to `COMPENSATION_REQUIRED` transiently then to the appropriate resolved state, writes an audit record marked as a compensation action.

### `GET /api/v1/audit` (C4)
Query params: `correlation_id`, `entity_id`, `from`, `to`. Uses query processor. Returns audit entries, newest first.

### `GET /api/v1/reports/placement-performance` (C4)
Aggregates Team C's own applications/offers data (department/company/conversion) — does not call Team A/B; Team D is responsible for merging in A/B metrics per its own report endpoint (doc 05 §5.3).

### `POST /internal/v1/recovery/verify` (C4)
Triggers/reports on a recovery self-check: confirms WAL checkpoint is current, table files round-trip against last N audit entries, returns `{ status, lastCheckpointLsn, walBacklog }`.

### Health/readiness **[SPEC — not in Project Doc, required by doc 01 handoff checklist]**
`GET /healthz` → `{ status: "ok", uptimeSec }`. Required so Teams A/B/D can build reliable integration tests against Team C per the handoff checklist (Project Doc §7.1).

## 4.3 Seed data **[SPEC]**

`seed/seedData.js` must populate, on a clean `data/` directory:
- ≥ 20 students spanning a CGPA range that exercises the B+Tree range index (some above/below common cutoffs).
- ≥ 5 drives with varied criteria and small seat counts (some with seats = 1–2, to make slot-conflict tests meaningful).
- 0 applications (applications are created by tests/integration flows, not pre-seeded), so idempotency and concurrency tests start from a known-empty state.

Seed data must be deterministic (fixed IDs, no random generation) so Team A/B can hold matching fixtures for their own contract tests.

## 4.4 Team C test plan **[PROJECT DOC scenarios, operationalized]**

Maps directly to the Project Doc's "Team C minimum test scenarios" and KPI table.

| Scenario (from Project Doc) | Test type | Evidence artefact |
| --- | --- | --- |
| Duplicate idempotency key, concurrent application, lost-update attempt | Integration (concurrent load) | Test report showing 0 duplicates / 0 lost updates across N concurrent attempts |
| DB commit failure after Team A grants a lease | Integration (fault injection: kill Team A mock mid-lease, or force a commit exception) | Log showing compensation call + lease released |
| Drive-criteria change while an application is in flight | Integration | Test asserting `VERSION_MISMATCH` is returned, application unaffected |
| Backup restore, audit reconciliation, index-performance comparison | Unit + integration | Recovery test (kill process mid-WAL, restart, verify state) + a benchmark script comparing indexed vs. full-scan query time |
| B+Tree split/merge correctness | Unit | Jest test asserting tree shape/ordering after scripted insert/delete sequence |
| Hash index collision + resize | Unit | Jest test with keys engineered to collide, plus a load-factor resize assertion |
| Transaction atomicity (C3 multi-record commit) | Unit + integration | Test asserting all four records (application, seat, audit, outbox) commit or none do |
| Deadlock detection/timeout | Unit | Two transactions requesting locks in opposite order; assert cycle detected/aborted or timeout fires |

All KPI numbers (commit latency p95 ≤ 500ms, query p95 ≤ 200ms, etc.) come directly from the Project Doc's Team C KPI table — this plan does not restate targets, only which test produces the evidence for each.
