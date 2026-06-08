/**
 * GET /api/health
 *   Lightweight liveness probe. Never returns secret values.
 *
 *   Query parameters:
 *     ?deep=1      Run import-graph checks (env, supabase-js, openai) to
 *                  pinpoint exactly where a runtime crash would start.
 *                  Each step is wrapped in try/catch so the diagnostic
 *                  itself never crashes the function.
 *     ?secrets=1   Report PRESENCE of each server secret (booleans only,
 *                  values never leave the server).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServerEnv } from '../backend/lib/env';
import { getSupabaseAdmin } from '../backend/lib/supabaseAdmin';

interface CheckResult {
  ok: boolean;
  detail?: string;
  ms?: number;
}

async function timed<T>(fn: () => Promise<T> | T): Promise<{ value?: T; ms: number; error?: unknown }> {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { value, ms: Date.now() - t0 };
  } catch (error) {
    return { ms: Date.now() - t0, error };
  }
}

function asResult(outcome: { ms: number; error?: unknown; value?: unknown }, okDetail?: string): CheckResult {
  if (outcome.error) {
    const err = outcome.error;
    return {
      ok: false,
      ms: outcome.ms,
      detail: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  }
  return {
    ok: true,
    ms: outcome.ms,
    detail: okDetail ?? (outcome.value !== undefined ? JSON.stringify(outcome.value) : 'ok'),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const deep = req.query.deep === '1' || req.query.deep === 'true';
  const reportSecrets = req.query.secrets === '1' || req.query.secrets === 'true';

  const base = {
    status: 'ok',
    service: 'invok-api',
    nodeVersion: process.version,
    appEnv: process.env.VITE_APP_ENV ?? process.env.APP_ENV ?? 'development',
    time: new Date().toISOString(),
  };

  if (reportSecrets) {
    Object.assign(base, {
      secrets: {
        VITE_SUPABASE_URL_present: Boolean(process.env.VITE_SUPABASE_URL),
        SUPABASE_SERVICE_ROLE_KEY_present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        OPENAI_API_KEY_present: Boolean(process.env.OPENAI_API_KEY),
        OPENAI_VALIDATION_PROVIDER: process.env.OPENAI_VALIDATION_PROVIDER ?? '(unset)',
        PILOT_SETUP_ENABLED: process.env.PILOT_SETUP_ENABLED ?? '(unset)',
      },
    });
  }

  if (!deep) {
    res.status(200).json(base);
    return;
  }

  // Deep mode: exercise the actual import graph so we can tell whether a
  // module-load failure is what's behind FUNCTION_INVOCATION_FAILED in the
  // larger routes (admin, dashboard, submissions, ...).
  const checks: Record<string, CheckResult> = {};

  // backend/lib/env is statically imported at the top of this file, so if
  // we got this far it bundled correctly. We still time the call to record
  // a baseline for cold-start vs warm latency.
  const envCheck = await timed(async () => {
    const env = getServerEnv();
    return {
      appEnv: env.appEnv,
      missingSupabaseUrl: !env.supabaseUrl,
      missingServiceKey: !env.supabaseServiceRoleKey,
    };
  });
  checks.localImport_backendEnv = asResult(envCheck);

  const supabaseImport = await timed(async () => {
    await import('@supabase/supabase-js');
    return 'imported';
  });
  checks.npmImport_supabaseJs = asResult(supabaseImport);

  const openaiImport = await timed(async () => {
    await import('openai');
    return 'imported';
  });
  checks.npmImport_openai = asResult(openaiImport);

  const adminCheck = await timed(async () => Boolean(getSupabaseAdmin()));
  // This one can legitimately fail when env vars are missing — that's
  // information, not a deployment bug.
  checks.supabaseAdmin_construct = asResult(adminCheck);

  res.status(200).json({
    ...base,
    deep: true,
    overallOk: Object.values(checks).every((c) => c.ok),
    checks,
  });
}
