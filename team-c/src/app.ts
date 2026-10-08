import express, { Express, Request, Response } from 'express';
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

const app: Express = express();
const startTime = Date.now();

app.use(express.json());
app.use(correlationIdMiddleware);

// Health check endpoint
app.get('/healthz', (req: Request, res: Response) => {
  const uptimeSec = (Date.now() - startTime) / 1000;
  res.status(200).json({ status: 'ok', uptimeSec });
});

// API Routes
app.use('/api/v1/students', studentsRouter);
app.use('/api/v1/applications', applicationsRouter);
app.use(drivesRouter);
app.use(offersRouter);
app.use(auditRouter);
app.use(reportsRouter);
app.use(recoveryRouter);
app.use(outboxRouter);

// Error Handling Middleware
app.use(errorHandlerMiddleware);

export { app };
