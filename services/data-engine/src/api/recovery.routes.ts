import { Router, Request, Response, NextFunction } from 'express';
import { WalRecovery } from '../storage/wal/recovery.js';
import { sendSuccessResponse } from './middleware/responseEnvelope.js';

export const recoveryRouter = Router();

/**
 * POST /internal/v1/recovery/verify
 * Trigger recovery self-check and WAL verification (C4)
 */
recoveryRouter.post('/internal/v1/recovery/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const walRecovery = new WalRecovery();
    const report = walRecovery.recover();
    return sendSuccessResponse(res, req, {
      status: report.status || 'OK',
      lastCheckpointLsn: report.lastCheckpointLsn,
      walBacklog: report.walBacklog,
    }, 200);
  } catch (err) {
    next(err);
  }
});
