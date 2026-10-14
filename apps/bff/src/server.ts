import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import {
  loadConfig,
  createLogger,
  requestLoggerMiddleware,
  correlationIdMiddleware,
  getCorrelationId,
  createSuccessEnvelope,
  createErrorEnvelope,
  requireAuth,
  requireRole,
  signAccessToken,
  signRefreshToken,
  verifyToken,
  signServiceToken,
  UserTokenPayload
} from '@apnileap/common';

export const config = loadConfig();
const logger = createLogger('bff-service', config.LOG_LEVEL);

export const app = express();

// -------------------------------------------------------------
// Security & Infrastructure Middlewares
// -------------------------------------------------------------

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.CORS_ORIGINS.includes(origin) || config.NODE_ENV === 'test') {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
  })
);
app.use(cookieParser() as any);
app.use(express.json({ limit: '1mb' }));
app.use(correlationIdMiddleware);
app.use(requestLoggerMiddleware(logger));

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.NODE_ENV === 'test' ? 10000 : 300,
  message: (req: Request, res: Response) => {
    const correlationId = getCorrelationId(req);
    return res.status(429).json(
      createErrorEnvelope('RATE_LIMITED', 'Too many requests. Please try again later.', correlationId)
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.NODE_ENV === 'test' ? 10000 : 20,
  message: (req: Request, res: Response) => {
    const correlationId = getCorrelationId(req);
    return res.status(429).json(
      createErrorEnvelope('RATE_LIMITED', 'Too many login attempts. Please try again later.', correlationId)
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', generalLimiter as any);

// -------------------------------------------------------------
// Health & Readiness Probes
// -------------------------------------------------------------

app.get('/healthz', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', service: 'team-d-bff' });
});

app.get('/readyz', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req);
  const checks: Record<string, string> = {};

  try {
    const aRes = await fetch(`${config.ELIGIBILITY_URL}/healthz`, { signal: AbortSignal.timeout(1500) });
    checks.eligibility = aRes.ok ? 'UP' : 'DOWN';
  } catch {
    checks.eligibility = 'DOWN';
  }

  try {
    const bRes = await fetch(`${config.RANKING_URL}/healthz`, { signal: AbortSignal.timeout(1500) });
    checks.ranking = bRes.ok ? 'UP' : 'DOWN';
  } catch {
    checks.ranking = 'DOWN';
  }

  try {
    const cRes = await fetch(`${config.DATA_ENGINE_URL}/healthz`, { signal: AbortSignal.timeout(1500) });
    checks.data_engine = cRes.ok ? 'UP' : 'DOWN';
  } catch {
    checks.data_engine = 'DOWN';
  }

  const isReady = checks.data_engine === 'UP';
  return res.status(isReady ? 200 : 503).json(
    createSuccessEnvelope({ ready: isReady, dependencies: checks }, correlationId)
  );
});

// Helper for internal service tokens
function getServiceAuthHeaders(correlationId: string) {
  const serviceToken = signServiceToken('team-d-bff', config.INTERNAL_SERVICE_SECRET);
  return {
    'Content-Type': 'application/json',
    'X-Correlation-ID': correlationId,
    'X-Service-Token': serviceToken,
    Authorization: `Bearer ${serviceToken}`
  };
}

// -------------------------------------------------------------
// D1: Real Authentication & Session Management
// -------------------------------------------------------------

app.post('/api/v1/ui/session', authLimiter as any, async (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req);
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json(
      createErrorEnvelope('VALIDATION_ERROR', 'Email and password are required', correlationId, [
        { field: 'email', reason: 'Email is required' },
        { field: 'password', reason: 'Password is required' }
      ])
    );
  }

  try {
    // Authenticate with Team C (System of Record)
    const authResp = await fetch(`${config.DATA_ENGINE_URL}/internal/v1/users/authenticate`, {
      method: 'POST',
      headers: getServiceAuthHeaders(correlationId),
      body: JSON.stringify({ email, password })
    });

    if (!authResp.ok) {
      const errBody = await authResp.json().catch(() => ({}));
      logger.warn({ correlation_id: correlationId, email }, 'Authentication failed at Team C');
      return res.status(401).json(
        createErrorEnvelope('UNAUTHORIZED', errBody?.error?.message || 'Invalid credentials', correlationId)
      );
    }

    const { data: user } = (await authResp.json()) as any;

    const tokenPayload: UserTokenPayload = {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    const accessToken = signAccessToken(tokenPayload, config.JWT_SECRET, '15m');
    const refreshToken = signRefreshToken(
      { user_id: user.user_id, role: user.role },
      config.JWT_SECRET,
      '7d'
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(200).json(
      createSuccessEnvelope(
        {
          token: accessToken,
          role: user.role,
          user_id: user.user_id,
          name: user.name,
          email: user.email,
          expires_in: 900
        },
        correlationId
      )
    );
  } catch (err: any) {
    logger.error({ correlation_id: correlationId, err: err.message }, 'Failed to communicate with auth service');
    return res.status(502).json(
      createErrorEnvelope('UPSTREAM_UNAVAILABLE', 'Authentication service unavailable', correlationId)
    );
  }
});

app.post('/api/v1/ui/refresh', (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req);
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json(
      createErrorEnvelope('UNAUTHORIZED', 'Refresh token required', correlationId)
    );
  }

  try {
    const decoded = verifyToken<{ user_id: string; role: any }>(refreshToken, config.JWT_SECRET);
    const newAccessToken = signAccessToken(
      { user_id: decoded.user_id, role: decoded.role, email: '' },
      config.JWT_SECRET,
      '15m'
    );

    return res.status(200).json(
      createSuccessEnvelope(
        {
          token: newAccessToken,
          user_id: decoded.user_id,
          role: decoded.role,
          expires_in: 900
        },
        correlationId
      )
    );
  } catch {
    return res.status(401).json(
      createErrorEnvelope('UNAUTHORIZED', 'Invalid or expired refresh token', correlationId)
    );
  }
});

