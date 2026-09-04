import { describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app.js';
import { StorageManager } from '../../src/storage/storageManager.js';
import { TransactionManager } from '../../src/txn/transactionManager.js';
import { MasterDataService } from '../../src/services/masterDataService.js';

describe('M4 — Application Contract Tests (Supertest)', () => {
  let studentId: string;
  let driveId: string;

  beforeEach(async () => {
    StorageManager.resetInstance();
    TransactionManager.resetInstance();
    StorageManager.getInstance().clearAllTables();

    const masterService = new MasterDataService();
    const student = await masterService.createStudent({
      name: 'Alice Smith',
      branch: 'CSE',
      cgpa: 9.1,
      backlogs: 0,
      attendance: 90.0,
      skill_tags: ['Node.js'],
    });
    studentId = student.student_id;

    const drive = await masterService.createDrive({
      company: 'Google',
      criteria: {
        min_cgpa: 8.0,
        max_backlogs: 0,
        allowed_branches: ['CSE'],
        min_attendance: 75.0,
        required_skill_tags: ['Node.js'],
      },
      seats: 5,
      package: '20 LPA',
      state: 'OPEN',
    });
    driveId = drive.drive_id;
  });

  test('POST /api/v1/applications creates an application in APPLIED state', async () => {
    const correlationId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
    const idempotencyKey = 'idem-key-1001';

    const res = await request(app)
      .post('/api/v1/applications')
      .set('X-Correlation-ID', correlationId)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        student_id: studentId,
        drive_id: driveId,
        resume_version: 'v1.0',
        consent: true,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');

    expect(res.body.data).toHaveProperty('application_id');
    expect(res.body.data.state).toBe('APPLIED');
    expect(res.body.data.version).toBe(1);

    expect(res.body.meta.correlation_id).toBe(correlationId);
  });

  test('POST /api/v1/applications fails when consent is false', async () => {
    const res = await request(app)
      .post('/api/v1/applications')
      .send({
        student_id: studentId,
        drive_id: driveId,
        resume_version: 'v1.0',
        consent: false,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('GET /api/v1/applications/{applicationId} fetches application details', async () => {
    const createRes = await request(app)
      .post('/api/v1/applications')
      .set('Idempotency-Key', 'idem-get-test')
      .send({
        student_id: studentId,
        drive_id: driveId,
        resume_version: 'v1.0',
        consent: true,
      });

    const appId = createRes.body.data.application_id;

    const getRes = await request(app).get(`/api/v1/applications/${appId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.application_id).toBe(appId);
    expect(getRes.body.data.student_id).toBe(studentId);
    expect(getRes.body.data.state).toBe('APPLIED');
  });

  test('POST /api/v1/applications/{applicationId}/withdraw transitions state to WITHDRAWN', async () => {
    const createRes = await request(app)
      .post('/api/v1/applications')
      .set('Idempotency-Key', 'idem-withdraw-test')
      .send({
        student_id: studentId,
        drive_id: driveId,
        resume_version: 'v1.0',
        consent: true,
      });

    const appId = createRes.body.data.application_id;

    const withdrawRes = await request(app)
      .post(`/api/v1/applications/${appId}/withdraw`)
      .send({ expectedVersion: 1 });

    expect(withdrawRes.status).toBe(200);
    expect(withdrawRes.body.data.state).toBe('WITHDRAWN');
    expect(withdrawRes.body.data.version).toBe(2);

    // Withdrawing a terminal WITHDRAWN state fails with STATE_CONFLICT (409)
    const reWithdrawRes = await request(app)
      .post(`/api/v1/applications/${appId}/withdraw`)
      .send({ expectedVersion: 2 });

    expect(reWithdrawRes.status).toBe(409);
    expect(reWithdrawRes.body.error.code).toBe('STATE_CONFLICT');
  });
});
