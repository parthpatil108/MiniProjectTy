# ApniLeap — Campus Placement Management Platform

**Rule-Based Placement Eligibility, Interview Concurrency Locks, and Merit Analytics**  
*Production Release (`release/production-ready` branch)*

---

## 1. Executive System Overview

**ApniLeap** is a production-grade campus recruitment automation platform engineered across four core computer science disciplines:

- **Team A (`services/eligibility` — Port 3001):** Rule-queue scheduling (FIFO, circular, priority aging, binary heap), pluggable rule-chaining (Sequential AND, Weighted-Priority, Decision-Tree), concurrency lock manager with exclusive slot leases, and Wait-For-Graph DFS cycle/deadlock detection.
- **Team B (`services/ranking` — Port 3002):** Bipartite skill-student-drive graph modeling (both Adjacency List and Adjacency Matrix), multi-strategy ranking (Weighted-Score, Heap Top-K, Merge Sort), self-balancing AVL Tree & Hash indices, and version-guarded shortlist caching.
- **Team C (`services/data-engine` — Port 3003):** **100% hand-built** JSON storage engine (no external DBMS/ORM libraries) featuring custom B+Tree with node split/merge, Hash index with bucket collision chaining and dynamic resizing, Write-Ahead Logging (WAL) with instant Redo/Undo crash recovery (RPO=0s, RTO<1s), Strict 2-Phase Locking (2PL), ACID transactions, append-only audit trail, and Server-Sent Events (SSE) outbox stream.
- **Team D (`apps/bff` — Port 3004 & `apps/web` — Port 5173):** Role-aware presentation portal (Student, Faculty TPO, Placement Admin) orchestrating backend services via an Express Backend-For-Frontend (BFF), JWT session authentication, live SSE streaming dashboard, and Playwright automated end-to-end testing.

Cross-service communication uses standard HTTP/JSON REST APIs versioned under `/api/v1` and `/internal/v1`, propagating distributed `X-Correlation-ID` traces, `Idempotency-Key` deduplication, and `X-Service-Token` HMAC authentication.

---

## 2. Architecture Diagram & Monorepo Structure

```
                  ┌──────────────────────────────┐
                  │      Client Browser          │
                  └──────────────┬───────────────┘
                                 │ HTTP (:5173 / :80)
                  ┌──────────────▼───────────────┐
                  │   apps/web (React 18 / Vite) │
                  └──────────────┬───────────────┘
                                 │ REST Proxy (:3004)
                  ┌──────────────▼───────────────┐
                  │    apps/bff (Express BFF)    │
                  └───────┬──────────┬───────────┘
                          │          │
         ┌────────────────┼──────────┴───────────────┐
         │                │                          │
┌────────▼─────────┐ ┌────▼─────────────┐ ┌──────────▼───────────────┐
│ services/        │ │ services/        │ │ services/                 │
│ eligibility      │ │ ranking          │ │ data-engine (DBMS)        │
│ Port: 3001       │ │ Port: 3002       │ │ Port: 3003                │
│ Exclusive Locks  │ │ Skill Graph &    │ │ Hand-built JSON DBMS      │
│ Deadlock DFS     │ │ AVL Shortlists   │ │ B+Tree, 2PL, WAL          │
└──────────────────┘ └──────────────────┘ └──────────┬────────────────┘
                                                     │
                                            ┌────────▼────────┐
                                            │ apnileap-data   │
                                            │ Persistent Disk │
                                            └─────────────────┘
```

### Monorepo Workspaces Layout
```
MiniProjectTy/
├── apps/
│   ├── bff/               # Team D Express Backend-For-Frontend (Port 3004)
│   └── web/               # Team D React 18 / Vite Accessible Portal (Port 5173)
├── services/
│   ├── eligibility/       # Team A Rule Queues, Locks & Deadlock Detection (Port 3001)
│   ├── ranking/           # Team B Bipartite Graph, Heap Top-K & AVL Index (Port 3002)
│   └── data-engine/       # Team C Hand-built DBMS: B+Tree, 2PL, WAL, Outbox (Port 3003)
├── packages/
│   ├── common/            # Shared Zod Config, Scrypt Hashing, JWT/Service Auth, Pino Logger
│   └── fixtures/          # Master seed datasets (20 students, 5 drives, accounts)
├── infra/
│   ├── docker/            # Multi-stage Dockerfiles & Docker Compose (dev and prod)
│   └── nginx/             # Production Nginx reverse proxy configuration
├── scripts/
│   ├── seed.ts            # Front-door master data seeding script
│   └── smoke.ts           # Cross-platform end-to-end smoke verification script
├── tests/
│   ├── e2e/               # Playwright browser test suite
│   ├── integration/       # Cross-team distributed flow integration suite
│   └── kpi/               # Performance benchmark evidence generation
└── docs/                  # Architecture Decision Records, Deployment, Security & Runbooks
```

---

## 3. Quickstart Guide (< 5 Commands)

### 3.1 Local Development
```bash
# 1. Clone repository
git clone https://github.com/parthpatil108/MiniProjectTy.git
cd MiniProjectTy
git checkout release/production-ready

# 2. Install monorepo dependencies
npm install

# 3. Build all workspaces
npm run build

# 4. Verify test batteries
npm run test:all

# 5. Launch all services concurrently
npm run dev
```

