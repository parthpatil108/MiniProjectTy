import { describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app.js';
import { StorageManager } from '../../src/storage/storageManager.js';
import { TransactionManager } from '../../src/txn/transactionManager.js';

describe('M5 — Recovery & Reports Contract Tests', () => {
  const serviceSecret = process.env.INTERNAL_SERVICE_SECRET || 'internal-service-auth-key-2026-secure';

  beforeEach(() => {
    StorageManager.resetInstance();
    TransactionManager.resetInstance();
    StorageManager.getInstance().clearAllTables();
  });

  test('POST /internal/v1/recovery/verify verifies WAL integrity and returns standard envelope', async () => {
    const res = await request(app)
      .post('/internal/v1/recovery/verify')
      .set('X-Service-Token', serviceSecret)
      .set('X-Correlation-ID', 'recovery-corr-1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data.status).toBe('OK');
    expect(typeof res.body.data.lastCheckpointLsn).toBe('number');
    expect(typeof res.body.data.walBacklog).toBe('number');
    expect(res.body.meta.correlation_id).toBe('recovery-corr-1');
  });

  test('POST /internal/v1/recovery/verify rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/internal/v1/recovery/verify')
      .set('X-Correlation-ID', 'recovery-corr-2');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('GET /api/v1/reports/placement-performance returns aggregated performance stats', async () => {
    // Insert dummy application data
    const storage = StorageManager.getInstance();
    storage.insert('applications', {
      application_id: 'APP-1',
      student_id: 'STU-1',
      drive_id: 'DRV-1',
      state: 'OFFER_ISSUED'
    });
    storage.insert('applications', {
      application_id: 'APP-2',
      student_id: 'STU-2',
      drive_id: 'DRV-1',
      state: 'SHORTLISTED'
    });

    const res = await request(app)
      .get('/api/v1/reports/placement-performance')
      .set('X-Correlation-ID', 'reports-corr-1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('total_applications');
    expect(res.body.data).toHaveProperty('total_offers');
    expect(res.body.meta.correlation_id).toBe('reports-corr-1');
  });
});
