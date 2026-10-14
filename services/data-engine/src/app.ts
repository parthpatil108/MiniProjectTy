import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import { correlationIdMiddleware } from './api/middleware/correlationId.js';
import { errorHandlerMiddleware } from './api/middleware/errorEnvelope.js';
import { studentsRouter } from './api/students.routes.js';
import { drivesRouter } from './api/drives.routes.js';
import { applicationsRouter } from './api/applications.routes.js';
import { offersRouter } from './api/offers.routes.js';
import { auditRouter } from './api/audit.routes.js';
import { reportsRouter } from './api/reports.routes.js';
import { recoveryRouter } from './api/recovery.routes.js';
import { outboxRouter } from './api/outbox.routes.js';
import { usersRouter } from './api/users.routes.js';
import { requireServiceAuth, loadConfig, createSuccessEnvelope } from '@apnileap/common';

const config = loadConfig();
const app: Express = express();
const startTime = Date.now();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(correlationIdMiddleware);

// Health check endpoint
app.get('/healthz', (req: Request, res: Response) => {
  const uptimeSec = (Date.now() - startTime) / 1000;
  res.status(200).json({ status: 'ok', uptimeSec, service: 'team-c-data-engine' });
});

app.get('/readyz', (req: Request, res: Response) => {
  res.status(200).json(createSuccessEnvelope({ ready: true, service: 'team-c-data-engine' }, (req as any).correlationId || 'readyz'));
});

// Enforce service authentication on all internal routes
app.use('/internal/v1', requireServiceAuth(config.INTERNAL_SERVICE_SECRET));

// API Routes
app.use('/api/v1/students', studentsRouter);
app.use('/api/v1/applications', applicationsRouter);
app.use(drivesRouter);
app.use(offersRouter);
app.use(auditRouter);
app.use(reportsRouter);
app.use(recoveryRouter);
app.use(outboxRouter);
app.use(usersRouter);

// Error Handling Middleware
app.use(errorHandlerMiddleware);

export { app };
