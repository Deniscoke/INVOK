/**
 * SERVER-ONLY Supabase client.
 *
 * ⚠️  This module uses `SUPABASE_SERVICE_ROLE_KEY`, which BYPASSES Row Level
 *     Security. NEVER import it from any file under `frontend/` — doing so
 *     would leak privileged credentials into the browser bundle.
 *
 * The browser must use the anon key + RLS via a separate (future) client.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv, missingServerSecrets } from './env';

let cached: SupabaseClient | null = null;

/**
 * Lazily create (and cache) the privileged Supabase client. Throws a clear
 * error if the required server secrets are not configured, so callers fail
 * fast instead of silently running without a database.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const env = getServerEnv();
  const missing = missingServerSecrets(env);
  if (missing.length > 0) {
    throw new Error(
      `Supabase admin client unavailable. Missing server env: ${missing.join(', ')}.`,
    );
  }

  cached = createClient(env.supabaseUrl as string, env.supabaseServiceRoleKey as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