Visit the application at **http://localhost:5173**.

### 3.2 Docker Compose Deployment
```bash
# Build and run all services with container healthchecks and persistent volume
docker compose -f infra/docker/docker-compose.yml up --build -d

# Verify container status
docker compose -f infra/docker/docker-compose.yml ps
```

Visit the application at **http://localhost**.

---

## 4. Default Demo Accounts

The database auto-seeds these verified institutional accounts on boot:

| Role | Email | Password | Primary Capabilities |
|---|---|---|---|
| **Student** | `student@apnileap.edu` | `demo123` | Browse drives, evaluate criteria, apply, reserve slot locks |
| **Faculty / TPO** | `faculty@apnileap.edu` | `demo123` | Department placement analytics, candidate ranking previews |
| **Placement Admin** | `admin@apnileap.edu` | `demo123` | Post drives, criteria configuration, WAL verification, audit trail |

*(The login screen also provides 1-click Quick Demo buttons for each role).*

---

## 5. Automated Verification Suites

```bash
# Run all unit and contract tests across all 4 services
npm run test:unit

# Run individual service test suites
npm run test:a           # Team A (Eligibility & Scheduling) - 45 passed
npm run test:b           # Team B (Ranking & Skill Graph) - 32 passed
npm run test:c           # Team C (Data Engine DBMS) - 43 passed
npm run test:d           # Team D (BFF & Security) - 14 passed

# Run cross-team end-to-end integration tests
npm run test:integration # 5 passed (100% correlation ID coverage)

# Run KPI performance benchmark evidence generator
npm run test:kpi         # 19 passed

# Run Playwright browser UI tests
npm run test:playwright

# Run production smoke test against live ports
npm run smoke
```

---

## 6. Key Performance Indicators (KPIs)

All targets from project specifications have been evaluated and verified:

| KPI ID | Subsystem | Metric Name | Target | Measured Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A-KPI-01** | Team A | Rule Evaluation Correctness | 100% match | **100.0%** (Sequential, Weighted, Tree) | **PASS** |
| **A-KPI-02** | Team A | Decision Latency | p95 ≤ 200 ms | **p95 = 0.11 ms** | **PASS** |
| **A-KPI-03** | Team A | Slot Allocation Safety | 0 duplicate leases | **0 duplicates** (1,000 attempts) | **PASS** |
| **A-KPI-04** | Team A | Deadlock Detection Speed | 100% cycles caught | **100% in 0.02 ms** | **PASS** |
| **B-KPI-01** | Team B | Ranking Order Monotonicity | 100% order correctness| **100% strictly ordered** | **PASS** |
| **B-KPI-02** | Team B | Computation Latency | p95 ≤ 100 ms | **p95 = 0.24 ms** | **PASS** |
| **B-KPI-03** | Team B | Shortlist Lookup Speed | p95 lookup ≤ 1 ms | **p95 = 0.002 ms** | **PASS** |
| **B-KPI-04** | Team B | Cache Hit Effectiveness | ≥80% hit rate | **100.0% hit rate** | **PASS** |
| **B-KPI-05** | Team B | Dual Graph Representation | Both List and Matrix | **Verified (AdjacencyList + Matrix)** | **PASS** |
| **C-KPI-01** | Team C | Transaction ACID Integrity | 100% ACID compliance | **100% (Commit saved, Rollback discarded)** | **PASS** |
| **C-KPI-02** | Team C | Application Idempotency | 0 duplicate records | **Exactly 1 record / 0 duplicates** | **PASS** |
| **C-KPI-03** | Team C | Point Query Latency | p95 ≤ 200 ms | **p95 = 0.002 ms** (B+Tree & Hash) | **PASS** |
| **C-KPI-04** | Team C | Audit Trail Completeness | 100% trace ID coverage| **100% audited with trace ID** | **PASS** |
| **C-KPI-05** | Team C | Crash Recovery (RTO/RPO) | RPO ≤ 5 min, RTO ≤ 30 min | **RPO = 0s, RTO < 1s** | **PASS** |
| **E2E-KPI-01**| Cross-Team | Workflow Correctness | 100% legal transitions| **100% legal transitions enforced** | **PASS** |
| **E2E-KPI-02**| Cross-Team | Traceability Propagation | 100% trace ID propagated| **100% across all 4 services** | **PASS** |
| **E2E-KPI-03**| Cross-Team | Role-Based Security | 0 unauthorized actions| **0 unauthorized actions (401/403)** | **PASS** |

---

## 7. Documentation Index

- [Production Deployment Guide](file:///c:/Users/HP/OneDrive/Desktop/MiniProjectTy/docs/DEPLOYMENT.md)
- [Security & Threat Mitigation Specification](file:///c:/Users/HP/OneDrive/Desktop/MiniProjectTy/docs/SECURITY.md)
- [Operational Runbook & Troubleshooting](file:///c:/Users/HP/OneDrive/Desktop/MiniProjectTy/docs/RUNBOOK.md)
- [Architecture Decision Records (ADRs)](file:///c:/Users/HP/OneDrive/Desktop/MiniProjectTy/docs/DECISIONS.md)
- [Final System Integration & Release Report](file:///c:/Users/HP/OneDrive/Desktop/MiniProjectTy/docs/reports/FINAL-REPORT.md)
