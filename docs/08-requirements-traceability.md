# 08 — Requirements Traceability

A checklist mapping every major requirement category from the Project Doc (and from the locked decisions in doc 00) to its concrete implementation and verification in this repository.

## 8.1 Cross-team standards

| Requirement | Source | Implementation File & Function | Verification Test Suite | Status |
| :--- | :--- | :--- | :--- | :--- |
| Common request headers, response envelope | Project Doc §3.1–3.2 | All services: `responseEnvelope.ts`, `errorEnvelope.ts`, `commonEnvelope.ts` | All contract test suites across Teams A, B, C, D | Implemented & Verified |
| Correlation ID propagation | Project Doc §1.1, §3.1 | Express middleware across all services, preserved across HTTP hops | `e2e/integration.test.ts` (Flow 1: trace ID propagation) | Implemented & Verified |
| Idempotency-Key semantics | Project Doc §3.1 | Team C: `StorageManager.query(hashIndex)` + Team A `request_id` cache | `e2e/integration.test.ts` (Flow 3: concurrent idempotency) | Implemented & Verified |
| Cross-team data object schemas | Project Doc §3.3 | `shared/contracts/openapi/*.yaml` & TypeScript interfaces | OpenAPI Supertest contract tests in all teams | Implemented & Verified |
| Application state machine | Project Doc §3.4 | `team-c/src/services/stateMachine.ts` | `team-c/test/unit/stateMachine.test.ts`, `e2e/integration.test.ts` | Implemented & Verified |
| Error code vocabulary | Project Doc §3.2 | Custom error classes mapping to HTTP 400, 401, 403, 404, 409 | `bff.test.ts`, `offers.test.ts`, `portal.spec.ts` | Implemented & Verified |
| API versioning policy | Project Doc §7.1 | Primary URI boundary `/api/v1` and `/internal/v1` | Contract tests in Teams A, B, C, D | Implemented & Verified |

## 8.2 Team C — required DBMS concepts

| Requirement | Source | Implementation File & Function | Verification Test Suite | Status |
| :--- | :--- | :--- | :--- | :--- |
| Storage management | Locked decision (doc 00 §0.2.7) | `team-c/src/storage/storageManager.ts`, `table.ts` | `team-c/test/unit/storage.test.ts` | Implemented & Verified |
| JSON persistence via layered architecture | Locked decision (doc 00 §0.2.6) | `team-c/src/storage/table.ts` writing to `team-c/data/` | `team-c/test/unit/table.test.ts` | Implemented & Verified |
| Indexing | Locked decision | `team-c/src/config/indexConfig.ts`, `table.ts` | `team-c/test/unit/storage.test.ts` | Implemented & Verified |
| B+Tree | Locked decision | `team-c/src/storage/indexes/bplustree.ts` | `team-c/test/unit/bplustree.test.ts` | Implemented & Verified |
| Hashing | Locked decision | `team-c/src/storage/indexes/hashIndex.ts` | `team-c/test/unit/hashIndex.test.ts` | Implemented & Verified |
| Query processing | Locked decision | `team-c/src/storage/queryProcessor.ts`, `table.ts` | `team-c/test/unit/query.test.ts` | Implemented & Verified |
| Transactions / commit / rollback | Locked decision | `team-c/src/txn/transactionManager.ts` | `team-c/test/unit/txn.test.ts`, `offers.test.ts` | Implemented & Verified |
| Concurrency / locking | Locked decision | `team-c/src/concurrency/lockManager.ts` (Strict 2PL) | `team-c/test/unit/concurrency.test.ts` | Implemented & Verified |
| Recovery | Locked decision + Project Doc KPI | `team-c/src/storage/wal/recovery.ts`, `walWriter.ts` | `team-c/test/unit/recovery.test.ts`, `evidence/team-c-kpis.json` | Implemented & Verified |
| Audit | Locked decision + Project Doc C4 | `team-c/src/services/auditService.ts` | `team-c/test/contract/reports.test.ts`, `evidence/team-c-kpis.json` | Implemented & Verified |
| No external DBMS / disallowed packages | Locked decision (doc 00 §0.2.5) | Fully hand-built custom JSON DBMS, zero DB libraries | Codebase audit verified | Implemented & Verified |

## 8.3 Team feature contracts (C1–C4, A1–A4, B1–B4, D1–D4)

| Requirement | Source | Implementation File & Function | Verification Test Suite | Status |
| :--- | :--- | :--- | :--- | :--- |
| Team A feature contracts A1–A4 | Project Doc §4.1 | `team-a/src/queue/`, `rules/`, `locks/`, `telemetry/` | 44 Jest tests in `team-a/test/` (PASS) | Implemented & Verified |
| Team B feature contracts B1–B4 | Project Doc §4.2 | `team-b/src/graph/`, `ranking/`, `services/` | 31 Node test runner tests in `team-b/test/` (PASS) | Implemented & Verified |
| Team C feature contracts C1–C4 | Project Doc §4.3 | `team-c/src/services/`, `txn/`, `storage/`, `api/` | 32 Jest tests in `team-c/test/` (PASS) | Implemented & Verified |
| Team D feature contracts D1–D4 | Project Doc §4.4 | `team-d/server.ts`, `src/components/`, `portalApi.ts` | 7 BFF tests + 5 Playwright E2E tests (PASS) | Implemented & Verified |

## 8.4 Process requirements

| Requirement | Source | Implementation File & Function | Verification Test Suite | Status |
| :--- | :--- | :--- | :--- | :--- |
| Integration/delivery phases | Project Doc §7 | Phase 1 to Phase 6 completed across merge branch `integration` | All test suites passing | Implemented & Verified |
| Team-to-team handoff checklist | Project Doc §7.1 | Real HTTP API handoffs wired across all 4 services | `e2e/integration.test.ts` | Implemented & Verified |
| Simple Git workflow, one repo | Locked decision (doc 00 §0.2.11) | Single monorepo on branch `integration` | Git repository structure | Implemented & Verified |
| Definition of done | Project Doc §6.1 | OpenAPIs, unit/contract/e2e tests, failure flows, KPI evidence | Root `npm test` & `evidence/` | Implemented & Verified |
| Assessment evidence per team | Project Doc §8 | `evidence/` folder with JSON and CSV files | `scripts/generate-kpi-evidence.ts` (19/19 PASS) | Implemented & Verified |
| AI agent authority limits | Locked decision (doc 00 §0.2.12) | Antigravity final integrator role strictly adhering to locked decisions | Code and test integrity preserved | Implemented & Verified |

## 8.5 Resolved Clarifications

1. **Technology Stack:** TypeScript across all four services (Express backend engines for A, B, C, D BFF; React 18 + Vite for Team D frontend; Jest/Node Test Runner/Playwright for tests).
2. **Eligibility & Scheduling Coordination:** Team C calls Team A `POST /api/v1/eligibility/requests` to enqueue applications, and acquires slot leases via `POST /internal/v1/locks/acquire`. Leases are released on compensation via `DELETE /internal/v1/locks/:leaseId`.
3. **Shared Secret Distribution:** Shared `JWT_SIGNING_SECRET` defined in root `.env.example` and injected into service environments for cryptographically secure token validation across BFF and backend endpoints.
4. **Live Dashboard Outbox Streaming:** Team C exposes `GET /internal/v1/outbox/stream` using Server-Sent Events (SSE). Team D BFF bridges this stream to the browser via `GET /api/v1/ui/stream` to achieve real-time dashboard freshness without client-side polling.
