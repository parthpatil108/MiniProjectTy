# Placement Platform

This repository contains the campus placement management system built by four teams working together through a shared contract and API model.

## Project Summary

- Team A: eligibility and rule evaluation services
- Team B: ranking, shortlist generation, and analytics
- Team C: system of record, transactional data layer, and persistence engine
- Team D: React-based placement portal and user-facing dashboard

The platform models the complete hiring lifecycle: drive management, student eligibility checks, applications, shortlisting, analytics, and placement reporting.

## Local Setup

We have added a unified root script to install and run all services concurrently.

```bash
# Install dependencies for root and all 4 teams
npm run install:all

# Build all 4 teams
npm run build:all

# Start all 4 teams concurrently
npm run dev:all
```

After starting the services, open the portal at:

```text
http://localhost:5173/
```

### Environment Variables & Ports

Each service has a `.env.example` file. Copy it to `.env` in the respective directory.

**Team A (Eligibility & Rules)**
- Port: `3001`
- Env Vars: `PORT`, `NODE_ENV`, `LOG_LEVEL`, `JWT_SIGNING_SECRET`

**Team B (Ranking & Analytics)**
- Port: `3002`
- Env Vars: `PORT`, `NODE_ENV`

**Team C (System of Record)**
- Port: `3003`
- Env Vars: `PORT`, `NODE_ENV`, `DATA_DIR`

**Team D (BFF & Portal)**
- Port: `3004` (BFF) / `5173` (Vite UI)
- Env Vars: `PORT`, `NODE_ENV`, `LOG_LEVEL`, `JWT_SIGNING_SECRET`, `VITE_USE_MOCK_API`, `VITE_API_BASE_URL`

## Verified Status

The current integrated setup has been validated locally:
- Team A health endpoint: http://localhost:3001/healthz
- Team B health endpoint: http://localhost:3002/healthz
- Team C health endpoint: http://localhost:3003/healthz
- Team D BFF health endpoint: http://localhost:3004/healthz
- Team D frontend: http://localhost:5173/

## Documentation

Detailed architecture, contracts, and project decisions are recorded in [docs/](docs/):
- [00 — Overview and Decisions](docs/00-overview-and-decisions.md)
- [01 — Shared Contracts and Data Model](docs/01-shared-contracts-and-data-model.md)
- [02 — Team C Architecture](docs/02-team-c-architecture.md)
- [03 — Team C Database Engine Design](docs/03-team-c-database-engine-design.md)
- [04 — Team C Implementation Plan](docs/04-team-c-implementation-plan.md)
- [05 — Teams A/B/D Specifications](docs/05-teams-a-b-d-specifications.md)
- [06 — AI Agent Rules](docs/06-ai-agent-rules.md)
- [07 — Testing Integration and Workflow](docs/07-testing-integration-and-workflow.md)
- [08 — Requirements Traceability](docs/08-requirements-traceability.md)
- [09 — Stack](docs/09-stack.md)
