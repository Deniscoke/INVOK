import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bearer, getUserFromToken } from '../../backend/lib/authContext';

/**
 * GET /api/auth/me
 * Returns whether the caller is an authenticated Supabase user (teacher/admin).
 * Safe when Supabase is unconfigured (returns authenticated:false).
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const user = await getUserFromToken(bearer(req.headers.authorization));
    res.status(200).json({ authenticated: Boolean(user), userId: user?.userId ?? null });
  } catch {
    res.status(200).json({ authenticated: false, userId: null });
  }
}
