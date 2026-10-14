import { Router, Request, Response, NextFunction } from 'express';
import { EligibilityService } from '../services/EligibilityService';
import { config } from '../config/env';

export function createEligibilityRouter(eligibilityService: EligibilityService): Router {
  const router = Router();

  // POST /api/v1/eligibility/requests
  router.post('/eligibility/requests', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { request_id, application_id, student_id, drive_id, rule_set_version, priority, submitted_at, student, criteria, strategy } = req.body;

      const result = eligibilityService.submitEligibilityRequest(
        {
          request_id,
          application_id,
          student_id,
          drive_id,
          rule_set_version,
          priority,
          submitted_at: submitted_at || new Date().toISOString()
        },
        student,
        criteria,
        strategy,
        req.correlationId
      );

      res.status(202).json({
        data: {
          request_id: result.request_id,
          queue_position: result.queue_position,
          state: result.state,
          estimated_evaluation_time_ms: result.estimated_evaluation_time_ms
        },
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

  // GET /api/v1/drives/:driveId/queue
  router.get('/drives/:driveId/queue', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { driveId } = req.params;
      const data = eligibilityService.getDriveQueue(driveId);

      res.status(200).json({
        data,
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

  // GET /api/v1/eligibility/requests/:requestId
  router.get('/eligibility/requests/:requestId', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { requestId } = req.params;
      const data = eligibilityService.getEligibilityRequest(requestId);

      res.status(200).json({
        data,
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

  // GET /api/v1/eligibility/decisions/:decisionId
  router.get('/eligibility/decisions/:decisionId', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { decisionId } = req.params;
      const decision = eligibilityService.getDecision(decisionId);

      res.status(200).json({
        data: decision,
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

  return router;
}
