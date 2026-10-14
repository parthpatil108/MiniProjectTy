process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'apnileap-test-secret-2026';
process.env.INTERNAL_SERVICE_SECRET = 'internal-service-auth-key-2026-secure';

import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/app';
import { ProfileRegistryService } from '../src/services/profileRegistryService';
import { RankingService } from '../src/services/rankingService';
import { AnalyticsService } from '../src/services/analyticsService';
import { ShortlistIndex } from '../src/services/shortlistIndexService';
import { ShortlistCacheService } from '../src/services/shortlistCacheService';
import { ShortlistLookupService } from '../src/services/shortlistLookupService';
import { RankingMetricsService } from '../src/services/rankingMetricsService';
import type { Server } from 'node:http';

describe('Team B - OpenAPI Contract Tests', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    const registry = new ProfileRegistryService();
    const rankingService = new RankingService(registry);
    const analyticsService = new AnalyticsService([]);
    const shortlistIndexService = new ShortlistIndex('hash');
    const shortlistCacheService = new ShortlistCacheService();
    const shortlistLookupService = new ShortlistLookupService(
      shortlistIndexService,
      shortlistCacheService,
      () => registry.getGraphSummary().graph_version
    );
    const rankingMetricsService = new RankingMetricsService(shortlistIndexService, shortlistCacheService);

    const app = createApp(
      registry,
      rankingService,
      analyticsService,
      shortlistLookupService,
      shortlistCacheService,
      rankingMetricsService
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('GET /healthz returns UP status', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.strictEqual(body.status, 'UP');
    assert.strictEqual(body.service, 'team-b-ranking');
  });

  test('PUT /internal/v1/profiles/students/:studentId rejects unauthenticated call with 401', async () => {
    const res = await fetch(`${baseUrl}/internal/v1/profiles/students/STU-1001`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: 'STU-1001' })
    });
    assert.strictEqual(res.status, 401);
    const body = (await res.json()) as any;
    assert.strictEqual(body.error.code, 'UNAUTHORIZED');
  });

  test('PUT /internal/v1/profiles/students/:studentId syncs student and returns graph_version with service token', async () => {
    const res = await fetch(`${baseUrl}/internal/v1/profiles/students/STU-1001`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': 'corr-stu-1',
        'X-Service-Token': 'internal-service-auth-key-2026-secure'
      },
      body: JSON.stringify({
        student_id: 'STU-1001',
        name: 'Rahul Sharma',
        branch: 'CSE',
        cgpa: 8.5,
        backlogs: 0,
        attendance: 92.5,
        project_score: 85,
        skill_tags: ['TypeScript', 'Node.js']
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.ok(body.data.graph_version);
    assert.strictEqual(body.data.student_id, 'STU-1001');
    assert.strictEqual(body.meta.correlation_id, 'corr-stu-1');
  });

  test('PUT /internal/v1/profiles/drives/:driveId syncs drive and returns graph_version with service token', async () => {
    const res = await fetch(`${baseUrl}/internal/v1/profiles/drives/550e8400-e29b-41d4-a716-446655440001`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': 'corr-drv-1',
        'X-Service-Token': 'internal-service-auth-key-2026-secure'
      },
      body: JSON.stringify({
        drive_id: '550e8400-e29b-41d4-a716-446655440001',
        company: 'TechCorp Inc.',
        criteria: {
          min_cgpa: 7.5,
          max_backlogs: 0,
          allowed_branches: ['CSE', 'IT'],
          min_attendance: 75.0,
          required_skill_tags: ['TypeScript', 'Node.js']
        },
        skill_weightage: { 'TypeScript': 1.0, 'Node.js': 0.8 },
        seats: 5,
        package: '12 LPA',
        state: 'OPEN'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.ok(body.data.graph_version);
    assert.strictEqual(body.data.drive_id, '550e8400-e29b-41d4-a716-446655440001');
  });

  test('GET /api/v1/profiles returns graph summary', async () => {
    const res = await fetch(`${baseUrl}/api/v1/profiles`);
    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.ok(body.data.graph_version);
    assert.ok(body.data.total_students >= 1);
    assert.ok(body.data.total_drives >= 1);
  });

  test('POST /api/v1/rankings/compute computes ranking', async () => {
    const res = await fetch(`${baseUrl}/api/v1/rankings/compute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': 'corr-rank-1' },
      body: JSON.stringify({
        drive_id: '550e8400-e29b-41d4-a716-446655440001',
        algorithm: 'WEIGHTED_SCORE',
        topK: 5
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.ok(body.data);
    assert.ok(body.data.ranking_id || body.data.drive_id);
    assert.strictEqual(body.meta.correlation_id, 'corr-rank-1');
  });

  test('POST /api/v1/analytics/analyse runs cohort analytics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/analyse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': 'corr-ana-1' },
      body: JSON.stringify({
        department_filter: 'CSE'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.ok(body.data);
    assert.strictEqual(body.meta.correlation_id, 'corr-ana-1');
  });

  test('GET /api/v1/metrics/ranking returns performance telemetry', async () => {
    const res = await fetch(`${baseUrl}/api/v1/metrics/ranking`);
    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.ok(body.data || body.meta);
  });
});
