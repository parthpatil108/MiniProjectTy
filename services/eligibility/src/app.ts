import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { correlationMiddleware } from './middleware/correlation.js';
import { idempotencyMiddleware } from './middleware/idempotency.js';
import { errorHandler, AppError } from './middleware/errorHandler.js';
import { EligibilityService } from './services/EligibilityService.js';
import { createEligibilityRouter } from './routes/eligibilityRoutes.js';
import { createRuleRouter } from './routes/ruleRoutes.js';
import { createMetricRouter } from './routes/metricRoutes.js';
import { createLockRouter } from './routes/lockRoutes.js';
import { loadConfig, requireServiceAuth, createSuccessEnvelope } from '@apnileap/common';

const appConfig = loadConfig();

export function createApp(eligibilityService?: EligibilityService): Express {
  const app = express();
  const service = eligibilityService || new EligibilityService(undefined, undefined, undefined, undefined, true);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || appConfig.CORS_ORIGINS.includes(origin) || appConfig.NODE_ENV === 'test') {
          callback(null, true);
        } else {
          callback(new Error(`CORS blocked for origin: ${origin}`));
        }
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(correlationMiddleware);
  app.use(idempotencyMiddleware);

  // Health & Readiness endpoints
  app.get('/healthz', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      service: 'team-a-eligibility-engine',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/readyz', (req: Request, res: Response) => {
    res.status(200).json(
      createSuccessEnvelope({ ready: true, service: 'team-a-scheduling' }, (req as any).correlationId || 'readyz')
    );
  });

  // API v1 routes
  app.use('/api/v1', createEligibilityRouter(service));
  app.use('/api/v1', createMetricRouter(service));

  // Guard all internal routes with service authentication
  app.use('/internal/v1', requireServiceAuth(appConfig.INTERNAL_SERVICE_SECRET));

  // Internal v1 routes
  app.use('/internal/v1', createRuleRouter(service));
  app.use('/internal/v1', createLockRouter());

  // 404 Handler
  app.use((req: Request, res: Response, next: NextFunction) => {
    next(new AppError(404, 'NOT_FOUND', `Cannot ${req.method} ${req.originalUrl}`));
  });

  // Central error handler
  app.use(errorHandler);

  return app;
}
