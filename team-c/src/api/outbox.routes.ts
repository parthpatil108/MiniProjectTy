import { Router, Request, Response } from 'express';
import { OutboxService } from '../services/outboxService.js';

export const outboxRouter = Router();
const outboxService = new OutboxService();

/**
 * GET /internal/v1/outbox/stream
 * Server-Sent Events (SSE) stream of outbox events for Team D (C5)
 */
outboxRouter.get('/internal/v1/outbox/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const events = outboxService.getAllEvents();
  for (const evt of events) {
    res.write(`event: ${evt.event_type}\n`);
    res.write(`data: ${JSON.stringify(evt.payload)}\n\n`);
  }

  res.write(`event: ping\ndata: {"time": "${new Date().toISOString()}"}\n\n`);
  res.end();
});
