import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import { ProfileRegistryService } from './services/profileRegistryService.js';
import { RankingService } from './services/rankingService.js';
import { AnalyticsService } from './services/analyticsService.js';
import { ShortlistIndex } from './services/shortlistIndexService.js';
import { ShortlistCacheService } from './services/shortlistCacheService.js';
import { ShortlistLookupService } from './services/shortlistLookupService.js';
import { RankingMetricsService } from './services/rankingMetricsService.js';
import { success, failure } from './services/apiEnvelope.js';
import { loadConfig, requireServiceAuth, createSuccessEnvelope } from '@apnileap/common';

const config = loadConfig();

export function createApp(
  registry: ProfileRegistryService,
  rankingService: RankingService,
  analyticsService: AnalyticsService,
  shortlistLookupService: ShortlistLookupService,
  shortlistCacheService: ShortlistCacheService,
  rankingMetricsService: RankingMetricsService
) {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || config.CORS_ORIGINS.includes(origin) || config.NODE_ENV === 'test') {
          callback(null, true);
        } else {
          callback(new Error(`CORS blocked for origin: ${origin}`));
        }
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  // Middleware to ensure Correlation ID
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.header('X-Correlation-ID') || randomUUID();
    (req as any).correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    next();
  });

  app.get('/healthz', (req, res) => res.json({ status: 'UP', service: 'team-b-ranking' }));
  app.get('/readyz', (req, res) => res.json(createSuccessEnvelope({ ready: true, service: 'team-b-ranking' }, (req as any).correlationId || 'readyz')));

  app.post('/api/v1/rankings/compute', (req, res) => {
    try {
      const options = {
        ...req.body,
        driveId: req.body.driveId || req.body.drive_id,
      };
      const result = rankingService.computeRanking(options);
      res.status(200).json(success(result, (req as any).correlationId));
    } catch (e: any) {
      res.status(400).json(failure('VALIDATION_ERROR', e.message, (req as any).correlationId));
    }
  });

  app.get('/api/v1/rankings/:rankingId', (req, res) => {
    try {
      const result = rankingService.computeRanking({ driveId: req.params.rankingId });
      res.status(200).json(success(result, (req as any).correlationId));
    } catch(e: any) {
      res.status(404).json(failure('NOT_FOUND', e.message, (req as any).correlationId));
    }
  });

  app.get('/api/v1/profiles', (req, res) => {
    res.status(200).json(success(registry.getGraphSummary(), (req as any).correlationId));
  });

  app.post('/api/v1/analytics/analyse', (req, res) => {
    try {
      const result = analyticsService.analyse(req.body);
      res.status(200).json(success(result, (req as any).correlationId));
    } catch(e: any) {
      res.status(400).json(failure('VALIDATION_ERROR', e.message, (req as any).correlationId));
    }
  });

  app.get('/api/v1/metrics/ranking', (req, res) => {
    const metrics = rankingMetricsService.getRankingMetrics((req as any).correlationId);
    res.status(200).json(metrics.body);
  });

  // Guard all internal routes with service authentication
  app.use('/internal/v1', requireServiceAuth(config.INTERNAL_SERVICE_SECRET));

  app.put('/internal/v1/profiles/students/:studentId', (req, res) => {
    try {
      const studentData = {
        ...req.body,
        student_id: req.params.studentId || req.body.student_id,
        project_score: req.body.project_score !== undefined ? Number(req.body.project_score) : 0,
      };
      const result = registry.addOrUpdateStudent(studentData);
      res.status(200).json(success(result, (req as any).correlationId));
    } catch (e: any) {
      res.status(400).json(failure('VALIDATION_ERROR', e.message, (req as any).correlationId));
    }
  });

  app.put('/internal/v1/profiles/drives/:driveId', (req, res) => {
    try {
      const driveData = {
        ...req.body,
        drive_id: req.params.driveId || req.body.drive_id,
        skill_weightage: req.body.skill_weightage || (req.body.criteria?.required_skill_tags ? Object.fromEntries(req.body.criteria.required_skill_tags.map((s: string) => [s, 1.0])) : {}),
      };
      const result = registry.addOrUpdateDrive(driveData);
      res.status(200).json(success(result, (req as any).correlationId));
    } catch (e: any) {
      res.status(400).json(failure('VALIDATION_ERROR', e.message, (req as any).correlationId));
    }
  });

  app.get('/internal/v1/shortlist-index/:key', (req, res) => {
    try {
      const result = shortlistLookupService.getByKey(req.params.key, (req as any).correlationId);
      res.status(result.status).json(result.body);
    } catch(e: any) {
      res.status(400).json(failure('VERSION_MISMATCH', e.message, (req as any).correlationId));
    }
  });

  app.post('/internal/v1/shortlist-cache/invalidate', (req, res) => {
    const result = shortlistCacheService.invalidate(req.body.key, req.body.profile_version);
    res.status(200).json(success({ invalidated: result === 'invalidated' }, (req as any).correlationId));
  });

  return app;
}
