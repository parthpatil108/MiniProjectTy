import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.BFF_PORT || 3004;

const TEAM_A_URL = process.env.TEAM_A_URL || 'http://localhost:3001';
const TEAM_B_URL = process.env.TEAM_B_URL || 'http://localhost:3002';
const TEAM_C_URL = process.env.TEAM_C_URL || 'http://localhost:3003';
const JWT_SECRET = process.env.JWT_SIGNING_SECRET || process.env.JWT_SECRET || 'apnileap-shared-secret-key-2026';

app.use(cors());

// Correlation ID & Logger Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req.header('X-Correlation-ID') || randomUUID()).toString();
  (req as any).correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  console.log(`[Team D BFF] [${req.method}] ${req.url} - correlation_id: ${correlationId}`);
  next();
});

// JSON body parser for BFF routes
app.use(express.json());

// Health check
app.get('/healthz', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', service: 'team-d-bff' });
});

// ==========================================
// D1: Authentication and Session Management
// ==========================================

app.post('/api/v1/ui/session', (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  const { user_id, role, email, password } = req.body || {};
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
      correlation_id: correlationId,
      api_version: 'v1'
    }
  });
});

app.delete('/api/v1/ui/session', (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  return res.status(200).json({
    data: { logged_out: true },
    meta: {
      correlation_id: correlationId,
      api_version: 'v1'
    }
  });
});

app.get('/api/v1/ui/me', (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization token' },
      meta: { correlation_id: correlationId }
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
    const permissions = permissionsMap[decoded.role] || ['view_drives'];

    return res.status(200).json({
      data: {
        user_id: decoded.user_id,
        role: decoded.role,
        permissions
      },
      meta: {
        correlation_id: correlationId,
        api_version: 'v1'
      }
    });
  } catch {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
      meta: { correlation_id: correlationId }
    });
  }
});

// ==========================================
// D2: Drive Discovery & Applications
// ==========================================

app.get('/api/v1/ui/drives', async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const resp = await fetch(`${TEAM_C_URL}/api/v1/drives`, {
      headers: {
        'X-Correlation-ID': correlationId,
        ...(req.header('Authorization') ? { Authorization: req.header('Authorization')! } : {})
      }
    });
    const body = await resp.json() as any;
    return res.status(resp.status).json(body);
  } catch (err: any) {
    return res.status(503).json({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Failed to fetch drives from Team C' },
      meta: { correlation_id: correlationId }
    });
  }
});

app.post('/api/v1/ui/applications', async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  const idempotencyKey = req.header('Idempotency-Key') || randomUUID();
  try {
    const resp = await fetch(`${TEAM_C_URL}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId,
        'Idempotency-Key': idempotencyKey,
        ...(req.header('Authorization') ? { Authorization: req.header('Authorization')! } : {})
      },
      body: JSON.stringify(req.body)
    });
    const body = await resp.json() as any;
    return res.status(resp.status).json(body);
  } catch (err: any) {
    return res.status(503).json({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Failed to submit application to Team C' },
      meta: { correlation_id: correlationId }
    });
  }
});

app.get('/api/v1/ui/applications/:applicationId', async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const appRes = await fetch(`${TEAM_C_URL}/api/v1/applications/${req.params.applicationId}`, {
      headers: {
        'X-Correlation-ID': correlationId,
        ...(req.header('Authorization') ? { Authorization: req.header('Authorization')! } : {})
      }
    });
    if (!appRes.ok) {
      const errBody = await appRes.json();
      return res.status(appRes.status).json(errBody);
    }
    const appBody = await appRes.json() as any;
    const appData = appBody.data;

    let decisionData = null;
    if (appData.decision_id) {
      try {
        const decRes = await fetch(`${TEAM_A_URL}/api/v1/eligibility/decisions/${appData.decision_id}`, {
          headers: { 'X-Correlation-ID': correlationId }
        });
        if (decRes.ok) {
          const decBody = await decRes.json() as any;
          decisionData = decBody.data;
        }
      } catch {}
    }

    let rankingData = null;
    if (appData.ranking_id || appData.drive_id) {
      try {
        const rankRes = await fetch(`${TEAM_B_URL}/api/v1/rankings/${appData.ranking_id || appData.drive_id}`, {
          headers: { 'X-Correlation-ID': correlationId }
        });
        if (rankRes.ok) {
          const rankBody = await rankRes.json() as any;
          rankingData = rankBody.data;
        }
      } catch {}
    }

    const aggregate = {
      application: appData,
      decision: decisionData,
      ranking: rankingData,
      freshness: new Date().toISOString(),
      alerts: [],
      permissions: ['view_my_applications']
    };

    return res.status(200).json({
      data: aggregate,
      meta: {
        correlation_id: correlationId,
        api_version: 'v1'
      }
    });
  } catch (err: any) {
    return res.status(503).json({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Failed to aggregate application details' },
      meta: { correlation_id: correlationId }
    });
  }
});

// ==========================================
// D3: Live Dashboard & SSE Stream
// ==========================================

app.get('/api/v1/ui/dashboard', async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const drivesRes = await fetch(`${TEAM_C_URL}/api/v1/drives`, {
      headers: { 'X-Correlation-ID': correlationId }
    });
    const drivesData = drivesRes.ok ? (await drivesRes.json() as any).data : [];

    let recentApps: any[] = [];
    try {
      const reportsRes = await fetch(`${TEAM_C_URL}/api/v1/reports/placement-performance`, {
        headers: { 'X-Correlation-ID': correlationId }
      });
      if (reportsRes.ok) {
        const reportJson = await reportsRes.json() as any;
        recentApps = reportJson.data?.recent_applications || [];
      }
    } catch {}

    return res.status(200).json({
      data: {
        active_drives: drivesData.filter((d: any) => d.state === 'OPEN'),
        recent_applications: recentApps,
        freshness: new Date().toISOString()
      },
      meta: {
        correlation_id: correlationId,
        api_version: 'v1'
      }
    });
  } catch (err: any) {
    return res.status(503).json({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Failed to aggregate dashboard data' },
      meta: { correlation_id: correlationId }
    });
  }
});

app.get('/api/v1/ui/stream', (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Correlation-ID': correlationId
  });

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE stream connected', timestamp: new Date().toISOString() })}\n\n`);

  const controller = new AbortController();
  fetch(`${TEAM_C_URL}/internal/v1/outbox/stream`, {
    signal: controller.signal,
    headers: { 'X-Correlation-ID': correlationId }
  }).then(async (outboxRes) => {
    if (!outboxRes.ok || !outboxRes.body) return;
    const reader = outboxRes.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value));
    }
  }).catch(() => {});

  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'HEARTBEAT', timestamp: new Date().toISOString() })}\n\n`);
  }, 10000);

  req.on('close', () => {
    clearInterval(interval);
    controller.abort();
    res.end();
  });
});

app.get('/api/v1/ui/rankings', async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  const driveId = (req.query.drive_id as string) || 'default';
  try {
    const resp = await fetch(`${TEAM_B_URL}/api/v1/rankings/${driveId}`, {
      headers: { 'X-Correlation-ID': correlationId }
    });
    const body = await resp.json() as any;
    return res.status(resp.status).json(body);
  } catch (err: any) {
    return res.status(503).json({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Failed to fetch rankings from Team B' },
      meta: { correlation_id: correlationId }
    });
  }
});

// ==========================================
// D4: Admin, Preview & Analytics
// ==========================================

app.post('/api/v1/ui/rankings/preview', async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const resp = await fetch(`${TEAM_B_URL}/api/v1/rankings/compute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId
      },
      body: JSON.stringify(req.body)
    });
    const body = await resp.json() as any;
    return res.status(resp.status).json(body);
  } catch (err: any) {
    return res.status(503).json({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Failed to compute ranking preview from Team B' },
      meta: { correlation_id: correlationId }
    });
  }
});

