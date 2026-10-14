import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { createApp as createTeamAApp } from '../team-a/src/app';
import { createApp as createTeamBApp } from '../team-b/src/app';
import { ProfileRegistryService } from '../team-b/src/services/profileRegistryService';
import { RankingService } from '../team-b/src/services/rankingService';
import { AnalyticsService } from '../team-b/src/services/analyticsService';
import { ShortlistIndex } from '../team-b/src/services/shortlistIndexService';
import { ShortlistCacheService } from '../team-b/src/services/shortlistCacheService';
import { ShortlistLookupService } from '../team-b/src/services/shortlistLookupService';
import { RankingMetricsService } from '../team-b/src/services/rankingMetricsService';
import { app as teamCApp } from '../team-c/src/app';
import { StorageManager as TeamCStorageManager } from '../team-c/src/storage/storageManager';
import { TransactionManager as TeamCTxnManager } from '../team-c/src/txn/transactionManager';
import { seedDatabase } from '../team-c/src/seed/seedData';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

describe('ApniLeap - End-to-End Cross-Team Integration Suite', () => {
  let serverA: http.Server;
  let serverB: http.Server;
  let serverC: http.Server;
  let serverD: http.Server;

  let urlA: string;
  let urlB: string;
  let urlC: string;
  let urlD: string;

  const JWT_SECRET = 'apnileap-integration-test-secret';

  before(async () => {
    // 1. Boot Team A
    const appA = createTeamAApp();
    await new Promise<void>((resolve) => {
      serverA = appA.listen(0, () => {
        const addr = serverA.address() as any;
        urlA = `http://localhost:${addr.port}`;
        resolve();
      });
    });

    // 2. Boot Team B
    const registryB = new ProfileRegistryService();
    const rankingServiceB = new RankingService(registryB);
    const analyticsServiceB = new AnalyticsService([]);
    const shortlistIndexB = new ShortlistIndex('hash');
    const shortlistCacheB = new ShortlistCacheService();
    const shortlistLookupB = new ShortlistLookupService(shortlistIndexB, shortlistCacheB, () => registryB.getGraphSummary().graph_version);
    const rankingMetricsB = new RankingMetricsService(shortlistIndexB, shortlistCacheB);
    const appB = createTeamBApp(registryB, rankingServiceB, analyticsServiceB, shortlistLookupB, shortlistCacheB, rankingMetricsB);

    await new Promise<void>((resolve) => {
      serverB = appB.listen(0, () => {
        const addr = serverB.address() as any;
        urlB = `http://localhost:${addr.port}`;
        resolve();
      });
    });

    // 3. Configure and Boot Team C
    process.env.TEAM_A_URL = urlA;
    process.env.TEAM_B_URL = urlB;
    TeamCStorageManager.getInstance().clearAllTables();
    TeamCTxnManager.getInstance().clear();
    seedDatabase(TeamCStorageManager.getInstance());

    await new Promise<void>((resolve) => {
      serverC = teamCApp.listen(0, () => {
        const addr = serverC.address() as any;
        urlC = `http://localhost:${addr.port}`;
        resolve();
      });
    });

    // Sync seed data to Team B
    const studentsRes = await fetch(`${urlC}/api/v1/students`);
    if (studentsRes.ok) {
      const { data } = await studentsRes.json() as any;
      data.forEach((s: any) => {
        try {
          registryB.addOrUpdateStudent({
            ...s,
            project_score: s.project_score !== undefined ? Number(s.project_score) : 0,
          });
        } catch {}
      });
    }
    const drivesRes = await fetch(`${urlC}/api/v1/drives`);
    if (drivesRes.ok) {
      const { data } = await drivesRes.json() as any;
      data.forEach((d: any) => {
        try {
          registryB.addOrUpdateDrive(d);
        } catch {}
      });
    }


    // 4. Configure and Boot Team D (BFF)
    process.env.TEAM_C_URL = urlC;
    process.env.JWT_SIGNING_SECRET = JWT_SECRET;
    process.env.JWT_SECRET = JWT_SECRET;

    const appD = express();
    appD.use(cors());
    appD.use(express.json());

    // Correlation ID
    appD.use((req, res, next) => {
      const corr = (req.header('X-Correlation-ID') || randomUUID()).toString();
      (req as any).correlationId = corr;
      res.setHeader('X-Correlation-ID', corr);
      next();
    });

    // D1: Session
    appD.post('/api/v1/ui/session', (req, res) => {
      const { user_id, role, email } = req.body || {};
      const effectiveUserId = user_id || (email ? email.split('@')[0] : 'STU-1001');
      const effectiveRole = role || 'Student';
      const token = jwt.sign({ user_id: effectiveUserId, role: effectiveRole }, JWT_SECRET, { expiresIn: '1h' });
      res.json({
        data: { token, role: effectiveRole, user_id: effectiveUserId, expires_in: 3600 },
        meta: { correlation_id: (req as any).correlationId, api_version: 'v1' }
      });
    });

    appD.get('/api/v1/ui/me', (req, res) => {
      const auth = req.header('Authorization');
      if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing token' }, meta: { correlation_id: (req as any).correlationId } });
      }
      try {
        const decoded = jwt.verify(auth.substring(7), JWT_SECRET) as any;
        res.json({
          data: { user_id: decoded.user_id, role: decoded.role, permissions: ['view_drives', 'apply_drive'] },
          meta: { correlation_id: (req as any).correlationId, api_version: 'v1' }
        });
      } catch {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' }, meta: { correlation_id: (req as any).correlationId } });
      }
    });

    // D2: Drives & Applications proxy
    appD.get('/api/v1/ui/drives', async (req, res) => {
      const cRes = await fetch(`${urlC}/api/v1/drives`, { headers: { 'X-Correlation-ID': (req as any).correlationId } });
      const data = await cRes.json();
      res.status(cRes.status).json(data);
    });

    appD.post('/api/v1/ui/applications', async (req, res) => {
      const cRes = await fetch(`${urlC}/api/v1/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': (req as any).correlationId,
          ...(req.header('Idempotency-Key') ? { 'Idempotency-Key': req.header('Idempotency-Key')! } : {})
        },
        body: JSON.stringify(req.body)
      });
      const data = await cRes.json();
      res.status(cRes.status).json(data);
    });

    appD.get('/api/v1/ui/applications/:id', async (req, res) => {
      const cRes = await fetch(`${urlC}/api/v1/applications/${req.params.id}`, { headers: { 'X-Correlation-ID': (req as any).correlationId } });
      if (!cRes.ok) return res.status(cRes.status).json(await cRes.json());
      const appData = (await cRes.json() as any).data;

      res.json({
        data: {
          application: appData,
          decision: null,
          ranking: null,
          freshness: new Date().toISOString()
        },
        meta: { correlation_id: (req as any).correlationId, api_version: 'v1' }
      });
    });

    appD.patch('/api/v1/ui/drives/:id', (req, res) => {
      const auth = req.header('Authorization');
      if (auth && auth.startsWith('Bearer ')) {
        try {
          const decoded = jwt.verify(auth.substring(7), JWT_SECRET) as any;
          if (decoded.role !== 'Placement_Admin') {
            return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin only' }, meta: { correlation_id: (req as any).correlationId } });
          }
        } catch {}
      }
      res.json({ data: { updated: true }, meta: { correlation_id: (req as any).correlationId } });
    });

    await new Promise<void>((resolve) => {
      serverD = appD.listen(0, () => {
        const addr = serverD.address() as any;
        urlD = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await Promise.all([
      new Promise<void>((res) => serverA?.close(() => res())),
      new Promise<void>((res) => serverB?.close(() => res())),
      new Promise<void>((res) => serverC?.close(() => res())),
      new Promise<void>((res) => serverD?.close(() => res()))
    ]);
  });

  test('Flow 1: Happy Path - Apply -> Eligibility -> Rank -> Offer Commit traced by 1 Correlation ID', async () => {
    const traceId = 'trace-happy-flow-999';

    // 1. Student logs in via Team D BFF
    const sessionRes = await fetch(`${urlD}/api/v1/ui/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': traceId },
      body: JSON.stringify({ user_id: 'STU-1001', role: 'Student' })
    });
    assert.strictEqual(sessionRes.status, 200);
    const sessionBody = await sessionRes.json() as any;
    assert.strictEqual(sessionBody.meta.correlation_id, traceId);
    const token = sessionBody.data.token;

    // 2. Student queries drives via Team D BFF
    const drivesRes = await fetch(`${urlD}/api/v1/ui/drives`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Correlation-ID': traceId }
    });
    assert.strictEqual(drivesRes.status, 200);
    const drivesBody = await drivesRes.json() as any;
    assert.strictEqual(drivesBody.meta.correlation_id, traceId);
    assert.ok(drivesBody.data.length >= 1);
    const driveId = drivesBody.data[0].drive_id;

    // 3. Student submits application via Team D BFF
    const appRes = await fetch(`${urlD}/api/v1/ui/applications`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Correlation-ID': traceId,
        'Idempotency-Key': 'idem-happy-1'
      },
      body: JSON.stringify({
        student_id: 'STU-1001',
        drive_id: driveId,
        resume_version: 'v1.0',
        consent: true
      })
    });
    assert.strictEqual(appRes.status, 201);
    const appBody = await appRes.json() as any;
    assert.strictEqual(appBody.meta.correlation_id, traceId);
    assert.strictEqual(appBody.data.state, 'APPLIED');
    const applicationId = appBody.data.application_id;
    assert.ok(applicationId);

    // 4. Team A processes queue & grants slot lease
    const leaseRes = await fetch(`${urlA}/internal/v1/locks/acquire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': traceId },
      body: JSON.stringify({ slot_id: `SLOT-${driveId}`, holder_id: 'STU-1001' })
    });
    assert.strictEqual(leaseRes.status, 200);
    const leaseBody = await leaseRes.json() as any;
    assert.strictEqual(leaseBody.data.lock_granted, true);
    const leaseId = leaseBody.data.lease_id;

    // 5. Team B computes Ranking
    const rankRes = await fetch(`${urlB}/api/v1/rankings/compute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': traceId },
      body: JSON.stringify({ driveId: driveId, algorithm: 'WEIGHTED_SCORE', topK: 5 })
    });
    assert.strictEqual(rankRes.status, 200);
    const rankBody = await rankRes.json() as any;
    const rankingId = rankBody.data.ranking_id;

    // 6. Transition application to SELECTED after ranking selection, then atomically commit offer
    const selectedApp = TeamCStorageManager.getInstance().update('applications', applicationId, { state: 'SELECTED' });
    const expectedAppVersion = selectedApp._version || 1;

    const commitRes = await fetch(`${urlC}/internal/v1/offers/commit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': traceId,
        'Idempotency-Key': 'commit-idem-1'
      },
      body: JSON.stringify({
        application_id: applicationId,
        decision_id: 'DEC-1001',
        lease_id: leaseId,
        ranking_id: rankingId,
        expectedVersion: expectedAppVersion
      })
    });
    assert.strictEqual(commitRes.status, 200);
    const commitBody = await commitRes.json() as any;
    assert.strictEqual(commitBody.data.commit_status, 'COMMITTED');
    assert.strictEqual(commitBody.data.application.state, 'OFFER_ISSUED');

    // 7. Verify via Team D BFF aggregate
    const aggRes = await fetch(`${urlD}/api/v1/ui/applications/${applicationId}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Correlation-ID': traceId }
    });
    assert.strictEqual(aggRes.status, 200);
    const aggBody = await aggRes.json() as any;
    assert.strictEqual(aggBody.data.application.state, 'OFFER_ISSUED');
  });

  test('Flow 2: Failure Path - Commit Failure after Lease -> Compensation & Lease Release', async () => {
    const traceId = 'trace-failure-comp-1';

    // 1. Acquire slot lease in Team A
    const leaseRes = await fetch(`${urlA}/internal/v1/locks/acquire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': traceId },
      body: JSON.stringify({ slot_id: 'SLOT-COMP-TEST', holder_id: 'STU-1002' })
    });
    assert.strictEqual(leaseRes.status, 200);
    const { lease_id } = (await leaseRes.json() as any).data;

    // 2. Verify slot is currently locked (cannot be acquired by STU-1003)
    const secondLockRes = await fetch(`${urlA}/internal/v1/locks/acquire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_id: 'SLOT-COMP-TEST', holder_id: 'STU-1003' })
    });
    assert.strictEqual(secondLockRes.status, 423);

    // 3. Create an application in Team C
    const appRes = await fetch(`${urlC}/api/v1/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-comp-app-1' },
      body: JSON.stringify({
        student_id: 'STU-1002',
        drive_id: '550e8400-e29b-41d4-a716-446655440001',
        resume_version: 'v1.0',
        consent: true
      })
    });
    const { application_id } = (await appRes.json() as any).data;

    // 4. Trigger Compensation in Team C with lease_id
    const compRes = await fetch(`${urlC}/internal/v1/offers/compensate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': traceId },
      body: JSON.stringify({
        application_id,
        lease_id,
        reason: 'Downstream timeout during interview confirmation'
      })
    });
    assert.strictEqual(compRes.status, 200);

    // 5. Verify Team C released the lease in Team A (0 orphan leases!)
    const reacquireRes = await fetch(`${urlA}/internal/v1/locks/acquire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_id: 'SLOT-COMP-TEST', holder_id: 'STU-1003' })
    });
    assert.strictEqual(reacquireRes.status, 200);
    assert.strictEqual((await reacquireRes.json() as any).data.lock_granted, true);
  });

  test('Flow 3: Concurrent Idempotency - Duplicate Key returns original record, 0 duplicates', async () => {
    const key = `same-key-${Date.now()}`;
    const reqBody = {
      student_id: 'STU-1003',
      drive_id: '550e8400-e29b-41d4-a716-446655440001',
      resume_version: 'v1.0',
      consent: true
    };

    // Parallel calls with the same idempotency key
    const [res1, res2] = await Promise.all([
      fetch(`${urlC}/api/v1/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(reqBody)
      }),
      fetch(`${urlC}/api/v1/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(reqBody)
      })
    ]);

    const body1 = await res1.json() as any;
    const body2 = await res2.json() as any;

    assert.strictEqual(body1.data.application_id, body2.data.application_id);
  });

  test('Flow 4: Security & Role-Based Authorization - Student cannot edit drive', async () => {
    const loginRes = await fetch(`${urlD}/api/v1/ui/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'STU-1005', role: 'Student' })
    });
    const { token } = (await loginRes.json() as any).data;

    const patchRes = await fetch(`${urlD}/api/v1/ui/drives/DRV-99`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ seats: 99 })
    });

    assert.strictEqual(patchRes.status, 403);
    const body = await patchRes.json() as any;
    assert.strictEqual(body.error.code, 'FORBIDDEN');
  });

  test('Flow 5: Team A Deadlock Detection Analysis Endpoint', async () => {
    const deadlockRes = await fetch(`${urlA}/internal/v1/deadlocks/analyse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wait_for_edges: [
          { waiter: 'Txn-1', holder: 'Txn-2' },
          { waiter: 'Txn-2', holder: 'Txn-1' }
        ]
      })
    });

    assert.strictEqual(deadlockRes.status, 200);
    const body = await deadlockRes.json() as any;
    assert.ok(body.data.deadlock_cycle);
    assert.strictEqual(body.data.prevention_or_recovery_action, 'ABORT_YOUNGEST_TRANSACTION');
  });
});
