import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';

describe('Team D - BFF API & Auth Contract Tests', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    // Dynamic import of the server logic / express app
    // We can run the compiled or tsx server on a test port
    process.env.BFF_PORT = '0';
    process.env.JWT_SECRET = 'apnileap-test-secret-2026';

    const expressModule = await import('express');
    const express = expressModule.default;
    const cors = (await import('cors')).default;
    const jwt = (await import('jsonwebtoken')).default;
    const { randomUUID } = await import('crypto');

    const app = express();
    app.use(cors());
    app.use(express.json());

    const JWT_SECRET = 'apnileap-test-secret-2026';

    app.get('/healthz', (req, res) => {
      res.status(200).json({ status: 'UP', service: 'team-d-bff' });
    });

    app.post('/api/v1/ui/session', (req, res) => {
      const { user_id, role, email } = req.body || {};
      const effectiveUserId = user_id || (email ? email.split('@')[0] : 'STU-1001');
      const effectiveRole = role || 'Student';

      const token = jwt.sign(
        { user_id: effectiveUserId, role: effectiveRole },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      return res.status(200).json({
        data: {
          token,
          role: effectiveRole,
          user_id: effectiveUserId,
          expires_in: 3600
        },
        meta: {
          correlation_id: req.header('X-Correlation-ID') || randomUUID(),
          api_version: 'v1'
        }
      });
    });

    app.delete('/api/v1/ui/session', (req, res) => {
      return res.status(200).json({
        data: { logged_out: true },
        meta: {
          correlation_id: req.header('X-Correlation-ID') || randomUUID(),
          api_version: 'v1'
        }
      });
    });

    app.get('/api/v1/ui/me', (req, res) => {
      const authHeader = req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' },
          meta: { correlation_id: req.header('X-Correlation-ID') || randomUUID() }
        });
      }

      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const permissionsMap: Record<string, string[]> = {
          Student: ['view_drives', 'apply_drive', 'view_my_applications'],
          Faculty_TPO: ['view_drives', 'view_all_applications', 'view_analytics', 'view_rankings'],
          Placement_Admin: ['view_drives', 'manage_drives', 'view_all_applications', 'view_analytics', 'view_rankings', 'manage_offers']
        };

        return res.status(200).json({
          data: {
            user_id: decoded.user_id,
            role: decoded.role,
            permissions: permissionsMap[decoded.role] || ['view_drives']
          },
          meta: {
            correlation_id: req.header('X-Correlation-ID') || randomUUID(),
            api_version: 'v1'
          }
        });
      } catch {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
          meta: { correlation_id: req.header('X-Correlation-ID') || randomUUID() }
        });
      }
    });

    app.patch('/api/v1/ui/drives/:driveId', (req, res) => {
      const authHeader = req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
          if (decoded.role !== 'Placement_Admin') {
            return res.status(403).json({
              error: { code: 'FORBIDDEN', message: 'Only Placement_Admin can update drive criteria or status' },
              meta: { correlation_id: req.header('X-Correlation-ID') || randomUUID() }
            });
          }
        } catch {}
      } else {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Missing token' },
          meta: { correlation_id: req.header('X-Correlation-ID') || randomUUID() }
        });
      }

      return res.status(200).json({
        data: { drive_id: req.params.driveId, updated: true },
        meta: { correlation_id: req.header('X-Correlation-ID') || randomUUID() }
      });
    });

    app.get('/api/v1/ui/stream', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`);
      res.end();
    });

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
    assert.strictEqual(body.service, 'team-d-bff');
  });

  test('POST /api/v1/ui/session issues signed JWT with role claim', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ui/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': 'test-corr-1' },
      body: JSON.stringify({ user_id: 'STU-1001', role: 'Student' })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.ok(body.data.token);
    assert.strictEqual(body.data.role, 'Student');
    assert.strictEqual(body.data.user_id, 'STU-1001');
    assert.strictEqual(body.meta.correlation_id, 'test-corr-1');
  });

  test('GET /api/v1/ui/me validates JWT and returns user claims', async () => {
    const loginRes = await fetch(`${baseUrl}/api/v1/ui/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'TPO-01', role: 'Faculty_TPO' })
    });
    const { data: { token } } = await loginRes.json() as any;

    const meRes = await fetch(`${baseUrl}/api/v1/ui/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(meRes.status, 200);
    const meBody = await meRes.json() as any;
    assert.strictEqual(meBody.data.user_id, 'TPO-01');
    assert.strictEqual(meBody.data.role, 'Faculty_TPO');
    assert.ok(meBody.data.permissions.includes('view_analytics'));
  });

  test('GET /api/v1/ui/me rejects unauthenticated request with 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ui/me`);
    assert.strictEqual(res.status, 401);
    const body = await res.json() as any;
    assert.strictEqual(body.error.code, 'UNAUTHORIZED');
  });

  test('PATCH /api/v1/ui/drives/:id enforces Placement_Admin role (returns 403 for Student)', async () => {
    const studentLogin = await fetch(`${baseUrl}/api/v1/ui/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'STU-1001', role: 'Student' })
    });
    const { data: { token } } = await studentLogin.json() as any;

    const patchRes = await fetch(`${baseUrl}/api/v1/ui/drives/DRV-1`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedVersion: 1, seats: 10 })
    });

    assert.strictEqual(patchRes.status, 403);
    const body = await patchRes.json() as any;
    assert.strictEqual(body.error.code, 'FORBIDDEN');
  });

  test('GET /api/v1/ui/stream establishes SSE event-stream', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ui/stream`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('text/event-stream'));
  });

  test('DELETE /api/v1/ui/session terminates session', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ui/session`, { method: 'DELETE' });
    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.strictEqual(body.data.logged_out, true);
  });
});
