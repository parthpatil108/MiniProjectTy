/**
 * @apnileap/common
 * Shared core constants, error vocabulary, and envelope helpers.
 */

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

export interface SuccessEnvelope<T> {
  data: T;
  meta: {
    correlation_id: string;
    api_version: string;
    timestamp?: string;
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
    timestamp?: string;
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
      ...(details ? { details } : {})
    },
    meta: {
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    }
  };
}
