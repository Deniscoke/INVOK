import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bearer, getProfile, getUserFromToken } from '../../backend/lib/authContext';

/**
 * GET /api/auth/profile
 * Returns the caller's profile + role. The profile contains NO email (emails
 * live only in Supabase-managed auth.users).
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const user = await getUserFromToken(bearer(req.headers.authorization));
    if (!user) {
      res.status(200).json({ authenticated: false, profile: null });
      return;
    }
    const profile = await getProfile(user.userId);
    res.status(200).json({ authenticated: true, profile });
  } catch {
    res.status(200).json({ authenticated: false, profile: null });
  }
}
