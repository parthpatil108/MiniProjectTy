# Team C — Data & Transaction Manager

Team C is responsible for the **Placement Data & Transaction Manager**, serving as the authoritative system of record for the Campus Placement Eligibility & Analytics Platform. It is built entirely in Node.js and TypeScript on a custom JSON-file database engine without using external DBMS products, ORMs, or indexing libraries.

---

## Key Features & Completed Milestones

### Milestone M1 — Storage Manager + Custom Hash Index + Custom B+Tree

- **Custom Hash Index (`src/storage/indexes/hashIndex.ts`)**: Implements FNV-1a 32-bit hashing, explicit bucket array with separate chaining for collision resolution, and dynamic load-factor resizing ($\ge 0.75$).
- **Custom B+Tree Index (`src/storage/indexes/bplustree.ts`)**: Configurable branching factor order $M$, internal nodes (keys + child pointers), leaf nodes linked bidirectionally (`next`/`prev`) for range scans, node splitting on overflow, and underflow handling (borrowing from left/right siblings or node merging).
- **Storage Manager (`src/storage/table.ts` & `src/storage/storageManager.ts`)**: Manages in-memory record sets and maintains configured hash and B+Tree indexes (`src/config/indexConfig.ts`) incrementally without rebuilding on reads.

### Milestone M2 — Write-Ahead Logging (WAL) + Transaction Manager + Lock Manager

- **Write-Ahead Log & Recovery (`src/storage/wal/walWriter.ts` & `src/storage/wal/recovery.ts`)**: Append-only log (`data/wal.log`) tagged with monotonically increasing LSNs. Sync-flushes on `COMMIT`. On startup, replays committed transactions from the last checkpoint (`data/wal.checkpoint`) and discards uncommitted/aborted transactions.
- **Lock Manager & Wait-For Graph (`src/concurrency/lockManager.ts` & `src/concurrency/waitForGraph.ts`)**: Per-record Shared (S) and Exclusive (X) locks with real-time Wait-For Graph cycle detection for deadlocks (`LOCK_TIMEOUT`).
- **Transaction Manager (`src/txn/transactionManager.ts`)**: Enforces Strict Two-Phase Locking (Serializable isolation) with `begin()`, `read()`, `write()`, `commit()`, and `rollback()`.

### Milestone M3 — Master Data CRUD over HTTP (C1)

- **Express API Layer & Master Data Service (`src/api/` & `src/services/masterDataService.ts`)**: Exposes master data endpoints for student profiles and placement drives. All writes route strictly through L3 Transaction Manager.
- **Response & Error Envelopes (`src/api/middleware/`)**: Standardized success and error response envelopes matching `shared/contracts/openapi/common-envelope.yaml` and propagating `X-Correlation-ID`.

### Milestone M4 — Application Management, Idempotency & Optimistic Concurrency (C2)

- **Application Service (`src/services/applicationService.ts`)**: Creates and updates placement applications within single transactions.
- **Idempotency Key Deduplication**: Checks `idempotency_key` Hash Index prior to transaction execution and returns stored responses on duplicate submissions.
- **Application State Machine (`src/services/stateMachine.ts`)**: Enforces legal state transition sequences; rejects invalid transitions with `STATE_CONFLICT` (409).
- **Optimistic Concurrency Control**: Validates expected record versions against `_version` on updates; rejects stale updates with `VERSION_MISMATCH` (409).

---

## Architecture & Layering Model

Team C follows a strict 5-layer architecture where each layer only calls the layer directly below it:

```
┌─────────────────────────────────────────────────────────────┐
│ L1  API Layer            Express routers, middleware, auth,  │
│                           correlation-ID, error envelope      │
├─────────────────────────────────────────────────────────────┤
│ L2  Service Layer        MasterDataService, Application-     │
│                           Service, ApplicationStateMachine    │
├─────────────────────────────────────────────────────────────┤
│ L3  Transaction Manager   Strict 2PL (begin, commit,         │
│                           rollback), WAL protocol integration │
├─────────────────────────────────────────────────────────────┤
│ L4  Concurrency Control   LockManager (per-record S/X locks), │
│                           WaitForGraph cycle detection        │
├─────────────────────────────────────────────────────────────┤
│ L5  Storage Engine        StorageManager, StorageTable,       │
│                           BPlusTree, HashIndex, WAL Writer    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ How to Run & Test

### Prerequisites

- Node.js (v18 or higher recommended)
- `npm`

### Installation

Navigate to the `team-c` directory and install dependencies:

```bash
cd team-c
npm install
```

### Build TypeScript

Compile TypeScript source files to `dist/`:

```bash
npm run build
```

### Run Tests

Execute all unit, contract, and concurrency integration tests:

```bash
npm test
```

_Runs 9 test suites / 25 test cases covering B+Tree splits/merges, hash collisions/resizing, WAL crash recovery, deadlock detection, OpenAPI contracts, idempotency, and version conflicts._

### Start Development Server

Start the service with automatic reload (`ts-node-dev`):

```bash
npm run dev
```

### Start Production Server

Start the compiled production server:

```bash
npm start
```

The server will run on port `3003` (or the `PORT` specified in `.env`).

---

## API Endpoints Reference

| Method  | Endpoint                                       | Description                                             | Layer / Scope   |
| ------- | ---------------------------------------------- | ------------------------------------------------------- | --------------- |
| `GET`   | `/healthz`                                     | Health check and uptime counter                         | Public          |
| `POST`  | `/api/v1/students`                             | Register a new student profile                          | C1 Master Data  |
| `GET`   | `/api/v1/drives`                               | List placement drives (optional `?state=` query filter) | C1 Master Data  |
| `GET`   | `/api/v1/drives/:driveId/criteria`             | Read drive criteria and seat capacity                   | C1 Master Data  |
| `PATCH` | `/internal/v1/drives/:driveId`                 | Update drive criteria or seats with `expectedVersion`   | C1 Internal     |
| `POST`  | `/api/v1/applications`                         | Create placement application with `Idempotency-Key`     | C2 Applications |
| `GET`   | `/api/v1/applications/:applicationId`          | Read application state and references                   | C2 Applications |
| `POST`  | `/api/v1/applications/:applicationId/withdraw` | Withdraw application with optimistic version check      | C2 Applications |

---

## Documentation Links

- [00 — Overview and Decisions](../docs/00-overview-and-decisions.md)
- [01 — Shared Contracts & Data Model](../docs/01-shared-contracts-and-data-model.md)
- [02 — Team C Architecture](../docs/02-team-c-architecture.md)
- [03 — Team C Custom Database Engine Design](../docs/03-team-c-database-engine-design.md)
- [04 — Team C Implementation Plan](../docs/04-team-c-implementation-plan.md)
- [Team C OpenAPI 3 Spec](../shared/contracts/openapi/team-c.openapi.yaml)
