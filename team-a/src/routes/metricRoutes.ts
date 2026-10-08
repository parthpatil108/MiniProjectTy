import { Router, Request, Response, NextFunction } from 'express';
import { EligibilityService } from '../services/EligibilityService';
import { config } from '../config/env';

export function createMetricRouter(eligibilityService: EligibilityService): Router {
  const router = Router();

  // GET /api/v1/metrics/eligibility
  router.get('/metrics/eligibility', (req: Request, res: Response, next: NextFunction) => {
    try {
      const metrics = eligibilityService.getMetrics();
      res.status(200).json({
        data: metrics,
        meta: {
          correlation_id: req.correlationId,
          api_version: config.apiVersion,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/stream/eligibility
  router.get('/stream/eligibility', (req: Request, res: Response) => {
    eligibilityService.getEventStream().addClient(res);
  });

  return router;
}
