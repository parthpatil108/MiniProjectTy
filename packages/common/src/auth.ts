import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { createErrorEnvelope, getCorrelationId } from './envelope.js';

export type UserRole = 'Student' | 'Faculty_TPO' | 'Placement_Admin';

export interface UserTokenPayload {
  user_id: string;
  role: UserRole;
  email: string;
  name?: string;
  [key: string]: any;
}

export interface ServiceTokenPayload {
  service: string;
  internal: true;
  issued_at: string;
}

// -------------------------------------------------------------
// Password Hashing via Node.js crypto.scrypt
// -------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

export async function verifyPassword(password: string, combinedHash: string): Promise<boolean> {
  const parts = combinedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuffer = Buffer.from(keyHex, 'hex');

  return new Promise((resolve) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return resolve(false);
      try {
        const matches = crypto.timingSafeEqual(keyBuffer, derivedKey);
        resolve(matches);
      } catch {
        resolve(false);
      }
    });
  });
}

// -------------------------------------------------------------
// JWT Token Signing and Verification
// -------------------------------------------------------------

export function signAccessToken(payload: UserTokenPayload, secret: string, expiresIn: jwt.SignOptions['expiresIn'] = '15m'): string {
  return jwt.sign(payload, secret, { expiresIn });
}

export function signRefreshToken(payload: { user_id: string; role: UserRole }, secret: string, expiresIn: jwt.SignOptions['expiresIn'] = '7d'): string {
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyToken<T = any>(token: string, secret: string): T {
  return jwt.verify(token, secret) as T;
}

export function signServiceToken(serviceName: string, internalSecret: string): string {
  const payload: ServiceTokenPayload = {
    service: serviceName,
    internal: true,
    issued_at: new Date().toISOString()
  };
  return jwt.sign(payload, internalSecret, { expiresIn: '1h' });
}

export function verifyServiceToken(token: string, internalSecret: string): ServiceTokenPayload {
  return jwt.verify(token, internalSecret) as ServiceTokenPayload;
}

// -------------------------------------------------------------
// Middlewares: Fails-Closed Authentication & RBAC
// -------------------------------------------------------------

export function requireAuth(secret: string): any {
  return (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = getCorrelationId(req);
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json(
        createErrorEnvelope('UNAUTHORIZED', 'Authentication token required', correlationId)
      );
      return;
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      res.status(401).json(
        createErrorEnvelope('UNAUTHORIZED', 'Authentication token required', correlationId)
      );
      return;
    }

    try {
      const decoded = verifyToken<UserTokenPayload>(token, secret);
      (req as any).user = decoded;
      next();
    } catch (err: any) {
      res.status(401).json(
        createErrorEnvelope(
          'UNAUTHORIZED',
          err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token signature',
          correlationId
        )
      );
      return;
    }
  };
}

export function requireRole(allowedRoles: UserRole[]): any {
  return (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = getCorrelationId(req);
    const user = (req as any).user as UserTokenPayload | undefined;

    if (!user) {
      res.status(401).json(
        createErrorEnvelope('UNAUTHORIZED', 'Authentication required', correlationId)
      );
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json(
        createErrorEnvelope(
          'FORBIDDEN',
          `Forbidden: Required role in [${allowedRoles.join(', ')}] but user has role '${user.role}'`,
          correlationId
        )
      );
      return;
    }

    next();
  };
}

export function requireServiceAuth(internalSecret: string): any {
  return (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = getCorrelationId(req);
    
    // Check X-Service-Token or Authorization header
    const serviceHeader = req.header('X-Service-Token');
    const authHeader = req.header('Authorization');
    const token = serviceHeader || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (!token) {
      res.status(401).json(
        createErrorEnvelope('UNAUTHORIZED', 'Service authentication required on internal routes', correlationId)
      );
      return;
    }

    // Direct shared key match or valid JWT service token
    if (token === internalSecret) {
      (req as any).service = { service: 'internal-direct', internal: true };
      next();
      return;
    }

    try {
      const decoded = verifyServiceToken(token, internalSecret);
      (req as any).service = decoded;
      next();
    } catch {
      res.status(401).json(
        createErrorEnvelope('UNAUTHORIZED', 'Invalid or expired service authentication token', correlationId)
      );
      return;
    }
  };
}
