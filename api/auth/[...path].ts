/**
 * Catch-all router for /api/auth/* — consolidates 2 endpoints.
 *
 * Dispatch table:
 *   GET /api/auth/me       → authenticated user check (Bearer JWT)
 *   GET /api/auth/profile  → caller's profile + role (no email exposed)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bearer, getUserFromToken, getProfile } from '../../backend/lib/authContext';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const segments = (req.query.path as string[] | undefined) ?? [];
  const route = segments[0] ?? '';

  try {
    const user = await getUserFromToken(bearer(req.headers.authorization));

    if (route === 'me') {
      res.status(200).json({ authenticated: Boolean(user), userId: user?.userId ?? null });
      return;
    }

    if (route === 'profile') {
      if (!user) {
        res.status(200).json({ authenticated: false, profile: null });
        return;
      }
      const profile = await getProfile(user.userId);
      res.status(200).json({ authenticated: true, profile });
      return;
    }

    res.status(404).json({ error: 'Not Found' });
  } catch {
    res.status(200).json({ authenticated: false });
  }
}
