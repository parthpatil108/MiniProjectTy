# Team C — Placement Data & Transaction Manager

Team C provides the authoritative system of record and transaction manager for the placement platform. It is built in Node.js and TypeScript on a custom JSON-file database engine featuring a hand-written B+Tree index, custom hash index, write-ahead logging (WAL), strict two-phase locking (2PL) transaction manager, and atomic state machine enforcement.

## Installation & Running Locally

To install dependencies, build TypeScript source, seed initial data, and run the server locally:

```bash
npm install
npm run build
npm run seed
npm start
```

The server listens on port `3000` by default.

## Running Tests

To run all unit, contract, and integration tests:

```bash
npx jest
```

## Documentation

Full architectural and database engine specifications for Team C are located in the repository [docs/](../docs/):
- [02 — Team C Architecture](../docs/02-team-c-architecture.md)
- [03 — Team C Custom Database Engine Design](../docs/03-team-c-database-engine-design.md)
- [04 — Team C Implementation Plan](../docs/04-team-c-implementation-plan.md)
- [Team C OpenAPI Contract](../shared/contracts/openapi/team-c.openapi.yaml)
