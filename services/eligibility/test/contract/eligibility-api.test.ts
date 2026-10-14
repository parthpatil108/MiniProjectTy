import request from 'supertest';
import { createApp } from '../../src/app';
import { EligibilityService } from '../../src/services/EligibilityService';
import { clearIdempotencyCache } from '../../src/middleware/idempotency';

describe('Team A - HTTP API Contracts (OpenAPI 3.x Conformance)', () => {
  let app: any;
  let service: EligibilityService;

  beforeEach(() => {
    clearIdempotencyCache();
    service = new EligibilityService();
    app = createApp(service);
  });

  describe('GET /healthz', () => {
    it('should return UP status', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.service).toBe('team-a-eligibility-engine');
    });
  });

  describe('POST /api/v1/eligibility/requests', () => {
    const validPayload = {
      request_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      application_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      student_id: 'STU-1001',
      drive_id: '550e8400-e29b-41d4-a716-446655440001',
      rule_set_version: 'v1.0.0',
      priority: 'NORMAL',
      submitted_at: '2026-08-23T12:00:00.000Z'
    };

    it('should enqueue request and return 202 with valid envelope', async () => {
      const res = await request(app)
        .post('/api/v1/eligibility/requests')
        .set('X-Correlation-ID', 'corr-1234-5678')
        .send(validPayload);

      expect(res.status).toBe(202);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.request_id).toBe(validPayload.request_id);
      expect(res.body.data.queue_position).toBeGreaterThanOrEqual(1);
      expect(res.body.data.state).toBe('QUEUED');
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.correlation_id).toBe('corr-1234-5678');
      expect(res.body.meta.api_version).toBe('v1');
    });

    it('should be idempotent by request_id and Idempotency-Key header', async () => {
      const idempotencyKey = 'idem-test-key-001';

      const res1 = await request(app)
        .post('/api/v1/eligibility/requests')
        .set('Idempotency-Key', idempotencyKey)
        .set('X-Correlation-ID', 'corr-1')
        .send(validPayload);

      expect(res1.status).toBe(202);

      // Duplicate call with same Idempotency-Key
      const res2 = await request(app)
        .post('/api/v1/eligibility/requests')
        .set('Idempotency-Key', idempotencyKey)
        .set('X-Correlation-ID', 'corr-2')
        .send(validPayload);

      expect(res2.status).toBe(202);
      expect(res2.body.data.request_id).toBe(res1.body.data.request_id);
    });

    it('should reject invalid rule_set_version with 400 VALIDATION_ERROR', async () => {
      const invalidPayload = {
        ...validPayload,
        request_id: 'req-invalid-ruleset',
        rule_set_version: 'invalid-version-xyz'
      };

      const res = await request(app)
        .post('/api/v1/eligibility/requests')
        .send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toBeDefined();
      expect(res.body.error.details[0].field).toBe('rule_set_version');
    });
  });

  describe('GET /api/v1/drives/:driveId/queue', () => {
    it('should return the ordered queue for a drive', async () => {
      const driveId = '550e8400-e29b-41d4-a716-446655440001';

      // Enqueue an item first
      await request(app)
        .post('/api/v1/eligibility/requests')
        .send({
          request_id: 'req-queue-check',
          application_id: 'app-01',
          student_id: 'STU-1001',
          drive_id: driveId,
          rule_set_version: 'v1.0.0',
          priority: 'NORMAL',
          submitted_at: new Date().toISOString()
        });

      const res = await request(app).get(`/api/v1/drives/${driveId}/queue`);
      expect(res.status).toBe(200);
      expect(res.body.data.drive_id).toBe(driveId);
      expect(res.body.data.total_queued).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.queue)).toBe(true);
    });
  });

  describe('GET /api/v1/eligibility/requests/:requestId', () => {
    it('should return request and decision details', async () => {
      const reqId = 'req-inspect-lifecycle';

      await request(app)
        .post('/api/v1/eligibility/requests')
        .send({
          request_id: reqId,
          application_id: 'app-lifecycle',
          student_id: 'STU-1002',
          drive_id: 'drive-002',
          rule_set_version: 'v1.0.0',
          priority: 'HIGH',
          submitted_at: new Date().toISOString()
        });

      const res = await request(app).get(`/api/v1/eligibility/requests/${reqId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.request).toBeDefined();
      expect(res.body.data.request.request_id).toBe(reqId);
      expect(res.body.data.decision).toBeDefined();
      expect(res.body.data.decision.eligibility_result).toBeDefined();
    });

    it('should return 404 for unknown request ID', async () => {
      const res = await request(app).get('/api/v1/eligibility/requests/non-existent-id');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /internal/v1/rules/evaluate', () => {
    it('should reject unauthenticated request with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post('/internal/v1/rules/evaluate')
        .send({ strategy: 'SEQUENTIAL_AND' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should evaluate rules directly with configured strategy when authenticated', async () => {
      const res = await request(app)
        .post('/internal/v1/rules/evaluate')
        .set('X-Service-Token', 'internal-service-auth-key-2026-secure')
        .send({
          student: {
            student_id: 'STU-2001',
            branch: 'CSE',
            cgpa: 8.8,
            backlogs: 0,
            attendance: 92.0,
            skill_tags: ['TypeScript', 'Node.js']
          },
          criteria: {
            min_cgpa: 7.5,
            max_backlogs: 0,
            allowed_branches: ['CSE', 'IT'],
            min_attendance: 75.0,
            required_skill_tags: ['TypeScript']
          },
          strategy: 'SEQUENTIAL_AND'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.eligibility_result).toBe('ELIGIBLE');
      expect(res.body.data.decision_metrics.evaluation_time_ms).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/metrics/eligibility', () => {
    it('should return telemetry and execution metrics', async () => {
      const res = await request(app).get('/api/v1/metrics/eligibility');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data.total_evaluated).toBe('number');
      expect(typeof res.body.data.p95_evaluation_ms).toBe('number');
      expect(res.body.data.wait_times_by_priority).toBeDefined();
    });
  });
});
