import { randomUUID } from 'node:crypto';
export interface ApiMeta { correlation_id: string; api_version: 'v1'; timestamp: string }
export interface SuccessEnvelope<T> { data: T; meta: ApiMeta }
export interface ErrorEnvelope { error: { code: string; message: string; details?: { field?: string; reason?: string; message?: string }[] }; meta: ApiMeta }
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function assertCorrelationId(correlationId?: string): void {
  if (correlationId !== undefined && !UUID_V4.test(correlationId)) throw new TypeError('X-Correlation-ID must be a UUID v4.');
}
export function success<T>(data: T, correlationId: string = randomUUID()): SuccessEnvelope<T> {
  return { data, meta: { correlation_id: correlationId, api_version: 'v1', timestamp: new Date().toISOString() } };
}
export function failure(code: string, message: string, correlationId: string = randomUUID(), field?: string): ErrorEnvelope {
  return { error: { code, message, ...(field ? { details: [{ field, reason: code, message }] } : {}) }, meta: { correlation_id: correlationId, api_version: 'v1', timestamp: new Date().toISOString() } };
}
