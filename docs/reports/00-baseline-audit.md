# 00 — Baseline Audit & Reproduction Report
**Project:** ApniLeap (RIT CSE Mini Project Implementation)  
**Date:** October 14, 2026  
**Auditor:** Principal Full-Stack Engineer & Release Manager  
**Branch:** `integration` (prior to `release/production-ready`)  
**Status:** Baseline Established — All Audit Findings Confirmed & Documented  

---

## 1. Executive Summary

A comprehensive baseline evaluation of the ApniLeap repository (`parthpatil108/MiniProjectTy`, branch `integration`) was executed prior to architectural restructuring. While individual test runners reported passing status within their isolated in-memory or mock configurations, the platform as an integrated production product exhibits severe security vulnerabilities, data integrity risks, brittle cross-service handoffs, and an unmaintainable mock-dependent frontend.

Every issue flagged in the master prompt audit has been independently reproduced and verified with real command output.

---

## 2. Baseline Test & Build Results

### 2.1 Test Battery Execution

| Test Suite | Command | Result | Pass/Fail | Duration | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Team A** (Scheduling) | `npm run test:a` | 5 suites, 44 tests | **44 PASS / 0 FAIL** | 20.57 s | Passes in-memory; benchmark tests scaled down. |
| **Team B** (Ranking) | `npm run test:b` | 1 suite, 31 tests | **31 PASS / 0 FAIL** | 3.16 s | Compiles to nested `dist/src` / `dist/test` (`rootDir: "."`). |
| **Team C** (DBMS Engine) | `npm run test:c` | 10 suites, 32 tests | **32 PASS / 0 FAIL** | 11.49 s | Emits numerous `fetch failed` warnings (D3); writes to `data/` (D2). |
| **Team D** (BFF Contract) | `npm run test:d` | 1 suite, 7 tests | **7 PASS / 0 FAIL** | 4.58 s | Tests only token signing and mock response envelopes. |
| **Cross-Team E2E** | `npm run test:e2e` | 1 suite, 5 tests | **5 PASS / 0 FAIL** | 4.26 s | Passes with in-process mock instances. |
| **KPI Benchmarks** | `npm run test:kpi` | 19 metrics | **19 PASS / 0 FAIL** | 5.50 s | In-process, synthetic benchmarks. |
| **Playwright UI E2E** | `npm run test:playwright` | 5 browser tests | **5 PASS / 0 FAIL** | 13.70 s | **MOCK ONLY**: exercises Vite frontend with `VITE_USE_MOCK_API=true` (B4). |

### 2.2 Compilation & Startup Verifications

- **`npm run build:all`**: Exits with code 0 (`team-a`, `team-b`, `team-c` compile via `tsc`; `team-d` builds frontend Vite bundle to `dist/`).
- **`npm start --prefix team-d`**: **FAILS with code 1**:
  ```
  MODULE_NOT_FOUND: Cannot find module 'C:\Users\HP\OneDrive\Desktop\MiniProjectTy\team-d\server.js'
  ```
  `server.ts` is never compiled into `server.js`. The BFF has no production serving script (B1).

---

## 3. Verified Audit Findings (Item-by-Item)

### 3.1 Security Findings (Critical)

- **[CONFIRMED] S1. Fake Login:**
  - File: `team-d/server.ts:38-62`
  - Code:
    ```typescript
    app.post('/api/v1/ui/session', (req: Request, res: Response) => {
      const { user_id, role, email } = req.body || {};
      const effectiveUserId = user_id || (email ? email.split('@')[0] : 'STU-1001');
      const effectiveRole = role || 'Student';
      const token = jwt.sign({ user_id: effectiveUserId, role: effectiveRole }, JWT_SECRET, { expiresIn: '1h' });
      ...
    ```
  - Finding: No password verification, no database lookup, client can request any arbitrary role (including `Placement_Admin`) and receive a signed JWT.