app.patch('/api/v1/ui/drives/:driveId', async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
      if (decoded.role !== 'Placement_Admin') {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Only Placement_Admin can update drive criteria or status' },
          meta: { correlation_id: correlationId }
        });
      }
    } catch {}
  }

  try {
    const resp = await fetch(`${TEAM_C_URL}/internal/v1/drives/${req.params.driveId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId,
        ...(authHeader ? { Authorization: authHeader } : {})
      },
      body: JSON.stringify(req.body)
    });
    const body = await resp.json() as any;
    return res.status(resp.status).json(body);
  } catch (err: any) {
    return res.status(503).json({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Failed to update drive in Team C' },
      meta: { correlation_id: correlationId }
    });
  }
});

app.get('/api/v1/ui/reports/placement-performance', async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;
  try {
    const [cRes, aRes, bRes] = await Promise.allSettled([
      fetch(`${TEAM_C_URL}/api/v1/reports/placement-performance`, { headers: { 'X-Correlation-ID': correlationId } }),
      fetch(`${TEAM_A_URL}/api/v1/metrics/eligibility`, { headers: { 'X-Correlation-ID': correlationId } }),
      fetch(`${TEAM_B_URL}/api/v1/metrics/ranking`, { headers: { 'X-Correlation-ID': correlationId } })
    ]);

    const placement_report = cRes.status === 'fulfilled' && cRes.value.ok ? (await cRes.value.json() as any).data : {};
    const eligibility_metrics = aRes.status === 'fulfilled' && aRes.value.ok ? (await aRes.value.json() as any).data : {};
    const ranking_metrics = bRes.status === 'fulfilled' && bRes.value.ok ? (await bRes.value.json() as any).data : {};

    return res.status(200).json({
      data: {
        placement_report,
        eligibility_metrics,
        ranking_metrics
      },
      meta: {
        correlation_id: correlationId,
        api_version: 'v1'
      }
    });
  } catch (err: any) {
    return res.status(503).json({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Failed to aggregate reports' },
      meta: { correlation_id: correlationId }
    });
  }
});

// Direct proxies for team test harnesses and backwards compatibility
app.use('/api/v1/eligibility', createProxyMiddleware({ target: TEAM_A_URL, changeOrigin: true }));
app.use('/api/v1/queues', createProxyMiddleware({ target: TEAM_A_URL, changeOrigin: true }));
app.use('/api/v1/rankings', createProxyMiddleware({ target: TEAM_B_URL, changeOrigin: true }));
app.use('/api/v1/profiles', createProxyMiddleware({ target: TEAM_B_URL, changeOrigin: true }));
app.use('/api/v1/analytics', createProxyMiddleware({ target: TEAM_B_URL, changeOrigin: true }));
app.use('/api/v1/students', createProxyMiddleware({ target: TEAM_C_URL, changeOrigin: true }));
app.use('/api/v1/drives', createProxyMiddleware({ target: TEAM_C_URL, changeOrigin: true }));
app.use('/api/v1/applications', createProxyMiddleware({ target: TEAM_C_URL, changeOrigin: true }));
app.use('/api/v1/offers', createProxyMiddleware({ target: TEAM_C_URL, changeOrigin: true }));
app.use('/internal/v1/outbox/stream', createProxyMiddleware({ target: TEAM_C_URL, changeOrigin: true }));

app.listen(PORT, () => {
  console.log(`Team D BFF Server running on port ${PORT}`);
});
