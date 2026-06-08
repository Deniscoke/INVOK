/**
 * SERVER-ONLY auth context helpers.
 *
 * Verifies a Supabase access token (teacher/admin JWT) using the privileged
 * admin client, and loads the caller's profile. Returns null safely when
 * Supabase is not configured (keeps the API runnable in dev without secrets).
 *
 * Do NOT import from frontend code.
 */
import { getServerEnv, missingServerSecrets } from './env.js';

export interface ServerUser {
  userId: string;
}

export interface ServerProfile {
  id: string;
  role: 'admin' | 'teacher' | 'student';
  displayName: string;
  level: number;
  totalXp: number;
}

/** Extract a Bearer token from an Authorization header value. */
export function bearer(authHeader: string | string[] | undefined): string | undefined {
  const value = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!value) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match ? match[1] : undefined;
}

function isConfigured(): boolean {
  return missingServerSecrets(getServerEnv()).length === 0;
}

export async function getUserFromToken(token: string | undefined): Promise<ServerUser | null> {
  if (!token || !isConfigured()) return null;
  const { getSupabaseAdmin } = await import('./supabaseAdmin.js');
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id };
}

export async function getProfile(userId: string): Promise<ServerProfile | null> {
  if (!isConfigured()) return null;
  const { getSupabaseAdmin } = await import('./supabaseAdmin.js');
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('id, role, display_name, level, total_xp')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    role: row.role as ServerProfile['role'],
    displayName: String(row.display_name ?? ''),
    level: Number(row.level ?? 1),
    totalXp: Number(row.total_xp ?? 0),
  };
}
