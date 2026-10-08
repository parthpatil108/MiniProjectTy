import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import { ProfileRegistryService } from '../services/profileRegistryService';
import { RankingService } from '../services/rankingService';
import { ShortlistIndex } from '../services/shortlistIndexService';
import { ShortlistCacheService } from '../services/shortlistCacheService';
import { ShortlistLookupService } from '../services/shortlistLookupService';
import { AnalyticsService } from '../services/analyticsService';
import { RankingMetricsService } from '../services/rankingMetricsService';
import { success, failure } from '../services/apiEnvelope';

import type { HistoricalPlacementRecord, RankingAlgorithm } from '../types';

export interface ApiContext {
  registry: ProfileRegistryService;
  ranking: RankingService;
  lookup: ShortlistLookupService;
  analytics: AnalyticsService;
  metrics: RankingMetricsService;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  if (chunks.length === 0) return {};

  const text = Buffer.concat(chunks).toString('utf8');

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Request body must contain valid JSON.');
  }
}

function getCorrelationId(req: IncomingMessage): string {
  const header = req.headers['x-correlation-id'];

  if (Array.isArray(header)) {
    return header[0] ?? randomUUID();
  }

  return header ?? randomUUID();
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  const json = JSON.stringify(body);

  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Length', Buffer.byteLength(json));
  res.end(json);
}

function pathParts(pathname: string): string[] {
  return pathname
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);
}

