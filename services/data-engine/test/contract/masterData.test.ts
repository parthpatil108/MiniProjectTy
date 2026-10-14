import { describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app.js';
import { StorageManager } from '../../src/storage/storageManager.js';
import { TransactionManager } from '../../src/txn/transactionManager.js';
import { MasterDataService } from '../../src/services/masterDataService.js';

describe('M3 — Master Data CRUD Contract Tests (Supertest)', () => {
  beforeEach(() => {
    StorageManager.resetInstance();
    TransactionManager.resetInstance();
    StorageManager.getInstance().clearAllTables();
  });

  test('POST /api/v1/students creates a student profile and returns standard envelope', async () => {
    const correlationId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

    const res = await request(app)
      .post('/api/v1/students')
      .set('X-Correlation-ID', correlationId)
      .send({
        name: 'Rahul Sharma',
        branch: 'CSE',
        cgpa: 8.45,
        backlogs: 0,
        attendance: 92.5,
        skill_tags: ['Node.js', 'TypeScript'],
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');

    expect(res.body.data).toHaveProperty('student_id');
    expect(res.body.data.version).toBe(1);
    expect(res.body.data).toHaveProperty('created_at');

    expect(res.body.meta.correlation_id).toBe(correlationId);
    expect(res.body.meta.api_version).toBe('v1');
  });

  test('POST /api/v1/students fails validation when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/students')
      .send({
        name: 'Incomplete Profile',
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body).toHaveProperty('meta');
  });

  test('GET /api/v1/drives lists placement drives', async () => {
    const service = new MasterDataService();
    await service.createDrive({
      company: 'TechCorp',
      criteria: {
        min_cgpa: 7.5,
        max_backlogs: 0,
        allowed_branches: ['CSE', 'IT'],
        min_attendance: 75.0,
        required_skill_tags: ['Node.js'],
      },
      seats: 5,
      package: '12 LPA',
      state: 'OPEN',
    });

    const res = await request(app).get('/api/v1/drives').set('X-Correlation-ID', '11111111-2222-3333-4444-555555555555');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].company).toBe('TechCorp');
  });

  test('GET /api/v1/drives/{driveId}/criteria returns drive criteria or 404', async () => {
    const service = new MasterDataService();
    const drive = await service.createDrive({
      company: 'Innovate',
      criteria: {
        min_cgpa: 8.0,
        max_backlogs: 0,
        allowed_branches: ['CSE'],
        min_attendance: 80.0,
        required_skill_tags: ['Algorithms'],
      },
      seats: 2,
      package: '15 LPA',
    });

    // Valid drive ID
    const resSuccess = await request(app).get(`/api/v1/drives/${drive.drive_id}/criteria`);
    expect(resSuccess.status).toBe(200);
    expect(resSuccess.body.data.company).toBe('Innovate');
    expect(resSuccess.body.data.seats).toBe(2);

    // Invalid drive ID
    const resNotFound = await request(app).get('/api/v1/drives/non-existent-id/criteria');
    expect(resNotFound.status).toBe(404);
    expect(resNotFound.body.error.code).toBe('NOT_FOUND');
  });

  test('PATCH /internal/v1/drives/{driveId} rejects unauthenticated request with 401', async () => {
    const service = new MasterDataService();
    const drive = await service.createDrive({
      company: 'SecCorp',
      criteria: { min_cgpa: 6.0, max_backlogs: 0, allowed_branches: ['CSE'], min_attendance: 75.0, required_skill_tags: [] },
      seats: 5,
      package: '8 LPA',
    });

    const res = await request(app)
      .patch(`/internal/v1/drives/${drive.drive_id}`)
      .send({ expectedVersion: 1, seats: 4 });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('PATCH /internal/v1/drives/{driveId} updates drive with optimistic version check', async () => {
    const service = new MasterDataService();
    const drive = await service.createDrive({
      company: 'DataFlow',
      criteria: {
        min_cgpa: 7.0,
        max_backlogs: 1,
        allowed_branches: ['CSE', 'ECE'],
        min_attendance: 70.0,
        required_skill_tags: ['SQL'],
      },
      seats: 10,
      package: '10 LPA',
    });

    // Update with correct expectedVersion = 1
    const resUpdate = await request(app)
      .patch(`/internal/v1/drives/${drive.drive_id}`)
      .set('X-Service-Token', 'internal-service-auth-key-2026-secure')
      .send({
        expectedVersion: 1,
        seats: 8,
        state: 'OPEN',
      });

    expect(resUpdate.status).toBe(200);
    expect(resUpdate.body.data.seats).toBe(8);
    expect(resUpdate.body.data.version).toBe(2);

    // Stale expectedVersion = 1 returns VERSION_MISMATCH (409)
    const resMismatch = await request(app)
      .patch(`/internal/v1/drives/${drive.drive_id}`)
      .set('X-Service-Token', 'internal-service-auth-key-2026-secure')
      .send({
        expectedVersion: 1,
        seats: 5,
      });

    expect(resMismatch.status).toBe(409);
    expect(resMismatch.body.error.code).toBe('VERSION_MISMATCH');
  });
});