- **[CONFIRMED] S2. Admin Guard Fails Open:**
  - File: `team-d/server.ts:348-364`
  - Code:
    ```typescript
    app.patch('/api/v1/ui/drives/:driveId', async (req: Request, res: Response) => {
      const authHeader = req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
          if (decoded.role !== 'Placement_Admin') {
            return res.status(403).json({...});
          }
        } catch {}
      }
      // Requests without token or with invalid tokens proceed directly to proxy!
    ```
  - Finding: Omitting the `Authorization` header completely bypasses the role check, proxying mutations directly to Team C.

- **[CONFIRMED] S3. Lack of Token Verification Across Services:**
  - Endpoints in Team A (`team-a/src/routes/eligibilityRoutes.ts`), Team B (`team-b/src/app.ts`), and Team C (`team-c/src/api/*.routes.ts`) do not inspect, parse, or verify JWTs or internal service tokens.
  - `/internal/v1/*` routes on all services are completely unauthenticated and accessible to any caller.

- **[CONFIRMED] S4. Hard-Coded Fallback Secrets & Inconsistent Env Vars:**
  - `team-d/server.ts:13`: `process.env.JWT_SIGNING_SECRET || process.env.JWT_SECRET || 'apnileap-shared-secret-key-2026'`
  - `team-a/src/config/env.ts:11`: `process.env.JWT_SIGNING_SECRET || 'changeme'`
  - Fallback keys allow attackers to forge tokens if environment variables are missing.

- **[CONFIRMED] S5. Permissive Network & Input Hygiene:**
  - Every service invokes `app.use(cors())` with default wildcard origins (`*`).
  - No `helmet` security headers, no request body size limits, no rate limiting, and no Zod/Joi schema validation on request bodies across any microservice.

---

### 3.2 Frontend Findings (Team D)

- **[CONFIRMED] F1. Runs on Mock API by Default:**
  - `team-d/src/services/portalApi.ts:3`: `export const useMockApi = import.meta.env.VITE_USE_MOCK_API !== 'false';`
  - `team-d/.env.example:5`: `VITE_USE_MOCK_API=true`
  - Every function in `portalApi.ts` catches backend errors and silently falls back to local in-memory objects:
    ```typescript
    if (!useMockApi) {
      try {
        return await request<AuthSession>('/api/v1/ui/session', ...);
      } catch {}
    }
    // Returns mock session
    ```

- **[CONFIRMED] F2. Hard-Coded Mock Analytics & State:**
  - `team-d/src/components/AnalyticsView.tsx`: Render is tied to `analyticsMock` with a hardcoded `<span className="status-pill">Mock data</span>` badge.
  - `team-d/src/App.tsx`: Initial dashboard data hardcodes "Priya Sharma", static student counts, and "11s ago" fake notification events.

- **[CONFIRMED] F3. Monolithic Frontend Architecture:**
  - `App.tsx`: 511-line monolith managing all view transitions via local `useState<string>('dashboard')`.
  - No client-side routing: No URLs, no browser history, no deep-linking, no 404 page.
  - `team-d/src/index.css`: 1,572 lines in a single global stylesheet.
  - `AnalyticsView.tsx`: Single JSX line exceeding 4.5 KB.
  - Branding inconsistency: UI, mock accounts, and test specs refer to "Placify" instead of "ApniLeap".

- **[CONFIRMED] F4. Missing Real Production Features:**
  - No student profile editing, resume upload, or skills management.
  - No interactive interview slot reservation with lock confirmation.
  - No offer view with formal accept/decline action.
  - No criteria builder or bulk student/drive CSV import for placement admins.

---

### 3.3 Data, Integration & Resilience Findings

- **[CONFIRMED] D1. Broken Seeding Against Live Services:**
  - `team-c/src/seed/seedData.ts` instantiates a detached `StorageManager.getInstance()` and writes directly to disk without notifying or updating an already-running server process.
  - Two divergent seed files exist (`team-c/seed/seedData.ts` and `team-c/src/seed/seedData.ts`), neither of which consumes the authoritative fixtures in `shared/fixtures/seed/`.

