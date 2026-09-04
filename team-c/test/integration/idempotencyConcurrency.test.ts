import { describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app.js';
import { StorageManager } from '../../src/storage/storageManager.js';
import { TransactionManager } from '../../src/txn/transactionManager.js';
import { MasterDataService } from '../../src/services/masterDataService.js';
import { ApplicationService } from '../../src/services/applicationService.js';

describe('M4 — Idempotency & Optimistic Concurrency Integration Tests', () => {
  let studentId: string;
  let driveId: string;

  beforeEach(async () => {
    StorageManager.resetInstance();
    TransactionManager.resetInstance();
    StorageManager.getInstance().clearAllTables();

    const masterService = new MasterDataService();
    const student = await masterService.createStudent({
      name: 'Bob Ross',
      branch: 'CSE',
      cgpa: 8.8,
      backlogs: 0,
      attendance: 95.0,
      skill_tags: ['TypeScript'],
    });
    studentId = student.student_id;

    const drive = await masterService.createDrive({
      company: 'Microsoft',
      criteria: {
        min_cgpa: 7.5,
        max_backlogs: 0,
        allowed_branches: ['CSE'],
        min_attendance: 75.0,
        required_skill_tags: ['TypeScript'],
      },
      seats: 3,
      package: '18 LPA',
      state: 'OPEN',
    });
    driveId = drive.drive_id;
  });

  test('fires the same idempotency key twice concurrently and proves only one application is created', async () => {
    const idempotencyKey = 'concurrent-idem-key-777';

    const req1 = request(app)
      .post('/api/v1/applications')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        student_id: studentId,
        drive_id: driveId,
        resume_version: 'v1.0',
        consent: true,
      });

    const req2 = request(app)
      .post('/api/v1/applications')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        student_id: studentId,
        drive_id: driveId,
        resume_version: 'v1.0',
        consent: true,
      });

    // Execute both requests concurrently
    const [res1, res2] = await Promise.all([req1, req2]);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    // Both responses return the EXACT SAME application_id!
    expect(res1.body.data.application_id).toBe(res2.body.data.application_id);

    // Verify only 1 application record exists in storage
    const allApps = StorageManager.getInstance().query('applications', {}).records;
    expect(allApps.length).toBe(1);
    expect(allApps[0].application_id).toBe(res1.body.data.application_id);
  });

  test('fires two conflicting optimistic updates and proves one gets VERSION_MISMATCH', async () => {
    const appService = new ApplicationService();
    const createdApp = await appService.createApplication(
      {
        student_id: studentId,
        drive_id: driveId,
        resume_version: 'v1.0',
        consent: true,
      },
      'idem-version-conflict-test'
    );

    const appId = createdApp.application_id;

    // Both transactions attempt to update/withdraw using expectedVersion = 1 concurrently
    const update1 = appService.withdrawApplication(appId, undefined, 1);
    const update2 = appService.withdrawApplication(appId, undefined, 1);

    const results = await Promise.allSettled([update1, update2]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one update must succeed and one must fail with VERSION_MISMATCH (or STATE_CONFLICT)
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const reason: any = (rejected[0] as PromiseRejectedResult).reason;
    expect(['VERSION_MISMATCH', 'STATE_CONFLICT', 'LOCK_TIMEOUT']).toContain(reason.code);
  });
});
