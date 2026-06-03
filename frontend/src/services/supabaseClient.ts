/**
 * Frontend-safe Supabase client.
 *
 * Uses ONLY the public anon credentials (`VITE_SUPABASE_URL`,
 * `VITE_SUPABASE_ANON_KEY`). It must NEVER reference the service role key —
 * that is server-only. When the env is not configured the client is `null` and
 * the app runs in demo mode (see authService).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured: boolean = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