- **[CONFIRMED] D2. Test Polluting Real Data Directory:**
  - `team-c/src/storage/storageManager.ts:11` defaults `dataDir` to `path.join(process.cwd(), 'data')`.
  - Running `npm run test:c` invokes `StorageManager.getInstance().clearAllTables()`, mutating or wiping the active project data folder.

- **[CONFIRMED] D3. Silent Swallowing of Cross-Service Failures:**
  - `team-c/src/services/applicationService.ts:140-143`:
    ```typescript
    } catch (err: any) {
      console.warn(`[Team C -> Team A] Eligibility request call failed:`, err.message);
    }
    ```
    If Team A is unreachable, Team C creates the application anyway with no eligibility request and no retry mechanism.
  - Similar patterns exist in `masterDataService.ts:53, 69` for Team C -> Team B sync.

- **[CONFIRMED] D4. Volatile In-Memory State in Teams A & B:**
  - Team A's queues, locks, and wait-for graphs exist solely in memory.
  - Team B's skill graphs, ranking caches, and AVL trees exist solely in memory.
  - A process restart completely resets their state with no rehydration from Team C.

- **[CONFIRMED] D5. Flawed SSE Bridge:**
  - `team-d/server.ts:281-294` connects to Team C outbox stream with `.catch(() => {})`.
  - Disconnects are ignored, no exponential backoff or retry is scheduled, `Last-Event-ID` is ignored, and buffer limits are not enforced.

- **[CONFIRMED] D6. Non-Atomic Disk Writes:**
  - `team-c/src/storage/table.ts:316`: `fs.writeFileSync(filePath, JSON.stringify(recordsArray, null, 2), 'utf-8');`
  - In-place write without temporary file staging, fsync, or atomic rename poses data corruption risk during abrupt process termination.

---

### 3.4 Build, Tooling & Repo Hygiene

- **[CONFIRMED] B1. Unexecutable Production Start:**
  - `team-d/package.json` specifies `"start": "node server.js"`, but `server.js` does not exist.
- **[CONFIRMED] B2. Missing Standard Tooling & Environment Configuration:**
  - No Dockerfiles, Docker Compose, ESLint configuration, Prettier configuration, or GitHub Actions workflows exist.
  - Environment variable names diverge across teams (`PORT` vs `BFF_PORT` vs `PORT_TEAM_*`, `JWT_SECRET` vs `JWT_SIGNING_SECRET`).
- **[CONFIRMED] B3. Monorepo Disorganization & Lockfile Proliferation:**
  - 6 separate `package-lock.json` files (`root`, `e2e`, `team-a`, `team-b`, `team-c`, `team-d`).
  - Root `package.json` places runtime dependencies (`express`, `cors`, `jsonwebtoken`) in `devDependencies`.
  - `e2e/package.json` contains conflicting versions (Jest 30, ts-jest 29, TypeScript 7).
- **[CONFIRMED] B4. E2E Test Mock Bias:**
  - Playwright configuration boots only `team-d` with `VITE_USE_MOCK_API=true`. The test suite validates mock responses rather than the integrated four-service platform.
- **[CONFIRMED] B5. Stray Files & Improper Root Directories:**
  - `team-d/vite.config.d.ts` is committed to git.
  - `team-b/tsconfig.json` sets `"rootDir": "."`, creating `dist/src` and `dist/test` hierarchies.

---

### 3.5 Documentation Inaccuracies

- **[CONFIRMED] Inaccurate Audit Claims:**
  - `AUDIT-REPORT.md` claims "100% complete, 0 flagged items".
  - Section 2 cites tests `recovery.test.ts` and `reports.test.ts` which do not exist (the actual file is `walRecovery.test.ts`, and there is no standalone reports test).
  - Claims "10 Supertest contract test suites in `team-c/test/contract/`", whereas only 3 contract test files exist (`applications.test.ts`, `masterData.test.ts`, `offers.test.ts`).
  - References an uncommitted `MASTER-AGENT-BUILD-SPEC.md`.

---

## 4. Phase 0 Completion & Sign-off

With all baseline behaviors recorded and confirmed, the project is ready for Phase 1 restructuring onto branch `release/production-ready`.
