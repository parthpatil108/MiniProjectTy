import { Router, Request, Response } from 'express';
import { UserService } from '../services/userService.js';
import { createSuccessEnvelope, createErrorEnvelope, getCorrelationId } from '@apnileap/common';

export const usersRouter = Router();

usersRouter.post('/internal/v1/users/authenticate', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req);
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json(
      createErrorEnvelope('VALIDATION_ERROR', 'Email and password are required', correlationId)
    );
  }

  const userService = UserService.getInstance();
  const authResult = await userService.authenticate(email, password);

  if (!authResult.success || !authResult.user) {
    return res.status(401).json(
      createErrorEnvelope('UNAUTHORIZED', authResult.error || 'Invalid credentials', correlationId)
    );
  }

  const { user_id, name, role, email: userEmail } = authResult.user;
  return res.status(200).json(
    createSuccessEnvelope({ user_id, name, email: userEmail, role }, correlationId)
  );
});

usersRouter.get('/internal/v1/users/by-email/:email', (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req);
  const email = req.params.email;
  const userService = UserService.getInstance();
  const user = userService.findByEmail(email);

  if (!user) {
    return res.status(404).json(
      createErrorEnvelope('NOT_FOUND', `User with email '${email}' not found`, correlationId)
    );
  }

  const { user_id, name, role, email: userEmail } = user;
  return res.status(200).json(
    createSuccessEnvelope({ user_id, name, email: userEmail, role }, correlationId)
  );
});

usersRouter.get('/internal/v1/users/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req);
  const userId = req.params.id;
  const userService = UserService.getInstance();
  const user = userService.findById(userId);

  if (!user) {
    return res.status(404).json(
      createErrorEnvelope('NOT_FOUND', `User with ID '${userId}' not found`, correlationId)
    );
  }

  const { user_id, name, role, email: userEmail } = user;
  return res.status(200).json(
    createSuccessEnvelope({ user_id, name, email: userEmail, role }, correlationId)
  );
});

usersRouter.post('/internal/v1/users', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req);
  const { user_id, name, email, password, role } = req.body || {};

  if (!user_id || !name || !email || !password || !role) {
    return res.status(400).json(
      createErrorEnvelope('VALIDATION_ERROR', 'user_id, name, email, password, and role are required', correlationId)
    );
  }

  const userService = UserService.getInstance();
  try {
    const user = await userService.createUser({ user_id, name, email, password, role });
    const { user_id: uid, name: uname, role: urole, email: uemail } = user;
    return res.status(201).json(
      createSuccessEnvelope({ user_id: uid, name: uname, email: uemail, role: urole }, correlationId)
    );
  } catch (err: any) {
    return res.status(409).json(
      createErrorEnvelope('STATE_CONFLICT', err.message, correlationId)
    );
  }
});

usersRouter.post('/internal/v1/users/seed-defaults', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req);
  const userService = UserService.getInstance();
  const seeded = await userService.seedDefaultUsers();
  return res.status(200).json(
    createSuccessEnvelope({ seeded_count: seeded }, correlationId)
  );
});