app.delete('/api/v1/ui/session', (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req);
  res.clearCookie('refreshToken', {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.NODE_ENV === 'production'
  });
  return res.status(200).json(
    createSuccessEnvelope({ logged_out: true }, correlationId)
  );
});

app.get('/api/v1/ui/me', requireAuth(config.JWT_SECRET), (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req);
  const user = (req as any).user as UserTokenPayload;

  const permissionsMap: Record<string, string[]> = {
    Student: ['view_drives', 'apply_drive', 'view_my_applications'],
    Faculty_TPO: ['view_drives', 'view_all_applications', 'view_analytics', 'view_rankings'],
    Placement_Admin: [
      'view_drives',
      'manage_drives',
      'view_all_applications',
      'view_analytics',
      'view_rankings',
      'manage_offers'
    ]
  };

  const permissions = permissionsMap[user.role] || ['view_drives'];

  return res.status(200).json(
    createSuccessEnvelope(
      {
        user_id: user.user_id,
        role: user.role,
        name: user.name || user.user_id,
        email: user.email,
        permissions
      },
      correlationId
    )
  );
});

// -------------------------------------------------------------
// D2: Drives & Applications with Ownership Controls
// -------------------------------------------------------------

app.get('/api/v1/ui/drives', requireAuth(config.JWT_SECRET), async (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req);
  try {
    const resp = await fetch(`${config.DATA_ENGINE_URL}/api/v1/drives`, {
      headers: {
        'X-Correlation-ID': correlationId,
        Authorization: req.header('Authorization')!
      }
    });
    const body = (await resp.json()) as any;
    return res.status(resp.status).json(body);
  } catch (err: any) {
    logger.error({ correlation_id: correlationId, err: err.message }, 'Failed to fetch drives from Team C');
    return res.status(502).json(
      createErrorEnvelope('UPSTREAM_UNAVAILABLE', 'Failed to fetch drives from data engine', correlationId)
    );
  }
});

