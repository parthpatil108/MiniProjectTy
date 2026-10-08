# Placement Platform

This repository contains the campus placement management system built by four teams working together through a shared contract and API model.

## Project Summary

- Team A: eligibility and rule evaluation services
- Team B: ranking, shortlist generation, and analytics
- Team C: system of record, transactional data layer, and persistence engine
- Team D: React-based placement portal and user-facing dashboard

The platform models the complete hiring lifecycle: drive management, student eligibility checks, applications, shortlisting, analytics, and placement reporting.

## Local Setup

### Team C (system of record)

```bash
cd team-c
npm install
npm run build
npm run seed
npm start
```

### Team A

```bash
cd team-a
npm install
npm run build
npm run dev
```

### Team B

```bash
cd team-b
npm install
npm run test
```

### Team D

```bash
cd team-d
npm install
npm run dev
```

After starting the services, open the portal at:

```text
http://localhost:5173/
```

## Verified Status

The current integrated setup has been validated locally:
- Team A health endpoint: http://localhost:3001/health
- Team C health endpoint: http://localhost:3003/healthz
- Team D frontend: http://localhost:5173/
- Team B test suite: 24 passing tests

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
