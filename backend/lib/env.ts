/**
 * Server-only environment access.
 *
 * Do NOT import this module from any file under `frontend/`. Reading
 * server secrets here keeps them out of the browser bundle. Vite only
 * exposes `VITE_`-prefixed variables to the client; everything read here
 * (service role key, OpenAI key) must stay on the server.
 */

export type AIValidationProvider = 'mock' | 'openai';

export interface ServerEnv {
  appEnv: string;
  supabaseUrl: string | undefined;
  supabaseServiceRoleKey: string | undefined;
  openaiApiKey: string | undefined;
  openaiValidationModel: string;
  openaiValidationProvider: AIValidationProvider;
  openaiValidationTimeoutMs: number;
  openaiValidationLogRawPrompts: boolean;
  maxUploadMb: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  // AI rate / cost guard (MVP, in-memory). Conservative defaults.
  aiRateLimitWindowMs: number;
  aiRateLimitMaxPerStudent: number;
  aiRateLimitMaxPerTeacher: number;
  aiDailyMaxPerStudent: number;
  aiDailyMaxPerClass: number;
  aiMaxEvidenceChars: number;
  aiMinEvidenceChars: number;
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
    openaiApiKey: env.OPENAI_API_KEY,
    openaiValidationModel: env.OPENAI_VALIDATION_MODEL ?? 'gpt-5.5',
    openaiValidationProvider: env.OPENAI_VALIDATION_PROVIDER === 'openai' ? 'openai' : 'mock',
    openaiValidationTimeoutMs: positiveInt(env.OPENAI_VALIDATION_TIMEOUT_MS, 15_000),
    openaiValidationLogRawPrompts: env.OPENAI_VALIDATION_LOG_RAW_PROMPTS === 'true',
    maxUploadMb: positiveInt(env.MAX_UPLOAD_MB, 8),
    rateLimitWindowMs: positiveInt(env.RATE_LIMIT_WINDOW_MS, 60_000),
    rateLimitMax: positiveInt(env.RATE_LIMIT_MAX, 30),
    aiRateLimitWindowMs: positiveInt(env.AI_RATE_LIMIT_WINDOW_MS, 60_000),
    aiRateLimitMaxPerStudent: positiveInt(env.AI_RATE_LIMIT_MAX_PER_STUDENT, 5),
    aiRateLimitMaxPerTeacher: positiveInt(env.AI_RATE_LIMIT_MAX_PER_TEACHER, 20),
    aiDailyMaxPerStudent: positiveInt(env.AI_DAILY_MAX_PER_STUDENT, 30),
    aiDailyMaxPerClass: positiveInt(env.AI_DAILY_MAX_PER_CLASS, 300),
    aiMaxEvidenceChars: positiveInt(env.AI_MAX_EVIDENCE_CHARS, 5_000),
    aiMinEvidenceChars: positiveInt(env.AI_MIN_EVIDENCE_CHARS, 20),
  };
}

/**
 * Whether the real OpenAI provider should be used. Requires BOTH the provider
 * switch and a configured API key — otherwise we stay on mock.
 */
export function shouldUseOpenAI(env: ServerEnv): boolean {
  return env.openaiValidationProvider === 'openai' && Boolean(env.openaiApiKey) && Boolean(env.openaiValidationModel);
}

/** Returns the names of required server secrets that are missing. */
export function missingServerSecrets(env: ServerEnv): string[] {
  const missing: string[] = [];
  if (!env.supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!env.supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  return missing;
}
