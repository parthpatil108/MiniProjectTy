import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const CLOSED_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'IDEMPOTENCY_CONFLICT',
  'RULE_CONFLICT',
  'STATE_CONFLICT',
  'VERSION_MISMATCH',
  'SLOT_UNAVAILABLE',
  'LOCK_TIMEOUT',
  'RATE_LIMITED',
  'UPSTREAM_UNAVAILABLE',
  'INTERNAL_ERROR'
] as const;

export type ErrorCode = (typeof CLOSED_ERROR_CODES)[number];

export const ERROR_CODE_TO_HTTP_STATUS: Record<ErrorCode, number> = {
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
  INTERNAL_ERROR: 500
};

export interface SuccessEnvelope<T> {
  data: T;
  meta: {
    correlation_id: string;
    api_version: string;
    timestamp: string;
  };
}

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: Array<Record<string, any> | string>;
  };
  meta: {
    correlation_id: string;
    timestamp: string;
  };
}

export function createSuccessEnvelope<T>(
  data: T,
  correlationId: string,
  apiVersion = 'v1'
): SuccessEnvelope<T> {
  return {
    data,
    meta: {
      correlation_id: correlationId,
      api_version: apiVersion,
      timestamp: new Date().toISOString()
    }
  };
}

export function createErrorEnvelope(
  code: ErrorCode,
  message: string,
  correlationId: string,
  details?: Array<Record<string, any> | string>
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {})
    },
    meta: {
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    }
  };
}

export function correlationIdMiddleware(req: any, res: any, next: any): void {
  const incomingId = req.header ? req.header('X-Correlation-ID') : req.headers?.['x-correlation-id'];
  const correlationId = (incomingId && String(incomingId).trim() ? String(incomingId).trim() : randomUUID()).toString();
  req.correlationId = correlationId;
  if (res.setHeader) res.setHeader('X-Correlation-ID', correlationId);
  next();
}

export function getCorrelationId(req: any): string {
  return req?.correlationId || (req?.header ? req.header('X-Correlation-ID') : req?.headers?.['x-correlation-id']) || randomUUID();
}
