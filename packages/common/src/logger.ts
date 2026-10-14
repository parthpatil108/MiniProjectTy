import pino from 'pino';
import { Request, Response, NextFunction } from 'express';
import { getCorrelationId } from './envelope.js';

export function createLogger(serviceName: string, level = 'info') {
  return pino({
    name: serviceName,
    level,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export function requestLoggerMiddleware(logger: any): any {
  return (req: any, res: any, next: any) => {
    const correlationId = getCorrelationId(req);
    const start = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      logger.info({
        correlation_id: correlationId,
        method: req.method,
        url: req.originalUrl || req.url,
        status: res.statusCode,
        duration_ms: durationMs,
      }, `${req.method} ${req.url} ${res.statusCode} (${durationMs}ms)`);
    });

    next();
  };
}