app.post('/api/v1/ui/applications', requireAuth(config.JWT_SECRET), async (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req);
  const idempotencyKey = req.header('Idempotency-Key') || randomUUID();
  const user = (req as any).user as UserTokenPayload;

  // Student ownership check
  if (user.role === 'Student' && req.body.student_id && req.body.student_id !== user.user_id) {
    logger.warn({ correlation_id: correlationId, user: user.user_id, attemptedStudent: req.body.student_id }, 'Ownership violation');
    return res.status(403).json(
      createErrorEnvelope('FORBIDDEN', 'Students may only create applications for themselves', correlationId)
    );
  }

  // Auto-fill student_id from verified user token if omitted
  if (user.role === 'Student' && !req.body.student_id) {
    req.body.student_id = user.user_id;
  }

  try {
    const resp = await fetch(`${config.DATA_ENGINE_URL}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId,
        'Idempotency-Key': idempotencyKey,
        Authorization: req.header('Authorization')!
      },
      body: JSON.stringify(req.body)
    });
    const body = (await resp.json()) as any;
    return res.status(resp.status).json(body);
  } catch (err: any) {
    logger.error({ correlation_id: correlationId, err: err.message }, 'Failed to submit application to Team C');
    return res.status(502).json(
      createErrorEnvelope('UPSTREAM_UNAVAILABLE', 'Failed to submit application to data engine', correlationId)
    );
  }
});

app.get('/api/v1/ui/applications/:applicationId', requireAuth(config.JWT_SECRET), async (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req);
  const user = (req as any).user as UserTokenPayload;

  try {
    const appRes = await fetch(`${config.DATA_ENGINE_URL}/api/v1/applications/${req.params.applicationId}`, {
      headers: {
        'X-Correlation-ID': correlationId,
        Authorization: req.header('Authorization')!
      }
    });

    if (!appRes.ok) {
      const errBody = await appRes.json();
      return res.status(appRes.status).json(errBody);
    }

    const appBody = (await appRes.json()) as any;
    const appData = appBody.data;

    // Ownership check: Students can only view their own applications
    if (user.role === 'Student' && appData.student_id !== user.user_id) {
      return res.status(403).json(
        createErrorEnvelope('FORBIDDEN', 'Access forbidden: You do not own this application', correlationId)
      );
    }

    let decisionData = null;
    if (appData.decision_id) {
      try {
        const decRes = await fetch(`${config.ELIGIBILITY_URL}/api/v1/eligibility/decisions/${appData.decision_id}`, {
          headers: { 'X-Correlation-ID': correlationId }
        });
        if (decRes.ok) {
          const decBody = (await decRes.json()) as any;
          decisionData = decBody.data;
        }
      } catch (e: any) {
        logger.warn({ correlation_id: correlationId, error: e.message }, 'Could not fetch decision from Team A');
      }
    }

    let rankingData = null;
    if (appData.ranking_id || appData.drive_id) {
      try {
        const rankRes = await fetch(`${config.RANKING_URL}/api/v1/rankings/${appData.ranking_id || appData.drive_id}`, {
          headers: { 'X-Correlation-ID': correlationId }
        });
        if (rankRes.ok) {
          const rankBody = (await rankRes.json()) as any;
          rankingData = rankBody.data;
        }
      } catch (e: any) {
        logger.warn({ correlation_id: correlationId, error: e.message }, 'Could not fetch ranking from Team B');
      }
    }

    const aggregate = {
      application: appData,
      decision: decisionData,
      ranking: rankingData,
      freshness: new Date().toISOString(),
      alerts: [],
      permissions: user.role === 'Student' ? ['view_my_applications'] : ['view_all_applications']
    };

    return res.status(200).json(createSuccessEnvelope(aggregate, correlationId));
  } catch (err: any) {
    logger.error({ correlation_id: correlationId, err: err.message }, 'Failed to aggregate application details');
    return res.status(502).json(
      createErrorEnvelope('UPSTREAM_UNAVAILABLE', 'Failed to aggregate application details', correlationId)
    );
  }
});

// -------------------------------------------------------------
// D3: Dashboard & Resilient SSE Live Stream
// -------------------------------------------------------------

app.get('/api/v1/ui/dashboard', requireAuth(config.JWT_SECRET), async (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req);
  try {
    const drivesRes = await fetch(`${config.DATA_ENGINE_URL}/api/v1/drives`, {
      headers: {
        'X-Correlation-ID': correlationId,
        Authorization: req.header('Authorization')!
      }
    });
    const drivesData = drivesRes.ok ? ((await drivesRes.json()) as any).data : [];

    let recentApps: any[] = [];
    try {
      const reportsRes = await fetch(`${config.DATA_ENGINE_URL}/api/v1/reports/placement-performance`, {
        headers: {
          'X-Correlation-ID': correlationId,
          Authorization: req.header('Authorization')!
        }
      });
      if (reportsRes.ok) {
        const reportJson = (await reportsRes.json()) as any;
        recentApps = reportJson.data?.recent_applications || [];
      }
    } catch (e: any) {
      logger.warn({ correlation_id: correlationId, error: e.message }, 'Reports unavailable for dashboard');
    }

    return res.status(200).json(
      createSuccessEnvelope(
        {
          active_drives: drivesData.filter((d: any) => d.state === 'OPEN'),
          recent_applications: recentApps,
          freshness: new Date().toISOString()
        },
        correlationId
      )
    );
  } catch (err: any) {
    logger.error({ correlation_id: correlationId, err: err.message }, 'Failed to aggregate dashboard data');
    return res.status(502).json(
      createErrorEnvelope('UPSTREAM_UNAVAILABLE', 'Failed to aggregate dashboard data', correlationId)
    );
  }
});

app.get('/api/v1/ui/stream', (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Correlation-ID': correlationId
  });

  res.write(
    `data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE stream connected', timestamp: new Date().toISOString() })}\n\n`
  );

  const controller = new AbortController();
  const serviceHeaders = getServiceAuthHeaders(correlationId);

  fetch(`${config.DATA_ENGINE_URL}/internal/v1/outbox/stream`, {
    signal: controller.signal,
    headers: serviceHeaders
  })
    .then(async (outboxRes) => {
      if (!outboxRes.ok || !outboxRes.body) {
        logger.warn({ correlation_id: correlationId }, 'Outbox upstream failed or closed');
        return;
      }
      const reader = outboxRes.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value));
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        logger.warn({ correlation_id: correlationId, error: err.message }, 'Outbox stream disconnected');
      }
    });

  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'HEARTBEAT', timestamp: new Date().toISOString() })}\n\n`);
  }, 10000);

  req.on('close', () => {
    clearInterval(interval);
    controller.abort();
    res.end();
  });
});

app.get('/api/v1/ui/rankings', requireAuth(config.JWT_SECRET), async (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req);
  const driveId = (req.query.drive_id as string) || 'default';
  try {
    const resp = await fetch(`${config.RANKING_URL}/api/v1/rankings/${driveId}`, {
      headers: { 'X-Correlation-ID': correlationId }
    });
    const body = (await resp.json()) as any;
    return res.status(resp.status).json(body);
  } catch (err: any) {
    logger.error({ correlation_id: correlationId, err: err.message }, 'Failed to fetch rankings');
    return res.status(502).json(
      createErrorEnvelope('UPSTREAM_UNAVAILABLE', 'Failed to fetch rankings from ranking engine', correlationId)
    );
  }
});

// -------------------------------------------------------------
// D4: Administrative Actions with Strict Role Guards
// -------------------------------------------------------------

app.patch(
  '/api/v1/ui/drives/:driveId',
  requireAuth(config.JWT_SECRET),
  requireRole(['Placement_Admin']),
  async (req: Request, res: Response) => {
    const correlationId = getCorrelationId(req);
    try {
      const resp = await fetch(`${config.DATA_ENGINE_URL}/internal/v1/drives/${req.params.driveId}`, {
        method: 'PATCH',
        headers: getServiceAuthHeaders(correlationId),
        body: JSON.stringify(req.body)
      });
      const body = (await resp.json()) as any;
      return res.status(resp.status).json(body);
    } catch (err: any) {
      logger.error({ correlation_id: correlationId, err: err.message }, 'Failed to proxy drive update');
      return res.status(502).json(
        createErrorEnvelope('UPSTREAM_UNAVAILABLE', 'Failed to update drive in data engine', correlationId)
      );
    }
  }
);

app.post(
  '/api/v1/ui/rankings/preview',
  requireAuth(config.JWT_SECRET),
  requireRole(['Placement_Admin', 'Faculty_TPO']),
  async (req: Request, res: Response) => {
    const correlationId = getCorrelationId(req);
    try {
      const resp = await fetch(`${config.RANKING_URL}/api/v1/rankings/compute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': correlationId
        },
        body: JSON.stringify(req.body)
      });
      const body = (await resp.json()) as any;
      return res.status(resp.status).json(body);
    } catch (err: any) {
      logger.error({ correlation_id: correlationId, err: err.message }, 'Failed to compute ranking preview');
      return res.status(502).json(
        createErrorEnvelope('UPSTREAM_UNAVAILABLE', 'Failed to compute ranking preview from ranking engine', correlationId)
      );
    }
  }
);

