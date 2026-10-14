import { Router, Request, Response, NextFunction } from 'express';
import { MasterDataService } from '../services/masterDataService.js';
import { sendSuccessResponse } from './middleware/responseEnvelope.js';

export const studentsRouter = Router();
const masterDataService = new MasterDataService();

/**
 * GET /api/v1/students
 * List registered student profiles (C1)
 */
studentsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const students = await masterDataService.listStudents();
    return sendSuccessResponse(res, req, students, 200);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/students
 * Register a new student profile (C1)
 */
studentsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await masterDataService.createStudent(req.body);
    return sendSuccessResponse(res, req, result, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/students/:studentId
 * Get a student profile
 */
studentsRouter.get('/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await masterDataService.getStudentById(req.params.studentId);
    return sendSuccessResponse(res, req, student, 200);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/students/:studentId
 * Update or upsert student profile
 */
studentsRouter.put('/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await masterDataService.updateStudent(req.params.studentId, req.body);
    return sendSuccessResponse(res, req, updated, 200);
  } catch (err) {
    next(err);
  }
});

