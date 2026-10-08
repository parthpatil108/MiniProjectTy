import { Router, Request, Response, NextFunction } from 'express';
import { MasterDataService } from '../services/masterDataService.js';
import { sendSuccessResponse } from './middleware/responseEnvelope.js';

export const drivesRouter = Router();
const masterDataService = new MasterDataService();

/**
 * GET /api/v1/drives
 * List placement drives with optional criteria filter (C1)
 */
drivesRouter.get('/api/v1/drives', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const state = req.query.state as string | undefined;
    const drives = await masterDataService.listDrives(state);
    return sendSuccessResponse(res, req, drives, 200);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/drives/:driveId/criteria
 * Read drive criteria and seat capacity (C1)
 */
drivesRouter.get('/api/v1/drives/:driveId/criteria', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const drive = await masterDataService.getDriveCriteria(req.params.driveId);
    return sendSuccessResponse(res, req, drive, 200);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /internal/v1/drives/:driveId
 * Update drive operational state or criteria (C1)
 */
drivesRouter.patch('/internal/v1/drives/:driveId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updatedDrive = await masterDataService.updateDrive(req.params.driveId, req.body);
    return sendSuccessResponse(res, req, updatedDrive, 200);
  } catch (err) {
    next(err);
  }
});
