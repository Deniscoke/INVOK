import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveContext, requireAuth } from '../../backend/lib/requestContext.js';
import { getStudentProgress } from '../../backend/services/submissionService.js';

/**
 * GET /api/progress/me
 * Returns the caller's XP, level, and per-competency progress.
 * Falls back to mock data when Supabase is not configured.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const ctx = await resolveContext(req);
  if (!requireAuth(ctx)) {
    res.status(401).json({ error: 'Nie si prihlásený.' });
    return;
  }

  try {
    const progress = await getStudentProgress(ctx);
    res.status(200).json(progress);
  } catch {
    res.status(500).json({ error: 'Interná chyba servera.' });
  }
}