export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  context: ApiContext,
): Promise<void> {
  const correlationId = getCorrelationId(req);

  try {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://localhost');
    const parts = pathParts(url.pathname);

    // Health check
    if (method === 'GET' && url.pathname === '/health') {
      sendJson(
        res,
        200,
        success({ status: 'UP' }, correlationId),
      );
      return;
    }

    // ------------------------------------------------------------
    // B1 — Profile APIs
    // ------------------------------------------------------------

    if (
      method === 'PUT' &&
      parts.length === 5 &&
      parts[0] === 'internal' &&
      parts[1] === 'v1' &&
      parts[2] === 'profiles' &&
      parts[3] === 'students'
    ) {
      const studentId = parts[4];
      const body = await readJsonBody(req);

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        sendJson(
          res,
          400,
          failure(
            'VALIDATION_ERROR',
            'Student profile must be a JSON object.',
            correlationId,
          ),
        );
        return;
      }

      const student = {
        ...(body as Record<string, unknown>),
        student_id: studentId,
      };

      const result = context.registry.addOrUpdateStudent(
        student as Parameters<
          ProfileRegistryService['addOrUpdateStudent']
        >[0],
      );

      sendJson(res, 200, success(result, correlationId));
      return;
    }

    if (
      method === 'PUT' &&
      parts.length === 5 &&
      parts[0] === 'internal' &&
      parts[1] === 'v1' &&
      parts[2] === 'profiles' &&
      parts[3] === 'drives'
    ) {
      const driveId = parts[4];
      const body = await readJsonBody(req);

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        sendJson(
          res,
          400,
          failure(
            'VALIDATION_ERROR',
            'Drive profile must be a JSON object.',
            correlationId,
          ),
        );
        return;
      }

      const drive = {
        ...(body as Record<string, unknown>),
        drive_id: driveId,
      };

      const result = context.registry.addOrUpdateDrive(
        drive as Parameters<
          ProfileRegistryService['addOrUpdateDrive']
        >[0],
      );

      sendJson(res, 200, success(result, correlationId));
      return;
    }

    if (
      method === 'GET' &&
      parts.length === 3 &&
      parts[0] === 'api' &&
      parts[1] === 'v1' &&
      parts[2] === 'profiles'
    ) {
      sendJson(
        res,
        200,
        success(
          {
            graph: context.registry.getGraphSummary(),
            students: [...context.registry.students.values()],
            drives: [...context.registry.drives.values()],
          },
          correlationId,
        ),
      );
      return;
    }

    // ------------------------------------------------------------
    // B2 — Ranking APIs
    // ------------------------------------------------------------

    if (
      method === 'POST' &&
      parts.length === 4 &&
      parts[0] === 'api' &&
      parts[1] === 'v1' &&
      parts[2] === 'rankings' &&
      parts[3] === 'compute'
    ) {
      const body = await readJsonBody(req);

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        sendJson(
          res,
          400,
          failure(
            'VALIDATION_ERROR',
            'Ranking request must be a JSON object.',
            correlationId,
          ),
        );
        return;
      }

      const input = body as Record<string, unknown>;

      const driveId =
        typeof input.drive_id === 'string'
          ? input.drive_id
          : undefined;

      const algorithm =
        typeof input.algorithm === 'string'
          ? input.algorithm
          : 'WEIGHTED_SCORE';

      if (
        algorithm !== 'WEIGHTED_SCORE' &&
        algorithm !== 'MERGE_SORT' &&
        algorithm !== 'HEAP_TOPK'
      ) {
        sendJson(
          res,
          400,
          failure(
            'VALIDATION_ERROR',
            `Unsupported ranking algorithm: ${algorithm}`,
            correlationId,
            'algorithm',
          ),
        );
        return;
      }

      const graphVersion =
        typeof input.graph_version === 'string'
          ? input.graph_version
          : undefined;

      if (
        graphVersion !== undefined &&
        graphVersion !== context.registry.graph_version
      ) {
        sendJson(
          res,
          409,
          failure(
            'VERSION_MISMATCH',
            `Requested graph_version ${graphVersion} does not match current ${context.registry.graph_version}.`,
            correlationId,
            'graph_version',
          ),
        );
        return;
      }

      const topK =
        typeof input.top_k === 'number'
          ? input.top_k
          : undefined;

      const result = context.ranking.computeRanking({
        driveId,
        algorithm: algorithm as RankingAlgorithm,
        topK,
      });

      sendJson(res, 200, success(result, correlationId));
      return;
    }

    // ------------------------------------------------------------
    // B2 — Read ranking
    //
    // RankingService creates deterministic ranking IDs.
    // We recompute from the encoded ranking ID only when the
    // corresponding drive/algorithm can be supplied by the client.
    // For this MVP, the compute response is the authoritative
    // ranking result.
    // ------------------------------------------------------------

    if (
      method === 'GET' &&
      parts.length === 4 &&
      parts[0] === 'api' &&
      parts[1] === 'v1' &&
      parts[2] === 'rankings'
    ) {
      sendJson(
        res,
        404,
        failure(
          'NOT_FOUND',
          `Ranking ${parts[3]} is not stored as a mutable server-side record in this MVP. Use POST /api/v1/rankings/compute to generate the deterministic ranking.`,
          correlationId,
        ),
      );
      return;
    }

    // ------------------------------------------------------------
    // B3 — Shortlist index lookup
    // ------------------------------------------------------------

    if (
      method === 'GET' &&
      parts.length === 4 &&
      parts[0] === 'internal' &&
      parts[1] === 'v1' &&
      parts[2] === 'shortlist-index'
    ) {
      const result = context.lookup.getByKey(
        parts[3],
        correlationId,
      );

      sendJson(res, result.status, result.body);
      return;
    }

    // ------------------------------------------------------------
    // B3 — Shortlist cache invalidation
    // ------------------------------------------------------------

   if (
    method === 'POST' &&
    parts.length === 4 &&
    parts[0] === 'internal' &&
    parts[1] === 'v1' &&
    parts[2] === 'shortlist-cache' &&
    parts[3] === 'invalidate'
  ) {
      const body = await readJsonBody(req);

      const result = context.lookup.invalidate(
        body,
        correlationId,
      );

      sendJson(res, result.status, result.body);
      return;
    }

    // ------------------------------------------------------------
    // B4 — Analytics
    // ------------------------------------------------------------

    if (
      method === 'POST' &&
      parts.length === 4 &&
      parts[0] === 'api' &&
      parts[1] === 'v1' &&
      parts[2] === 'analytics' &&
      parts[3] === 'analyse'
    ) {
      const body = await readJsonBody(req);

      const input =
        body && typeof body === 'object' && !Array.isArray(body)
          ? (body as Record<string, unknown>)
          : {};

      const records = Array.isArray(input.records)
        ? input.records as HistoricalPlacementRecord[]
        : [];

      const filters =
        input.filters &&
        typeof input.filters === 'object' &&
        !Array.isArray(input.filters)
          ? input.filters as {
              department_filter?: string;
              batch?: string;
            }
          : {};

      const analytics = new AnalyticsService(records);

      const result = analytics.analyse(
        filters,
        correlationId,
      );

      sendJson(res, result.status, result.body);
      return;
    }

    // ------------------------------------------------------------
    // B4 — Ranking metrics
    // ------------------------------------------------------------

    if (
      method === 'GET' &&
      parts.length === 4 &&
      parts[0] === 'api' &&
      parts[1] === 'v1' &&
      parts[2] === 'metrics' &&
      parts[3] === 'ranking'
    ) {
      const result = context.metrics.getRankingMetrics(
        correlationId,
      );

      sendJson(res, result.status, result.body);
      return;
    }

    sendJson(
      res,
      404,
      failure(
        'NOT_FOUND',
        `Route not found: ${method} ${url.pathname}`,
        correlationId,
      ),
    );
  } catch (error) {
    sendJson(
      res,
      400,
      failure(
        'VALIDATION_ERROR',
        error instanceof Error
          ? error.message
          : 'Request could not be processed.',
        correlationId,
      ),
    );
  }
}