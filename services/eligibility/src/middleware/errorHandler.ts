import { Request, Response, NextFunction } from 'express';
import { ErrorCode, ErrorDetail, ErrorEnvelope } from '../types';
import { config } from '../config/env';

export class AppError extends Error {
  public statusCode: number;
  public code: ErrorCode;
  public details?: ErrorDetail[];

  constructor(statusCode: number, code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  const correlationId = req.correlationId || 'unknown';

  if (err instanceof AppError) {
    const envelope: ErrorEnvelope = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details || []
      },
      meta: {
        correlation_id: correlationId,
        api_version: config.apiVersion,
        timestamp: new Date().toISOString()
      }
    };
    res.status(err.statusCode).json(envelope);
    return;
  }

  // Fallback for unexpected errors
  const envelope: ErrorEnvelope = {
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message || 'An unexpected internal error occurred'
    },
    meta: {
      correlation_id: correlationId,
      api_version: config.apiVersion,
      timestamp: new Date().toISOString()
    }
  };
  res.status(500).json(envelope);
};
