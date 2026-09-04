import { Router, Request, Response, NextFunction } from 'express';
import { EligibilityService } from '../services/EligibilityService';
import { config } from '../config/env';
import { v4 as uuidv4 } from 'uuid';

export function createRuleRouter(eligibilityService: EligibilityService): Router {
  const router = Router();

  // POST /internal/v1/rules/evaluate
  router.post('/rules/evaluate', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { student, criteria, strategy } = req.body;
      const evalResult = eligibilityService.evaluateDirect(student, criteria, strategy);

      const decision = {
        decision_id: uuidv4(),
        request_id: uuidv4(),
        eligibility_result: evalResult.result,
        failed_rules: evalResult.failedRules,
        rule_set_version: 'v1.0.0',
        lease_id: null,
        decision_metrics: {
          evaluation_time_ms: evalResult.evaluationTimeMs,
          queue_wait_ms: 0
        }
      };

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