app.get(
  '/api/v1/ui/reports/placement-performance',
  requireAuth(config.JWT_SECRET),
  requireRole(['Placement_Admin', 'Faculty_TPO']),
  async (req: Request, res: Response) => {
    const correlationId = getCorrelationId(req);
    try {
      const resp = await fetch(`${config.DATA_ENGINE_URL}/api/v1/reports/placement-performance`, {
        headers: {
          'X-Correlation-ID': correlationId,
          Authorization: req.header('Authorization')!
        }
      });
      const body = (await resp.json()) as any;
      return res.status(resp.status).json(body);
    } catch (err: any) {
      logger.error({ correlation_id: correlationId, err: err.message }, 'Failed to fetch performance report');
      return res.status(502).json(
        createErrorEnvelope('UPSTREAM_UNAVAILABLE', 'Failed to fetch performance reports', correlationId)
      );
    }
  }
);

// Fallback 404 handler
app.use((req: Request, res: Response) => {
  const correlationId = getCorrelationId(req);
  res.status(404).json(
    createErrorEnvelope('NOT_FOUND', `Route '${req.method} ${req.originalUrl || req.url}' not found`, correlationId)
  );
});

// Central error handler
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const correlationId = getCorrelationId(req);
  logger.error({ correlation_id: correlationId, err: err.message, stack: err.stack }, 'Unhandled error in BFF');
  res.status(500).json(
    createErrorEnvelope('INTERNAL_ERROR', 'Internal server error', correlationId)
  );
});

export function startBffServer(port: number = config.BFF_PORT) {
  return app.listen(port, () => {
    logger.info(`ApniLeap BFF server running on port ${port} [env: ${config.NODE_ENV}]`);
  });
}

if (process.env.NODE_ENV !== 'test' && !process.env.npm_lifecycle_event?.includes('test')) {
  startBffServer();
}
