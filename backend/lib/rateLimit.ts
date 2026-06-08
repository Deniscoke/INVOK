/**
 * SERVER-ONLY in-memory rate limiter + AI cost-guard helpers (MVP).
 *
 * ⚠️  This is a per-instance, in-memory limiter. On Vercel Fluid Compute it
 *     survives between requests on the SAME warm instance, but is NOT shared
 *     across instances/regions. It is a basic protection against spamming and
 *     runaway OpenAI cost — NOT a strong global limiter. For production use a
 *     shared store (Redis/Upstash or a Supabase-backed limiter).
 *
 * Do NOT import from frontend code.
 */
import type { RequestContext } from './requestContext.js';
import { getServerEnv } from './env.js';
import { sha256Hex } from './hash.js';

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; retryAfterMs: number; resetAt: number };

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fixed-window check. Increments the bucket for `key` and reports the result. */
export function checkRateLimit(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: Math.max(0, maxRequests - 1), resetAt };
  }

  if (bucket.count >= maxRequests) {
    return { allowed: false, retryAfterMs: Math.max(0, bucket.resetAt - now), resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: true, remaining: Math.max(0, maxRequests - bucket.count), resetAt: bucket.resetAt };
}

/** Clear all buckets (used by tests). */
export function resetRateLimits(): void {
  buckets.clear();
}

export type RateTier = 'student' | 'teacher' | 'anonymous';

/** Derive a rate-limit identity from the request context (no plaintext PII). */
export function rateLimitIdentity(ctx: RequestContext, ipHash?: string): { key: string; tier: RateTier } {
  if (ctx.mode === 'student_session') {
    return { key: `ai:student:${ctx.studentAccessCodeId}`, tier: 'student' };
  }
  if (ctx.mode === 'supabase_user') {
    const tier: RateTier = ctx.role === 'student' ? 'student' : 'teacher';
    return { key: `ai:user:${ctx.userId}`, tier };
  }
  return { key: ipHash ? `ai:anonymous:${ipHash}` : 'ai:anonymous', tier: 'anonymous' };
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterMs: number;
}

/**
 * Enforce per-window + rolling-daily AI limits for a request context.
 * Applies regardless of provider (mock and openai behave the same).
 */
export function enforceAiRateLimit(ctx: RequestContext, ipHash?: string): RateLimitDecision {
  const env = getServerEnv();
  const { key, tier } = rateLimitIdentity(ctx, ipHash);

  const perWindowMax = tier === 'teacher' ? env.aiRateLimitMaxPerTeacher : env.aiRateLimitMaxPerStudent;
  const windowed = checkRateLimit(`win:${key}`, perWindowMax, env.aiRateLimitWindowMs);
  if (!windowed.allowed) return { allowed: false, retryAfterMs: windowed.retryAfterMs };

  // Daily caps apply to students (per student + per class).
  if (tier === 'student') {
    const daily = checkRateLimit(`day:${key}`, env.aiDailyMaxPerStudent, DAY_MS);
    if (!daily.allowed) return { allowed: false, retryAfterMs: daily.retryAfterMs };

    if (ctx.mode === 'student_session') {
      const classDaily = checkRateLimit(`day:class:${ctx.classId}`, env.aiDailyMaxPerClass, DAY_MS);
      if (!classDaily.allowed) return { allowed: false, retryAfterMs: classDaily.retryAfterMs };
    }
  }

  return { allowed: true, retryAfterMs: 0 };
}

/** Hash a client IP (from x-forwarded-for) — never store/log plaintext IPs. */
export function ipHashFromHeader(forwardedFor: string | string[] | undefined): string | undefined {
  const value = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  if (!value) return undefined;
  const firstIp = value.split(',')[0]?.trim();
  if (!firstIp) return undefined;
  return sha256Hex(firstIp).slice(0, 16);
}

// Opportunistic background cleanup of expired buckets. Skipped under test to
// avoid open handles; `.unref()` ensures it never keeps the process alive.
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, 5 * 60 * 1000);
  timer.unref?.();
}
