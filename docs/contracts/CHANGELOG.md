# Contract Changes and Additive Reconciliations

This document logs all additive schema, parameter, or endpoint reconciliations made during final integration, per Step 2e of the integration spec. No breaking changes, removed fields, modified codes, or altered state machine transitions were introduced.

---

## 1. Team C — Outbox SSE Streaming Endpoint (Additive)

- **Endpoint Added:** `GET /internal/v1/outbox/stream`
- **Consumer:** Team D BFF (Live Updates SSE relay)
- **Protocol:** HTTP Server-Sent Events (`text/event-stream`)
- **Rationale:** Section 1.2 and 4.4 (D3) of `docs/project-description.md` mandate that Team C outbox events stream state changes in real time to Team D for live dashboard freshness without polling. This endpoint tails newly written outbox events and streams them as JSON payloads.
- **Contract Impact:** Strictly additive. Existing `/internal/v1/*` endpoints remain unchanged.

---

## 2. Team B — OpenAPI Contract & Response Envelope Alignment (Additive)

- **Parameter Normalization:**
  - `POST /api/v1/rankings/compute` accepts both `drive_id` and `driveId`.
  - `PUT /internal/v1/profiles/drives/:driveId` accepts both `company` and `company_name` (as provided by Team C master data).
  - `RankingResult` includes both `ordered_candidates` and `shortlist` alias.
- **Field Addition:**
  - `POST /api/v1/rankings/compute` returns `graph_version` identifying the exact graph version snapshot used to compute rankings.
- **Contract Impact:** Strictly additive. Existing fields and response structures remain preserved.

---

## 3. Team D — BFF Server Route Set (Additive)

- **Endpoints Exposed by BFF:**
  - `POST /api/v1/ui/session` (Issues JWT session token)
  - `DELETE /api/v1/ui/session` (Terminates session)
  - `GET /api/v1/ui/me` (Validates JWT claims)
  - `GET /api/v1/ui/drives` (Proxies drives with criteria from Team C)
  - `POST /api/v1/ui/applications` (Proxies idempotent application submission to Team C)
  - `GET /api/v1/ui/applications/:id` (Aggregates application, queue, and decision status)
  - `GET /api/v1/ui/dashboard` (Aggregates stats, drives, applications, and alert feed)
  - `GET /api/v1/ui/stream` (SSE live event stream connected to Team C outbox)
  - `GET /api/v1/ui/rankings` & `POST /api/v1/ui/rankings/preview` (Queries rankings from Team B)
  - `PATCH /api/v1/ui/drives/:id` (Role-guarded drive status management; Placement_Admin only)
  - `GET /api/v1/ui/reports/placement-performance` (Aggregates reports from Team C and metrics from Team A/B)
- **Contract Impact:** Strictly matches `shared/contracts/openapi/team-d.openapi.yaml` (if present) and `docs/project-description.md` §4.4 API matrix.
