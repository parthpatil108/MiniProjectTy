import { Router, Request, Response, NextFunction } from 'express';
import { globalLockManager } from '../locks/lockManager';

export function createLockRouter(): Router {
  const router = Router();

  router.post('/locks/acquire', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slot_id, holder_id, lease_timeout_ms } = req.body;
      const result = globalLockManager.acquireSlotLock(slot_id, holder_id, lease_timeout_ms);
      
      if (!result.lock_granted) {
        return res.status(423).json({
          error: {
            code: 'LOCKED',
            message: `Resource is currently locked. Reason: ${result.conflict_reason}`
          },
          meta: {
            correlation_id: req.correlationId,
            api_version: 'v1',
            timestamp: new Date().toISOString()
          }
        });
      }

      res.status(200).json({
        data: result,
        meta: {
          correlation_id: req.correlationId,
          api_version: 'v1',
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/locks/:leaseId', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { leaseId } = req.params;
      const result = globalLockManager.releaseSlotLock(leaseId);
      
      res.status(200).json({
        data: result,
        meta: {
          correlation_id: req.correlationId,
          api_version: 'v1',
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
