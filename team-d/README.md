# Team D — Placement Portal & Analytics Dashboard

Web Technology Frontend and Backend-For-Frontend (BFF) for the ApniLeap campus placement platform.

## Responsibilities
- **Authentication & Role-Based Navigation (D1):** HMAC-SHA256 JWT session issuance and verification for `Student`, `Faculty_TPO`, and `Placement_Admin` roles.
- **Drive Discovery & Application (D2):** Filterable placement drive catalog, eligibility pre-check modal, and idempotent application submission.
- **Live Operations Dashboard (D3):** Real-time Server-Sent Events (SSE) live update stream connected to backend outbox events.
- **Administrative Actions & Reporting (D4):** Drive criteria controls (role-guarded; 403 for Student) and placement performance analytics.

## Running the Service
- **BFF Port:** `3004` (Express backend aggregation server)
- **UI Port:** `5173` (Vite / React 18 Single Page Application)
- **Start BFF & UI:** `npm run dev`
- **Run Tests:** `npm test` (Runs BFF contract tests)
- **E2E Browser Tests:** `npx playwright test` (from root)
- **Health Check:** `GET http://localhost:3004/healthz`
