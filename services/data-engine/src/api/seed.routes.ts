import { Router, Request, Response, NextFunction } from 'express';
import { seedDatabase } from '../seed/seedData.js';
import { UserService } from '../services/userService.js';
import { StorageManager } from '../storage/storageManager.js';
import { sendSuccessResponse } from './middleware/responseEnvelope.js';

export const seedRouter = Router();

seedRouter.post('/internal/v1/seed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storage = StorageManager.getInstance();
    const seedResult = seedDatabase(storage);
    const usersCount = await UserService.getInstance().seedDefaultUsers();

    // Optionally sync with Team B
    const teamBUrl = process.env.TEAM_B_URL || 'http://localhost:3002';
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'internal-service-auth-key-2026-secure';

    const students = storage.getTable('students').getAllRecords();
    const drives = storage.getTable('drives').getAllRecords();

    // Background sync to Team B without blocking
    Promise.allSettled([
      ...students.map(s =>
        fetch(`${teamBUrl}/internal/v1/profiles/students/${s.student_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Service-Token': internalSecret },
          body: JSON.stringify(s)
        }).catch(() => {})
      ),
      ...drives.map(d =>
        fetch(`${teamBUrl}/internal/v1/profiles/drives/${d.drive_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Service-Token': internalSecret },
          body: JSON.stringify(d)
        }).catch(() => {})
      )
    ]).catch(() => {});

    return sendSuccessResponse(
      res,
      req,
      {
        studentsCount: seedResult.studentsCount,
        drivesCount: seedResult.drivesCount,
        usersCount,
        seeded: true
      },
      200
    );
  } catch (err) {
    next(err);
  }
});
