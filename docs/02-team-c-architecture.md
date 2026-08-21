# 02 — Team C Architecture (Placement Data & Transaction Manager)

Team C's mission, feature contracts (C1–C4), API exposure matrix, and KPI table are already fully specified in the Project Doc §4.3. This document defines the **internal architecture** an agent needs to actually build it — the Project Doc intentionally stops at "what," this document says "how it's structured."

## 2.1 Layered architecture **[LOCKED + SPEC]**

Team C must be built as five layers, each only calling the layer directly below it. No layer may skip a layer (e.g., a controller must never touch a JSON file directly).

```
┌─────────────────────────────────────────────────────────────┐
│ L1  API Layer            Express routes, auth, schema        │
│                           validation, correlation-id/idempo-  │
│                           tency handling, response envelope   │
├─────────────────────────────────────────────────────────────┤
│ L2  Service / Orchestration   Application state machine,      │
│                           calls out to Team A / Team B,       │
│                           compensation logic (C3)              │
├─────────────────────────────────────────────────────────────┤
│ L3  Transaction Manager   begin/commit/rollback, isolation,    │
│                           idempotency dedupe, wraps L4+L5       │
├─────────────────────────────────────────────────────────────┤
│ L4  Concurrency Control   Lock manager (shared/exclusive per    │
│                           record), wait-for graph / timeout      │
├─────────────────────────────────────────────────────────────┤
│ L5  Storage Engine        Table repositories, B+Tree index,      │
│                           hash index, query processor, WAL,       │
│                           recovery, audit/outbox                   │
├─────────────────────────────────────────────────────────────┤
│      Physical persistence: one JSON file per table + WAL file      │
│      + append-only audit log, all under /data                       │
└─────────────────────────────────────────────────────────────┘
```

L3–L5 collectively are "the custom DBMS." Their detailed design is `03-team-c-database-engine-design.md`. This document (02) only fixes the layer boundary and module map; 03 fixes the internals of L3–L5.

## 2.2 Why this shape **[SPEC — rationale, not a rule agents must repeat]**

- L1/L2 are ordinary API-service concerns; nothing here needs to be novel.
- L3/L4/L5 are where the Project Doc's required DBMS concepts live. Separating them from L1/L2 is what makes it possible to unit-test "does my B+Tree really split correctly" without spinning up HTTP.
- Everything below L3 is invisible to L1/L2 except through the Transaction Manager's API (`begin()`, `read()`, `write()`, `commit()`, `rollback()`). This is what prevents "the application must not directly manipulate JSON everywhere" from being violated by accident three files deep in a controller.

## 2.3 Folder structure **[SPEC — agent may adjust file names, not the layer boundary]**

```
team-c/
  src/
    api/                 # L1 — Express routers, one file per resource
      applications.routes.js
      drives.routes.js
      students.routes.js
      offers.routes.js
      audit.routes.js
      reports.routes.js
      middleware/
        auth.js
        correlationId.js
        idempotency.js
        errorEnvelope.js
        schemaValidate.js
    services/             # L2 — orchestration, one file per feature contract
      applicationService.js      # C2
      offerCommitService.js      # C3
      masterDataService.js       # C1
      auditReportService.js      # C4
      stateMachine.js            # enforces 01 §1.4 transition table
      teamAClient.js              # outbound calls to Team A
      teamBClient.js              # outbound calls to Team B
      outboxPublisher.js          # feeds Team D's SSE/WebSocket stream
    txn/                   # L3 — transaction manager
      transactionManager.js
      isolation.js
    concurrency/            # L4 — lock manager
      lockManager.js
      waitForGraph.js
    storage/                  # L5 — storage engine
      table.js                    # generic table repository
      recordFormat.js
      indexes/
        bplustree.js
        hashIndex.js
      query/
        queryProcessor.js
      wal/
        walWriter.js
        recovery.js
      audit/
        auditLog.js
    config/
      indexConfig.js              # which fields get which index (see 03 §3.7)
  data/                          # physical JSON + WAL + audit files (gitignored, seed script recreates)
  test/
    unit/
    contract/
    integration/
  seed/
    seedData.js
  server.js
```

## 2.4 Allowed vs disallowed npm packages **[LOCKED]**

**Allowed** (ordinary supporting packages — do not implement DBMS internals):
- `express` — HTTP server/router
- `uuid` — ID generation
- `ajv` or `joi` — request schema validation
- `jest` + `supertest` — testing
- `pino` or `winston` — logging
- `dotenv` — configuration

**Disallowed** for anything touching L3–L5 (would defeat the purpose of the assignment):
- Any embedded/file DB: `sqlite3`, `better-sqlite3`, `lowdb`, `nedb`, `pouchdb`, `level`/`leveldown`
- Any ORM/query builder: `sequelize`, `typeorm`, `prisma`, `knex`
- Any off-the-shelf B-tree/index library (`sorted-btree`, `bintrees`, etc.) — the B+Tree and hash index must be hand-written
- Any lock/mutex library that would replace the hand-written lock manager (e.g. `async-mutex` used to *implement* record locking rather than to protect an in-process critical section around your own lock manager's bookkeeping)
- Any job/queue broker (`bull`, `bee-queue`, `agenda`)

If an agent is unsure whether a package crosses this line, treat it as disallowed and flag per `06-ai-agent-rules.md` §6.1 escalation rule.

## 2.5 Outbound integration points **[PROJECT DOC, cross-referenced]**

Team C is a client of Team A and Team B for these calls (endpoints as defined in the Project Doc §4.1/§4.2):

| Team C calls | Purpose |
| --- | --- |
| `POST /api/v1/eligibility/requests` (Team A) | Kick off rule evaluation for a new application |
| `GET /api/v1/eligibility/requests/{requestId}` (Team A) | Poll/read decision state |
| `POST /internal/v1/locks/acquire` / `DELETE /internal/v1/locks/{leaseId}` (Team A) | Only if Team C needs to coordinate slot leases directly; normally Team A manages this internally and returns `lease_id` in its decision — see `05-teams-a-b-d-specifications.md` §5.1 for the exact handoff |
| `POST /api/v1/rankings/compute` (Team B) | Request a ranking once a drive needs candidate ordering |
| `PUT /internal/v1/profiles/students/{studentId}` / `PUT /internal/v1/profiles/drives/{driveId}` (Team B) | Push master-data updates so Team B's graph stays in sync — see `05...` §5.2 for sync policy |

`teamAClient.js` and `teamBClient.js` are the only files allowed to make these outbound calls — keeps the integration surface auditable in one place.
