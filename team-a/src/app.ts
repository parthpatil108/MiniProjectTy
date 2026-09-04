import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { correlationMiddleware } from './middleware/correlation';
import { idempotencyMiddleware } from './middleware/idempotency';
import { errorHandler, AppError } from './middleware/errorHandler';
import { EligibilityService } from './services/EligibilityService';
import { createEligibilityRouter } from './routes/eligibilityRoutes';
import { createRuleRouter } from './routes/ruleRoutes';
import { createMetricRouter } from './routes/metricRoutes';
import { config } from './config/env';

export function createApp(eligibilityService?: EligibilityService): Express {
  const app = express();
  const service = eligibilityService || new EligibilityService();

  // Global middleware
  app.use(cors());
  app.use(express.json());
  app.use(correlationMiddleware);
  app.use(idempotencyMiddleware);

  // Health endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      service: config.serviceName,
      timestamp: new Date().toISOString()
    });
  });

  // API v1 routes
  app.use('/api/v1', createEligibilityRouter(service));
  app.use('/api/v1', createMetricRouter(service));

  // Internal v1 routes
  app.use('/internal/v1', createRuleRouter(service));

  // 404 Handler
  app.use((req: Request, res: Response, next: NextFunction) => {
    next(new AppError(404, 'NOT_FOUND', `Cannot ${req.method} ${req.originalUrl}`));
  });

  // Central error handler
  app.use(errorHandler);

  return app;
}
