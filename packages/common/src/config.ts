import { z } from 'zod';
import path from 'path';

const FORBIDDEN_SECRETS = new Set([
  'changeme',
  'apnileap-shared-secret-key-2026',
  'secret',
  'password',
  'default'
]);

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long').refine(
    (val) => !FORBIDDEN_SECRETS.has(val.toLowerCase()),
    { message: 'JWT_SECRET cannot be a default or placeholder secret' }
  ),
  INTERNAL_SERVICE_SECRET: z.string().min(16, 'INTERNAL_SERVICE_SECRET must be at least 16 characters long').refine(
    (val) => !FORBIDDEN_SECRETS.has(val.toLowerCase()),
    { message: 'INTERNAL_SERVICE_SECRET cannot be a default or placeholder secret' }
  ).default('internal-service-auth-key-2026-secure'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3004').transform((val) =>
    val.split(',').map((s) => s.trim()).filter(Boolean)
  ),
  DATA_DIR: z.string().default(path.resolve(process.cwd(), 'data')),
  ELIGIBILITY_PORT: z.coerce.number().default(3001),
  RANKING_PORT: z.coerce.number().default(3002),
  DATA_ENGINE_PORT: z.coerce.number().default(3003),
  BFF_PORT: z.coerce.number().default(3004),
  WEB_PORT: z.coerce.number().default(5173),
  ELIGIBILITY_URL: z.string().url().default('http://localhost:3001'),
  RANKING_URL: z.string().url().default('http://localhost:3002'),
  DATA_ENGINE_URL: z.string().url().default('http://localhost:3003'),
  BFF_URL: z.string().url().default('http://localhost:3004')
});

export type AppConfig = z.infer<typeof configSchema>;

import dotenv from 'dotenv';

let cachedConfig: AppConfig | null = null;

export function loadConfig(envOverrides: Record<string, string | undefined> = {}): AppConfig {
  dotenv.config();
  try {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  } catch {
    // ignore
  }

  const env = { ...process.env, ...envOverrides };
  
  // Normalize legacy secret names if present
  if (!env.JWT_SECRET && env.JWT_SIGNING_SECRET) {
    env.JWT_SECRET = env.JWT_SIGNING_SECRET;
  }
  const isTest = env.NODE_ENV === 'test' || 
                 process.env.NODE_ENV === 'test' || 
                 process.env.JEST_WORKER_ID !== undefined ||
                 (process.env.npm_lifecycle_event && (
                   process.env.npm_lifecycle_event.includes('test') ||
                   process.env.npm_lifecycle_event.includes('seed')
                 ));

  if (isTest && env.NODE_ENV !== 'production') {
    if (!env.NODE_ENV) env.NODE_ENV = 'test';
    if (!env.JWT_SECRET) env.JWT_SECRET = 'apnileap-test-environment-jwt-secret-key-2026';
    if (!env.INTERNAL_SERVICE_SECRET) env.INTERNAL_SERVICE_SECRET = 'internal-service-auth-key-2026-secure';
  }
  if (!env.ELIGIBILITY_URL && env.TEAM_A_URL) env.ELIGIBILITY_URL = env.TEAM_A_URL;
  if (!env.RANKING_URL && env.TEAM_B_URL) env.RANKING_URL = env.TEAM_B_URL;
  if (!env.DATA_ENGINE_URL && env.TEAM_C_URL) env.DATA_ENGINE_URL = env.TEAM_C_URL;
  if (!env.BFF_URL && env.TEAM_D_URL) env.BFF_URL = env.TEAM_D_URL;
  if (!env.ELIGIBILITY_PORT && env.PORT_TEAM_A) env.ELIGIBILITY_PORT = env.PORT_TEAM_A;
  if (!env.RANKING_PORT && env.PORT_TEAM_B) env.RANKING_PORT = env.PORT_TEAM_B;
  if (!env.DATA_ENGINE_PORT && env.PORT_TEAM_C) env.DATA_ENGINE_PORT = env.PORT_TEAM_C;
  if (!env.BFF_PORT && (env.PORT_TEAM_D || env.PORT)) env.BFF_PORT = env.PORT_TEAM_D || env.PORT;

  const result = configSchema.safeParse(env);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - [${issue.path.join('.')}]: ${issue.message}`)
      .join('\n');
    console.error(`\n[FATAL CONFIG ERROR] Invalid or missing configuration:\n${errorDetails}\n`);
    throw new Error(`Invalid configuration:\n${errorDetails}`);
  }

  cachedConfig = result.data;
  return cachedConfig;
}

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    return loadConfig();
  }
  return cachedConfig;
}
