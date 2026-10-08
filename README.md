# Placement Platform (System of Record)

This repository contains the multi-team Placement Eligibility and Analytics Platform. The system is built by four independent teams integrating over versioned HTTP/JSON APIs, with Team C acting as the authoritative system of record backed by a custom Node.js JSON-file database engine.

## Installation & Running Locally

To install dependencies, build TypeScript sources, seed initial data, and start Team C locally:

```bash
cd team-c
npm install
npm run build
npm run seed
npm start
```

## Running Tests

To run the complete test suite for Team C:

```bash
cd team-c
npx jest
```

## Full Documentation

For full project architecture, cross-team API specs, and database design, see the documentation in [docs/](docs/):
- [00 — Overview and Decisions](docs/00-overview-and-decisions.md)
- [01 — Shared Contracts and Data Model](docs/01-shared-contracts-and-data-model.md)
- [02 — Team C Architecture](docs/02-team-c-architecture.md)
- [03 — Team C Database Engine Design](docs/03-team-c-database-engine-design.md)
- [04 — Team C Implementation Plan](docs/04-team-c-implementation-plan.md)
- [06 — AI Agent Rules](docs/06-ai-agent-rules.md)
- [09 — Stack](docs/09-stack.md)
