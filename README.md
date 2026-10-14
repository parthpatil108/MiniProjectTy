# ApniLeap — Campus Placement Management Platform

**Rule-Based Placement Eligibility and Performance Analytics**  
*RIT CSE Mini Project Implementation — Academic Year 2026–27*  
*Final Integrated Monorepo (`integration` branch)*

---

## 1. Executive System Overview

ApniLeap is an enterprise-grade campus placement automation platform engineered collaboratively across four core computer science disciplines:

- **Team A (Operating Systems Engine — Port 3001):** Rule-queue scheduling (FIFO, circular, priority aging, binary heap), pluggable rule-chaining (Sequential AND, Weighted-Priority, Decision-Tree), concurrency lock manager with exclusive slot leases, and Wait-For-Graph DFS cycle/deadlock detection.
- **Team B (Data Structures Engine — Port 3002):** Bipartite skill-student-drive graph modeling (both Adjacency List and Adjacency Matrix), multi-strategy ranking (Weighted-Score, Heap Top-K, Merge Sort), self-balancing AVL Tree & Hash indices, and version-guarded shortlist caching.
- **Team C (Custom DBMS Engine — Port 3003):** **100% hand-built** JSON storage engine (no external DBMS/ORM libraries) featuring custom B+Tree with node split/merge, Hash index with bucket collision chaining and dynamic resizing, Write-Ahead Logging (WAL) with instant Redo/Undo crash recovery (RPO=0s, RTO<1s), Strict 2-Phase Locking (2PL), ACID transactions, append-only audit trail, and Server-Sent Events (SSE) outbox stream.
- **Team D (Web Frontend & BFF — Port 3004 / 5173):** Role-aware presentation portal (Student, Faculty TPO, Placement Admin) orchestrating backend services via an Express Backend-For-Frontend (BFF), JWT session authentication, live SSE streaming dashboard, and Playwright automated end-to-end testing.

Cross-service communication uses standard HTTP/JSON REST APIs versioned under `/api/v1` and `/internal/v1`, propagating distributed `X-Correlation-ID` traces and `Idempotency-Key` deduplication.

---

## 2. Service Architecture & Port Matrix

| Service | Subsystem / Discipline | HTTP Port | Health Endpoint | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Team A** | OS & Scheduling Engine | `3001` | `http://localhost:3001/healthz` | Eligibility checks, slot lease locking, deadlock analysis |
| **Team B** | Data Structures & Ranking | `3002` | `http://localhost:3002/healthz` | Skill graphs, ranking algorithms, cohort analytics |
| **Team C** | Custom DBMS System of Record | `3003` | `http://localhost:3003/healthz` | Master data, 2PL transactions, offer commits, WAL recovery |
| **Team D (BFF)** | Backend-for-Frontend | `3004` | `http://localhost:3004/healthz` | API aggregation, JWT auth, SSE live stream bridge |
| **Team D (UI)** | React / Vite Single Page App | `5173` | `http://localhost:5173/` | Modern browser portal for Students and Admins |

---

## 3. Quickstart & Installation

### Prerequisites
- Node.js `v20+` or `v22+` (v24 supported)
- npm `v10+`

### Step 1: Clone and Install Dependencies
```bash
git clone https://github.com/parthpatil108/MiniProjectTy.git
cd MiniProjectTy
git checkout integration

# Install root tools and dependencies across all 4 teams in one command
npm run install:all
```

### Step 2: Configure Environment
Copy the example environment configuration into the root and service directories:
```bash
cp .env.example .env
```
*(Default variables are pre-configured to bind services to ports 3001, 3002, 3003, 3004, and 5173 with a shared JWT secret).*

### Step 3: Seed Master Data
Initialize Team C's storage engine with deterministic seed records (20 students and 5 placement drives from `shared/fixtures/seed/`):
```bash
npm run seed
```

### Step 4: Build All Services
```bash
npm run build:all
```

### Step 5: Start the Full Platform
Start all four backend services and the Vite frontend concurrently:
```bash
npm run dev:all
```
Open your browser at `http://localhost:5173` to access the Placement Portal.

---

## 4. Running the Test Batteries

All services, contracts, integration paths, and KPIs are verified by automated test suites.

```bash
# Run ALL test suites across the entire monorepo in sequence:
npm test

# Or run specific layers individually:
npm run test:a           # Team A Jest suite (44 tests: queues, rules, locks, benchmarks)
npm run test:b           # Team B Node test runner (31 tests: graphs, rankings, trees, contracts)
npm run test:c           # Team C Jest suite (32 tests: B+Tree, Hash, 2PL, WAL recovery, offers)
npm run test:d           # Team D BFF contract tests (7 tests: JWT auth, RBAC, SSE stream)
npm run test:e2e         # End-to-End integration suite (5 flows: apply, rank, offer commit, RBAC)
npm run test:playwright  # Playwright browser E2E tests (5 flows: login, search, modal, keyboard, mobile)
npm run test:kpi         # Measured acceptance KPI benchmarks (produces raw evidence under evidence/)
```

---

## 5. 5-Step Demonstration Walkthrough for Evaluators

Follow this exact sequence to demonstrate the end-to-end integration to an evaluation committee:

### Step 1: Health Check & System Readiness
Verify all 4 microservices are healthy and communicating:
```bash
curl http://localhost:3001/healthz
# Returns: {"status":"UP","service":"team-a-scheduling"}

curl http://localhost:3002/healthz
# Returns: {"status":"UP","service":"team-b-ranking"}

curl http://localhost:3003/healthz
# Returns: {"status":"UP","service":"team-c-data-engine"}

curl http://localhost:3004/healthz
# Returns: {"status":"UP","service":"team-d-bff"}
```

