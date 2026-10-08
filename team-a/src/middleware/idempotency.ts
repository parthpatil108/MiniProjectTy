import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

interface CachedEntry {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  requestBodyHash: string;
  expiresAt: number;
}

const idempotencyStore = new Map<string, CachedEntry>();

// Sweeper for expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of idempotencyStore.entries()) {
    if (entry.expiresAt <= now) {
      idempotencyStore.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

function computeSimpleHash(input: any): string {
  try {
    return JSON.stringify(input || {});
  } catch {
    return String(input);
  }
}

export const idempotencyMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Only apply to mutating methods (POST, PUT, PATCH, DELETE)
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const idempotencyKey = req.header('Idempotency-Key');
  if (!idempotencyKey) {
    return next();
  }

  const keyScope = `${req.method}:${req.baseUrl || ''}${req.path}:${idempotencyKey}`;
  const existing = idempotencyStore.get(keyScope);
  const currentBodyHash = computeSimpleHash(req.body);

  if (existing) {
    if (existing.expiresAt > Date.now()) {
      if (existing.requestBodyHash !== currentBodyHash) {
        res.status(409).json({
          error: {
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Idempotency key was already used with different request parameters',
            details: [{ field: 'Idempotency-Key', reason: 'payload_mismatch' }]
          },
          meta: {
            correlation_id: req.correlationId,
            api_version: config.apiVersion,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Return cached response identically
      for (const [hKey, hVal] of Object.entries(existing.headers)) {
        res.setHeader(hKey, hVal);
      }
      res.setHeader('X-Cache-Lookup', 'HIT-IDEMPOTENT');
      res.status(existing.statusCode).json(existing.body);
      return;
    } else {
      idempotencyStore.delete(keyScope);
    }
  }

  // Intercept response to store result
  const originalJson = res.json.bind(res);
  res.json = function (body: any): Response {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyStore.set(keyScope, {
        statusCode: res.statusCode,
        headers: { 'Content-Type': 'application/json' },
        body,
        requestBodyHash: currentBodyHash,
        expiresAt: Date.now() + config.idempotencyTtlMs
      });
    }
    return originalJson(body);
  };

  next();
};

export function clearIdempotencyCache(): void {
  idempotencyStore.clear();
}
