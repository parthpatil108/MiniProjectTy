import { Router, Request, Response, NextFunction } from 'express';
import { OfferService } from '../services/offerService.js';
import { sendSuccessResponse } from './middleware/responseEnvelope.js';

export const offersRouter = Router();
const offerService = new OfferService();

/**
 * POST /internal/v1/offers/commit
 * Atomically commit an offer transaction (C3)
 */
offersRouter.post('/internal/v1/offers/commit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = req.correlationId;
    const result = await offerService.commitOffer(req.body, correlationId);
    return sendSuccessResponse(res, req, result, 200);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /internal/v1/offers/compensate
 * Explicitly trigger compensation for a failed commit (C3)
 */
offersRouter.post('/internal/v1/offers/compensate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = req.correlationId;
    const result = await offerService.compensateOffer(req.body, correlationId);
    return sendSuccessResponse(res, req, result, 200);
  } catch (err) {
    next(err);
  }
});
