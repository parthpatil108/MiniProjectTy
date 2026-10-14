import { Router, Request, Response, NextFunction } from 'express';
import { ApplicationService } from '../services/applicationService.js';
import { sendSuccessResponse } from './middleware/responseEnvelope.js';

export const applicationsRouter = Router();
const applicationService = new ApplicationService();

/**
 * POST /api/v1/applications
 * Create an application (C2)
 */
applicationsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idempotencyKey =
      (req.header('Idempotency-Key') || req.header('idempotency-key'))?.trim();
    const correlationId =
      (req.header('X-Correlation-ID') || req.header('x-correlation-id'))?.trim();
    const result = await applicationService.createApplication(req.body, idempotencyKey, correlationId);
    return sendSuccessResponse(res, req, result, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/applications
 * List applications optionally filtered by student_id or drive_id
 */
applicationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.query.student_id as string | undefined;
    const driveId = req.query.drive_id as string | undefined;
    const records = await applicationService.getAllApplications({ student_id: studentId, drive_id: driveId });
    return sendSuccessResponse(res, req, records, 200);
  } catch (err) {
    next(err);
  }
});


/**
 * GET /api/v1/applications/:applicationId
 * Read application state and referenced decision/ranking (C2)
 */
applicationsRouter.get('/:applicationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appData = await applicationService.getApplicationById(req.params.applicationId);
    return sendSuccessResponse(res, req, appData, 200);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/applications/:applicationId/withdraw
 * Withdraw an application (C2)
 */
applicationsRouter.post('/:applicationId/withdraw', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idempotencyKey =
      (req.header('Idempotency-Key') || req.header('idempotency-key'))?.trim();
    const expectedVersion = req.body?.expectedVersion;
    const result = await applicationService.withdrawApplication(
      req.params.applicationId,
      idempotencyKey,
      expectedVersion
    );
    return sendSuccessResponse(res, req, result, 200);
  } catch (err) {
    next(err);
  }
});
