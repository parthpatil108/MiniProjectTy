# ApniLeap Operational Runbook

## 1. Quickstart (< 10 Commands)

Get ApniLeap running locally from a clean clone in 5 commands:

```bash
# 1. Clone repo and switch to release branch
git clone https://github.com/parthpatil108/MiniProjectTy.git
cd MiniProjectTy
git checkout release/production-ready

# 2. Install monorepo dependencies
npm install

# 3. Build all workspaces
npm run build

# 4. Run full test verification (unit, contract, integration, KPI)
npm run test:all

# 5. Launch all services concurrently (Team A, B, C, BFF, and Vite UI)
npm run dev
```

Visit the portal at **http://localhost:5173** and login using any of the quick demo buttons.

---

## 2. Standard Operational Workflows

### 2.1 Running Automated Test Suites
```bash
# Run all unit and contract tests across all 4 services
npm run test:unit

# Run individual service tests
npm run test:a    # Team A (Eligibility & Scheduling) - 45 tests
npm run test:b    # Team B (Ranking & Graph) - 32 tests
npm run test:c    # Team C (Data Engine DBMS) - 43 tests
npm run test:d    # Team D (BFF & Security) - 14 tests

# Run cross-team end-to-end integration flows
npm run test:integration

# Run performance KPI benchmark evidence
npm run test:kpi

# Run Playwright browser UI tests
npm run test:playwright
```

### 2.2 Re-seeding Master Data
To reset students, recruitment drives, and demo accounts:
```bash
npm run seed
```
Default accounts seeded:
- **Student:** `student@apnileap.edu` / `demo123`
- **Faculty / TPO:** `faculty@apnileap.edu` / `demo123`
- **Placement Admin:** `admin@apnileap.edu` / `demo123`

### 2.3 Executing End-to-End Smoke Verification
Verify all `/healthz` endpoints, authentication, drives listing, and SSE event streaming:
```bash
npm run smoke
```

---

## 3. Production Troubleshooting Guide

### 3.1 Port In Use Errors
If ports 3001, 3002, 3003, 3004, or 5173 are bound by existing processes:
```powershell
# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001,3002,3003,3004,5173).OwningProcess | Stop-Process -Force
```
```bash
# Linux / macOS
lsof -ti:3001,3002,3003,3004,5173 | xargs kill -9
```

### 3.2 Outbox Queue & DLQ Retries
When downstream microservices (Team A or Team B) experience transient network partitions, Team C holds unacknowledged events in the Outbox:
```bash
# Check outbox status and dead-letter count
curl http://localhost:3003/internal/v1/outbox/status \
  -H "X-Service-Token: internal-service-auth-key-2026-secure"
```
The Outbox engine automatically retries pending events using exponential backoff ($1\text{s}, 2\text{s}, 4\text{s}, 8\text{s}, 16\text{s}, 32\text{s}$) up to 5 attempts before placing them in the `DEAD_LETTER` state.

### 3.3 Deadlock Cycle Detection & Resolution
Team A maintains an internal `WaitForGraph` tracking interview slot locks. To analyze active dependency edges and detect circular wait cycles:
```bash
curl -X POST http://localhost:3001/internal/v1/deadlocks/analyse \
  -H "X-Service-Token: internal-service-auth-key-2026-secure"
```
Response:
```json
{
  "status": "success",
  "data": {
    "has_cycle": false,
    "cycle_nodes": [],
    "active_edges": 0
  }
}
```

### 3.4 Table Durability & WAL Recovery Inspection
If a process crashes during writes, Team C's `WalRecovery` engine automatically recovers committed state upon the next boot.
To manually trigger a checkpoint and verify consistency:
```bash
curl -X POST http://localhost:3003/internal/v1/recovery/checkpoint \
  -H "X-Service-Token: internal-service-auth-key-2026-secure"
```
