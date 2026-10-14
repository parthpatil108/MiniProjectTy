process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'apnileap-test-secret-2026-key';
process.env.INTERNAL_SERVICE_SECRET = 'internal-service-auth-key-2026-secure';

import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { app, config } from '../src/server.js';
import { signAccessToken, signRefreshToken } from '@apnileap/common';

describe('Team D - BFF Real Security & Auth Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  const originalFetch = global.fetch;

  before(async () => {
    // Intercept downstream calls to Team C for login verification
    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlStr = input.toString();

      if (urlStr.includes('/internal/v1/users/authenticate')) {
        const body = JSON.parse((init?.body as string) || '{}');
        if (body.email === 'student@apnileap.edu' && body.password === 'validpass123') {
          return new Response(
            JSON.stringify({
              data: {
                user_id: 'STU-1001',
                email: 'student@apnileap.edu',
                name: 'Rahul Sharma',
                role: 'Student'
              },
              meta: { correlation_id: 'mock-auth-corr' }
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (body.email === 'admin@apnileap.edu' && body.password === 'adminpass123') {
          return new Response(
            JSON.stringify({
              data: {
                user_id: 'ADM-01',
                email: 'admin@apnileap.edu',
                name: 'Admin User',
                role: 'Placement_Admin'
              },
              meta: { correlation_id: 'mock-auth-corr' }
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({
            error: { code: 'UNAUTHORIZED', message: 'Invalid credentials or account locked' },
            meta: { correlation_id: 'mock-auth-corr' }
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Default fallback for any other upstream call
      return originalFetch(input, init);
    };

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    global.fetch = originalFetch;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // -----------------------------------------------------------
  // Health & Readiness
  // -----------------------------------------------------------
  test('GET /healthz returns 200 with service name', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.status, 'UP');
    assert.strictEqual(body.service, 'team-d-bff');
  });

  test('GET /readyz returns readiness probe status envelope', async () => {
    const res = await fetch(`${baseUrl}/readyz`);
    assert.ok([200, 503].includes(res.status), 'Readiness status must be 200 or 503');
    const body = (await res.json()) as any;
    assert.ok(body.data && typeof body.data.ready === 'boolean');
    assert.ok(body.data.dependencies);
  });

  // -----------------------------------------------------------
  // Real DB Authentication & Role Escalation Prevention (S1)
  // -----------------------------------------------------------
  test('POST /api/v1/ui/session authenticates valid credentials and derives role strictly from DB', async () => {
    // Attempt role escalation by passing role: 'Placement_Admin' in request body
    const res = await fetch(`${baseUrl}/api/v1/ui/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student@apnileap.edu',
        password: 'validpass123',
        role: 'Placement_Admin' // MALICIOUS ATTEMPT
      })
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.ok(body.data.token, 'Must return JWT token');
    // Ensure role escalation failed: user receives role from DB ('Student'), NOT 'Placement_Admin'
    assert.strictEqual(body.data.role, 'Student');
    assert.strictEqual(body.data.user_id, 'STU-1001');

    // Decode token to verify signed claim
    const decoded = jwt.decode(body.data.token) as any;
    assert.strictEqual(decoded.role, 'Student');
    assert.strictEqual(decoded.user_id, 'STU-1001');
  });

  test('POST /api/v1/ui/session rejects invalid credentials with 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ui/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student@apnileap.edu',
        password: 'wrongpassword'
      })
    });

    assert.strictEqual(res.status, 401);
    const body = (await res.json()) as any;
    assert.strictEqual(body.error.code, 'UNAUTHORIZED');
  });

  // -----------------------------------------------------------
  // Token Validation & Fails-Closed Protection (S3)
  // -----------------------------------------------------------
  test('GET /api/v1/ui/me rejects missing Authorization header with 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ui/me`);
    assert.strictEqual(res.status, 401);
    const body = (await res.json()) as any;
    assert.strictEqual(body.error.code, 'UNAUTHORIZED');
  });

  test('GET /api/v1/ui/me rejects tampered / forged token with 401', async () => {
    const forgedToken = jwt.sign(
      { user_id: 'ADM-01', role: 'Placement_Admin' },
      'forged-attacker-secret-key-12345'
    );

    const res = await fetch(`${baseUrl}/api/v1/ui/me`, {
      headers: { Authorization: `Bearer ${forgedToken}` }
    });

    assert.strictEqual(res.status, 401);
    const body = (await res.json()) as any;
    assert.strictEqual(body.error.code, 'UNAUTHORIZED');
  });

  test('GET /api/v1/ui/me rejects expired token with 401', async () => {
    const expiredToken = jwt.sign(
      { user_id: 'STU-1001', role: 'Student' },
      config.JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const res = await fetch(`${baseUrl}/api/v1/ui/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });

    assert.strictEqual(res.status, 401);
    const body = (await res.json()) as any;
    assert.strictEqual(body.error.code, 'UNAUTHORIZED');
  });

  test('GET /api/v1/ui/me returns user profile and permissions for valid token', async () => {
    const validToken = signAccessToken(
      { user_id: 'TPO-01', role: 'Faculty_TPO', email: 'tpo@apnileap.edu' },
      config.JWT_SECRET
    );

    const res = await fetch(`${baseUrl}/api/v1/ui/me`, {
      headers: { Authorization: `Bearer ${validToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.data.user_id, 'TPO-01');
    assert.strictEqual(body.data.role, 'Faculty_TPO');
    assert.ok(body.data.permissions.includes('view_analytics'));
  });

  // -----------------------------------------------------------
  // Admin Guard Fails Closed (S2)
  // -----------------------------------------------------------
  test('PATCH /api/v1/ui/drives/:id rejects missing token with 401 (fails closed)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ui/drives/DRV-1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seats: 10 })
    });

    assert.strictEqual(res.status, 401);
    const body = (await res.json()) as any;
    assert.strictEqual(body.error.code, 'UNAUTHORIZED');
  });

  test('PATCH /api/v1/ui/drives/:id rejects Student token with 403 FORBIDDEN', async () => {
    const studentToken = signAccessToken(
      { user_id: 'STU-1001', role: 'Student', email: 'student@apnileap.edu' },
      config.JWT_SECRET
    );

    const res = await fetch(`${baseUrl}/api/v1/ui/drives/DRV-1`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ seats: 10 })
    });

    assert.strictEqual(res.status, 403);
    const body = (await res.json()) as any;
    assert.strictEqual(body.error.code, 'FORBIDDEN');
  });

  test('PATCH /api/v1/ui/drives/:id rejects Faculty_TPO token with 403 FORBIDDEN', async () => {
    const facultyToken = signAccessToken(
      { user_id: 'TPO-01', role: 'Faculty_TPO', email: 'faculty@apnileap.edu' },
      config.JWT_SECRET
    );

    const res = await fetch(`${baseUrl}/api/v1/ui/drives/DRV-1`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${facultyToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ seats: 10 })
    });

    assert.strictEqual(res.status, 403);
    const body = (await res.json()) as any;
    assert.strictEqual(body.error.code, 'FORBIDDEN');
  });

  // -----------------------------------------------------------
  // Student Data Ownership Checks (S3 / Spec)
  // -----------------------------------------------------------
  test('POST /api/v1/ui/applications blocks Student from applying under another student ID (403)', async () => {
    const studentToken = signAccessToken(
      { user_id: 'STU-1001', role: 'Student', email: 'student@apnileap.edu' },
      config.JWT_SECRET
    );

    const res = await fetch(`${baseUrl}/api/v1/ui/applications`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        student_id: 'STU-9999', // VIOLATION: token is for STU-1001
        drive_id: '550e8400-e29b-41d4-a716-446655440001',
        resume_version: 'v1.0',
        consent: true
      })
    });

    assert.strictEqual(res.status, 403);
    const body = (await res.json()) as any;
    assert.strictEqual(body.error.code, 'FORBIDDEN');
  });

  // -----------------------------------------------------------
  // Session Termination & SSE Stream
  // -----------------------------------------------------------
  test('DELETE /api/v1/ui/session terminates session and clears cookies', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ui/session`, { method: 'DELETE' });
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.data.logged_out, true);
  });

  test('GET /api/v1/ui/stream establishes SSE event-stream', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ui/stream`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('text/event-stream'));
  });
});
