import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveContext, requireAuth } from '../../backend/lib/requestContext';
import { getOwnSubmissions } from '../../backend/services/submissionService';

/**
 * GET /api/submissions/me
 * Returns the caller's own submissions with AI evaluations.
 * Never returns other users' data.
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
    const submissions = await getOwnSubmissions(ctx);
    res.status(200).json({ submissions });
  } catch {
    res.status(500).json({ error: 'Interná chyba servera.' });
  }
}
