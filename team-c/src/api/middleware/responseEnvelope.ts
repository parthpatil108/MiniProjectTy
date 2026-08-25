import { Request, Response } from 'express';

export interface MetaEnvelope {
  correlation_id: string;
  api_version: string;
  timestamp: string;
}

export function buildMeta(req: Request): MetaEnvelope {
  return {
    correlation_id: req.correlationId || '00000000-0000-0000-0000-000000000000',
    api_version: 'v1',
    timestamp: new Date().toISOString(),
  };
}

export function sendSuccessResponse(res: Response, req: Request, data: any, statusCode: number = 200): Response {
  return res.status(statusCode).json({
    data,
    meta: buildMeta(req),
  });
}
