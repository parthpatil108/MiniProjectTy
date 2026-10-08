import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { ProfileRegistryService } from './services/profileRegistryService';
import { RankingService } from './services/rankingService';
import { AnalyticsService } from './services/analyticsService';
import { ShortlistIndex } from './services/shortlistIndexService';
import { ShortlistCacheService } from './services/shortlistCacheService';
import { ShortlistLookupService } from './services/shortlistLookupService';
import { RankingMetricsService } from './services/rankingMetricsService';
import { success, failure, assertCorrelationId } from './services/apiEnvelope';

export function createApp(
  registry: ProfileRegistryService,
  rankingService: RankingService,
  analyticsService: AnalyticsService,
  shortlistLookupService: ShortlistLookupService,
  shortlistCacheService: ShortlistCacheService,
  rankingMetricsService: RankingMetricsService
) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Middleware to ensure Correlation ID
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.header('X-Correlation-ID') || randomUUID();
    (req as any).correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    next();
  });

  app.get('/healthz', (req, res) => res.json({ status: 'UP', service: 'team-b-ranking' }));

  app.post('/api/v1/rankings/compute', (req, res) => {
    try {
      const result = rankingService.computeRanking(req.body);
      res.status(200).json(success(result, (req as any).correlationId));
    } catch (e: any) {
      res.status(400).json(failure('VALIDATION_ERROR', e.message, (req as any).correlationId));
    }
  });

  app.get('/api/v1/rankings/:rankingId', (req, res) => {
    try {
      // Mock ranking fetch for now, or implement from cache
      const result = rankingService.computeRanking({ driveId: req.params.rankingId }); // Fallback
      res.status(200).json(success(result, (req as any).correlationId));
    } catch(e: any) {
      res.status(404).json(failure('NOT_FOUND', e.message, (req as any).correlationId));
    }
  });

  app.get('/api/v1/profiles', (req, res) => {
    res.status(200).json(success(registry.getGraphSummary(), (req as any).correlationId));
  });

  app.put('/internal/v1/profiles/students/:studentId', (req, res) => {
    registry.addOrUpdateStudent(req.body);
    res.status(200).json(success({ accepted: true }, (req as any).correlationId));
  });

  app.put('/internal/v1/profiles/drives/:driveId', (req, res) => {
    registry.addOrUpdateDrive(req.body);
    res.status(200).json(success({ accepted: true }, (req as any).correlationId));
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
