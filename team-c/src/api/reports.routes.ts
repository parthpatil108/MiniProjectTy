import { Router, Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/reportService.js';
import { sendSuccessResponse } from './middleware/responseEnvelope.js';

export const reportsRouter = Router();
const reportService = new ReportService();

/**
 * GET /api/v1/reports/placement-performance
 * Read aggregated placement performance analytics (C4)
 */
reportsRouter.get('/api/v1/reports/placement-performance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = reportService.getPlacementPerformanceReport();
    return sendSuccessResponse(res, req, report, 200);
  } catch (err) {
    next(err);
  }
});
