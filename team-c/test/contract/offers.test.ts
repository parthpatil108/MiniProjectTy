import { describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app.js';
import { StorageManager } from '../../src/storage/storageManager.js';
import { TransactionManager } from '../../src/txn/transactionManager.js';
import { seedDatabase } from '../../seed/seedData.js';

describe('C3/C4/C5 — Offers, Audit, Performance Reports & Recovery Verification Contract Tests', () => {
  const storageManager = StorageManager.getInstance();
  const txnManager = TransactionManager.getInstance();

  let studentId: string;
  let driveId: string;
  let applicationId: string;
  let appVersion: number;

  beforeEach(async () => {
    storageManager.clearAllTables();
    txnManager.clear();
    seedDatabase(storageManager);

    studentId = 'STU-1001';
    driveId = '550e8400-e29b-41d4-a716-446655440001';

    // Create an initial application
    const createRes = await request(app)
      .post('/api/v1/applications')
      .set('X-Correlation-ID', '11111111-2222-3333-4444-555555555555')
      .set('Idempotency-Key', 'idem-test-offer-1')
      .send({
        student_id: studentId,
        drive_id: driveId,
        resume_version: 'v1.0',
        consent: true,
      });

    expect(createRes.status).toBe(201);
    applicationId = createRes.body.data.application_id;

    // Transition application state to SELECTED so it can legally transition to OFFER_ISSUED
    const updatedApp = storageManager.update('applications', applicationId, { state: 'SELECTED' });
    appVersion = updatedApp._version || createRes.body.data.version;
  });

  test('POST /internal/v1/offers/commit atomically commits an offer transaction', async () => {
    const res = await request(app)
      .post('/internal/v1/offers/commit')
      .set('X-Correlation-ID', '22222222-3333-4444-5555-666666666666')
      .send({
        application_id: applicationId,
        decision_id: 'd1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a',
        lease_id: 'lease-1001',
        expectedVersion: appVersion,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.commit_status).toBe('COMMITTED');
    expect(res.body.data.application.state).toBe('OFFER_ISSUED');

    // Verify drive seats decremented from 5 to 4
    const driveRes = await request(app).get(`/api/v1/drives/${driveId}/criteria`);
    expect(driveRes.body.data.seats).toBe(4);
  });

  test('POST /internal/v1/offers/compensate triggers offer compensation', async () => {
    const res = await request(app)
      .post('/internal/v1/offers/compensate')
      .set('X-Correlation-ID', '33333333-4444-5555-6666-777777777777')
      .send({
        application_id: applicationId,
        reason: 'Lease expired before acceptance',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.compensated).toBe(true);
    expect(res.body.data.application_id).toBe(applicationId);
  });

  test('GET /api/v1/audit retrieves recorded audit entries', async () => {
    // Perform commit to record audit entry
    await request(app)
      .post('/internal/v1/offers/commit')
      .set('X-Correlation-ID', '44444444-5555-6666-7777-888888888888')
      .send({
        application_id: applicationId,
        decision_id: 'd1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a',
        lease_id: 'lease-1002',
        expectedVersion: appVersion,
      });

    const res = await request(app)
      .get('/api/v1/audit')
      .query({ correlation_id: '44444444-5555-6666-7777-888888888888' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].action).toBe('OFFER_COMMIT');
  });

  test('GET /api/v1/reports/placement-performance returns aggregate metrics', async () => {
    const res = await request(app).get('/api/v1/reports/placement-performance');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('total_applications');
    expect(res.body.data).toHaveProperty('total_offers');
    expect(res.body.data).toHaveProperty('department_breakdown');
  });

  test('POST /internal/v1/recovery/verify reports WAL status', async () => {
    const res = await request(app).post('/internal/v1/recovery/verify');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('OK');
    expect(res.body.data).toHaveProperty('lastCheckpointLsn');
    expect(res.body.data).toHaveProperty('walBacklog');
  });

  test('GET /internal/v1/outbox/stream returns event-stream', async () => {
    const res = await request(app).get('/internal/v1/outbox/stream');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
  });
});
