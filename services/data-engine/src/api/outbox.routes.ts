import { Router, Request, Response } from 'express';
import { OutboxService, OutboxEvent } from '../services/outboxService.js';
import { sendSuccessResponse } from './middleware/responseEnvelope.js';

export const outboxRouter = Router();
const outboxService = new OutboxService();

/**
 * GET /internal/v1/outbox/stream
 * Server-Sent Events (SSE) stream of outbox events with Last-Event-ID replay and heartbeat
 */
outboxRouter.get('/internal/v1/outbox/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const lastEventId = req.header('Last-Event-ID') || (req.query.lastEventId as string);
  const events = outboxService.getAllEvents();

  let startIndex = 0;
  if (lastEventId) {
    const idx = events.findIndex(e => e.event_id === lastEventId);
    if (idx !== -1) {
      startIndex = idx + 1;
    }
  }

  // Replay events
  for (let i = startIndex; i < events.length; i++) {
    const evt = events[i];
    res.write(`id: ${evt.event_id}\n`);
    res.write(`event: ${evt.event_type}\n`);
    res.write(`data: ${JSON.stringify(evt.payload)}\n\n`);
  }

  // Live listener
  const listener = (evt: OutboxEvent) => {
    res.write(`id: ${evt.event_id}\n`);
    res.write(`event: ${evt.event_type}\n`);
    res.write(`data: ${JSON.stringify(evt.payload)}\n\n`);
  };

  OutboxService.emitter.on('new_event', listener);

  // Heartbeat every 15 seconds to prevent connection drops
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    OutboxService.emitter.off('new_event', listener);
  });
});

/**
 * GET /internal/v1/outbox/status
 * Check outbox queue depth, processed count, and dead-letters
 */
outboxRouter.get('/internal/v1/outbox/status', (req: Request, res: Response) => {
  const all = outboxService.getAllEvents();
  const pending = all.filter(e => e.status === 'PENDING' || e.status === 'FAILED').length;
  const processed = all.filter(e => e.status === 'PROCESSED').length;
  const deadLetter = all.filter(e => e.status === 'DEAD_LETTER').length;

  return sendSuccessResponse(res, req, {
    total: all.length,
    pending,
    processed,
    deadLetter
  }, 200);
});

/**
 * POST /internal/v1/outbox/process
 * Manually trigger pending outbox retry batch
 */
outboxRouter.post('/internal/v1/outbox/process', async (req: Request, res: Response) => {
  const result = await outboxService.processPendingEvents();
  return sendSuccessResponse(res, req, result, 200);
});
