import { Request, Response, NextFunction } from 'express';
import { buildMeta } from './responseEnvelope.js';

export interface AppError extends Error {
  code?: string;
  statusCode?: number;
  details?: Array<{ field?: string; reason?: string; message?: string }>;
}

const errorCodeToHttpStatus: Record<string, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  IDEMPOTENCY_CONFLICT: 409,
  RULE_CONFLICT: 409,
  STATE_CONFLICT: 409,
  VERSION_MISMATCH: 409,
  SLOT_UNAVAILABLE: 409,
  LOCK_TIMEOUT: 423,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 502,
  INTERNAL_ERROR: 500,
};

export function errorHandlerMiddleware(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): Response {
  const code = err.code || 'INTERNAL_ERROR';
  const statusCode = err.statusCode || errorCodeToHttpStatus[code] || 500;
  const message = err.message || 'An internal error occurred.';
  const details = err.details || [];

  return res.status(statusCode).json({
    error: {
      code,
      message,
      details,
    },
    meta: buildMeta(req),
  });
}
