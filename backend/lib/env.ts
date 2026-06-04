/**
 * Server-only environment access.
 *
 * Do NOT import this module from any file under `frontend/`. Reading
 * server secrets here keeps them out of the browser bundle. Vite only
 * exposes `VITE_`-prefixed variables to the client; everything read here
 * (service role key, Anthropic key) must stay on the server.
 */

export type AIValidationProvider = 'mock' | 'anthropic';

export interface ServerEnv {
  appEnv: string;
  supabaseUrl: string | undefined;
  supabaseServiceRoleKey: string | undefined;
  anthropicApiKey: string | undefined;
  aiValidationModel: string;
  aiValidationProvider: AIValidationProvider;
  aiValidationTimeoutMs: number;
  aiValidationLogRawPrompts: boolean;
  maxUploadMb: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function getServerEnv(): ServerEnv {
  const env = process.env;
  return {
    appEnv: env.VITE_APP_ENV ?? 'development',
    supabaseUrl: env.VITE_SUPABASE_URL,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    aiValidationModel: env.AI_VALIDATION_MODEL ?? 'claude-sonnet-4-5',
    aiValidationProvider: env.AI_VALIDATION_PROVIDER === 'anthropic' ? 'anthropic' : 'mock',
    aiValidationTimeoutMs: positiveInt(env.AI_VALIDATION_TIMEOUT_MS, 15_000),
    aiValidationLogRawPrompts: env.AI_VALIDATION_LOG_RAW_PROMPTS === 'true',
    maxUploadMb: positiveInt(env.MAX_UPLOAD_MB, 8),
    rateLimitWindowMs: positiveInt(env.RATE_LIMIT_WINDOW_MS, 60_000),
    rateLimitMax: positiveInt(env.RATE_LIMIT_MAX, 30),
  };
}

/**
 * Whether the real Anthropic provider should be used. Requires BOTH the
 * provider switch and a configured API key — otherwise we stay on mock.
 */
export function shouldUseAnthropic(env: ServerEnv): boolean {
  return env.aiValidationProvider === 'anthropic' && Boolean(env.anthropicApiKey) && Boolean(env.aiValidationModel);
}

/** Returns the names of required server secrets that are missing. */
export function missingServerSecrets(env: ServerEnv): string[] {
  const missing: string[] = [];
  if (!env.supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!env.supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  return missing;
}
