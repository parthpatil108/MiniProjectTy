import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export const correlationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const incoming = req.header('X-Correlation-ID');
  const correlationId = (incoming && incoming.trim() !== '') ? incoming.trim() : uuidv4();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
};