### Step 2: Student Authentication & Role-Based Security
1. Open `http://localhost:5173` in any browser.
2. Select the **Student** role. Enter `student@placify.edu` (password: `demo123`) and click **Sign In**.
3. Observe the personalized dashboard showing student academic progress, active placement drives, and real-time announcements.
4. Open the Developer Tools Network tab: observe that the session is backed by a signed JWT issued by Team D BFF (`POST /api/v1/ui/session`) and all subsequent requests carry `Authorization: Bearer <token>`.

### Step 3: Drive Discovery, Eligibility Pre-Check & Application
1. In the sidebar, click **Placement Drives**.
2. Type `Google` or `TechCorp` in the live search bar: observe instantaneous client-side filtering.
3. Click **View drive details** on any drive to open the modal.
4. Click **Check eligibility**: Team D calls Team A's rule engine, verifying CGPA cutoff, backlog restrictions, and branch allow-lists.
5. Check the confirmation checkbox and click **Submit application**: Team D calls Team C with an `Idempotency-Key` and `X-Correlation-ID`, creating an application in `APPLIED` state and enqueuing it in Team A's scheduling queue.

### Step 4: Placement Admin Drive Controls & RBAC Enforcement
1. Log out and switch to the **Placement Admin** role (`admin@placify.edu`).
2. Notice the elevated administrative navigation items appear: **Drive Management** and **Reports**.
3. Click **Drive Management** to view drive controls (`Administrative actions`).
4. Attempting to PATCH drive criteria with a student token is strictly rejected with HTTP `403 FORBIDDEN` by the BFF security guard.

### Step 5: Live SSE Streaming & Crash Recovery
1. The dashboard connects to `GET /api/v1/ui/stream` (relayed from Team C's outbox SSE stream `GET /internal/v1/outbox/stream`).
2. Whenever an offer is committed or an application changes state, an outbox event is pushed to the browser in real time without polling.
3. Run `npm run test:c`: observe Team C's WAL crash recovery simulation where uncommitted transactions are rolled back (Undo phase) and committed transactions are reconstructed (Redo phase) with 0 data loss.

---

## 6. KPI Summary Table

All KPIs from `docs/project-description.md` have been evaluated. Raw data files are recorded in `evidence/`.

| KPI ID | Subsystem | Metric Name | Target | Measured Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A-KPI-01** | Team A | Rule Correctness | 100% reference match | 100.0% (Sequential, Weighted, Tree) | **PASS** |
| **A-KPI-02** | Team A | Decision Latency | p95 ≤ 200 ms (1,000 requests) | **p95 = 0.11 ms** (avg = 0.05 ms) | **PASS** |
| **A-KPI-03** | Team A | Slot Allocation Safety | 0 duplicate exclusive leases | **0 duplicates** (1,000 attempts) | **PASS** |
| **A-KPI-04** | Team A | Deadlock Detection | 100% seeded cycles caught | **100% caught in 0.02 ms** | **PASS** |
| **B-KPI-01** | Team B | Ranking Correctness | 100% order correctness | **100% monotonically ordered** | **PASS** |
| **B-KPI-02** | Team B | Computation Latency | p95 ≤ 100 ms | **p95 = 0.24 ms** (avg = 0.09 ms) | **PASS** |
| **B-KPI-03** | Team B | Shortlist Lookup Speed | p95 lookup ≤ 1 ms | **p95 = 0.002 ms** (Dual Hash/AVL) | **PASS** |
| **B-KPI-04** | Team B | Cache Hit Effectiveness | ≥80% hit rate | **100.0% hit rate** | **PASS** |
| **B-KPI-05** | Team B | Dual Graph Representation | Both List and Matrix | Verified (AdjacencyList + Matrix) | **PASS** |
| **C-KPI-01** | Team C | Transaction ACID Integrity | 100% ACID compliance | **100% (Commit saved, Rollback discarded)** | **PASS** |
| **C-KPI-02** | Team C | Application Idempotency | 0 duplicate applications | **Exactly 1 record / 0 duplicates** | **PASS** |
| **C-KPI-03** | Team C | Query Performance | p95 ≤ 200 ms | **p95 = 0.002 ms** (B+Tree & Hash) | **PASS** |
| **C-KPI-04** | Team C | Audit Trail Completeness | 100% correlation ID coverage | **100% audited with trace ID** | **PASS** |
| **C-KPI-05** | Team C | Crash Recovery (RTO/RPO) | RPO ≤ 5 min, RTO ≤ 30 min | **RPO = 0s, RTO < 1s** | **PASS** |
| **E2E-KPI-01**| Cross-Team | Workflow Correctness | 100% legal transitions | **100% (0 illegal transitions permitted)** | **PASS** |
| **E2E-KPI-02**| Cross-Team | Traceability Propagation | 100% trace ID propagated | **100% across all 4 services** | **PASS** |
| **E2E-KPI-03**| Cross-Team | Role-Based Security | 0 unauthorized actions | **0 leaks (401/403 enforced)** | **PASS** |
| **D-KPI-01** | Team D | Accessibility & Keyboard | 100% keyboard operable | **100% operable; 5/5 Playwright tests** | **PASS** |
| **D-KPI-02** | Team D | Error Code Mapping | 100% backend errors mapped | **100% mapped (400, 401, 403, 404, 409)** | **PASS** |
