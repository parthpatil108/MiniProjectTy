import { Router, Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/auditService.js';
import { sendSuccessResponse } from './middleware/responseEnvelope.js';

export const auditRouter = Router();
const auditService = new AuditService();

/**
 * GET /api/v1/audit
 * Search immutable audit evidence (C4)
 */
auditRouter.get('/api/v1/audit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlation_id = req.query.correlation_id as string | undefined;
    const entity_id = req.query.entity_id as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const entries = auditService.searchAudit({ correlation_id, entity_id, from, to });
    return sendSuccessResponse(res, req, entries, 200);
  } catch (err) {
    next(err);
  }
});
