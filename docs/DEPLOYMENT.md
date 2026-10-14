# ApniLeap Production Deployment Guide

## 1. System Overview & Multi-Container Topology

ApniLeap is engineered as a distributed campus placement system comprised of five containerized services running on a private Docker bridge network (`apnileap-net`), with persistent storage backed by a dedicated Docker volume.

```
                  ┌──────────────────────────────┐
                  │      Client Browser          │
                  └──────────────┬───────────────┘
                                 │ HTTP (80/443)
                  ┌──────────────▼───────────────┐
                  │   apps/web (Nginx Proxy)     │
                  └──────────────┬───────────────┘
                                 │ Internal Proxy (:3004)
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
                                            │ Named Volume    │
                                            └─────────────────┘
```

---

## 2. Environment Variables & Secret Configuration

Create a `.env` file from `.env.example` before starting production containers:

| Variable | Description | Default / Example |
|---|---|---|
| `NODE_ENV` | Runtime environment mode | `production` |
| `JWT_SECRET` | 32+ character HMAC secret for user sessions | `generate_with_openssl_rand_hex_32` |
| `INTERNAL_SERVICE_SECRET` | Inter-service shared authorization token | `generate_with_openssl_rand_hex_32` |
| `DATA_DIR` | Absolute path for B+Tree tables & WAL journal | `/data` |
| `SEED_ON_START` | Auto-seed master data if database tables empty | `true` |
| `CORS_ORIGINS` | Permitted browser origins | `http://localhost,https://apnileap.edu` |
| `LOG_LEVEL` | Pino logging threshold | `info` |

> [!CAUTION]
> In `NODE_ENV=production`, ApniLeap strictly enforces that `JWT_SECRET` and `INTERNAL_SERVICE_SECRET` are not left as placeholder defaults. Starting any service without secure secrets will cause immediate fail-fast termination.

---

## 3. Docker Compose Deployment

### 3.1 Local Development / Staging Deployment
Builds all multi-stage container images, mounts the persistent data volume, and exposes ports for inspection:

```bash
docker compose -f infra/docker/docker-compose.yml up --build -d
```

### 3.2 Hardened Production Deployment
In production, microservices communicate exclusively across the private internal network `apnileap-prod-net`. Only Nginx (ports 80 and 443) is exposed externally:

```bash
docker compose -f infra/docker/docker-compose.prod.yml up --build -d
```

### 3.3 Verifying Deployment Health
All services implement standard container healthchecks (`/healthz` probes). Verify container health:

```bash
docker compose -f infra/docker/docker-compose.yml ps
```

Expected status:
```
NAME                    STATUS                     PORTS
apnileap-data-engine    Up (healthy)               0.0.0.0:3003->3003/tcp
apnileap-eligibility    Up (healthy)               0.0.0.0:3001->3001/tcp
apnileap-ranking        Up (healthy)               0.0.0.0:3002->3002/tcp
apnileap-bff            Up (healthy)               0.0.0.0:3004->3004/tcp
apnileap-web            Up (healthy)               0.0.0.0:80->80/tcp
```

---

## 4. Storage Persistence & Durability Architecture

The custom DBMS (`services/data-engine`) requires no external PostgreSQL or MongoDB databases:
- **Atomic File Durability:** Tables (`students`, `drives`, `applications`, `users`, `audit_log`, `outbox`) are saved using a two-phase atomic write pattern:
  1. Record batch written to temporary file `.table.tmp`.
  2. Operating system sync (`fs.fsyncSync(fd)`) forces disk flush.
  3. Atomic file rename (`fs.renameSync`) replaces the active table file.
- **Write-Ahead Logging (WAL):** Every transactional write is logged to `wal.log` before in-memory B+Tree and Hash index mutations.
- **Persistence Volume:** The Docker named volume `apnileap-data` is mounted to `/data` in the `data-engine` container, ensuring zero data loss across container restarts or host reboots.

### 4.1 Backup Procedure
```bash
# Snapshot the data directory to a compressed archive
docker run --rm \
  --volumes-from apnileap-data-engine \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/apnileap-backup-$(date +%Y%m%d%H%M%S).tar.gz /data
```

### 4.2 Recovery & Checkpoint Verification
To trigger a manual WAL checkpoint and verify ledger integrity:
```bash
curl -X POST http://localhost:3004/internal/v1/recovery/verify \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```
