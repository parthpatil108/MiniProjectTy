import { ZodSchema, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { createErrorEnvelope, getCorrelationId } from './envelope.js';

export interface RequestValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validateRequest(schemas: RequestValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    const correlationId = getCorrelationId(req);
    const details: Array<{ field: string; reason: string }> = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        formatZodErrors(result.error, 'body', details);
      } else {
        req.body = result.data;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        formatZodErrors(result.error, 'query', details);
      } else {
        req.query = result.data as any;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        formatZodErrors(result.error, 'params', details);
      } else {
        req.params = result.data as any;
      }
    }

    if (details.length > 0) {
      return res.status(400).json(
        createErrorEnvelope('VALIDATION_ERROR', 'Request validation failed', correlationId, details)
      );
    }

    next();
  };
}

function formatZodErrors(
  error: ZodError,
  location: string,
  output: Array<{ field: string; reason: string }>
) {
  for (const issue of error.issues) {
    const fieldPath = [location, ...issue.path].join('.');
    output.push({
      field: fieldPath,
      reason: issue.message
    });
  }
}
