import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveContext, isTeacherOrAdmin } from '../../backend/lib/requestContext';
import { createClass } from '../../backend/services/pilotSetupService';

/** POST /api/admin/classes — create a class in a school (teacher/admin). */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  const ctx = await resolveContext(req);
  if (!isTeacherOrAdmin(ctx)) {
    res.status(403).json({ error: 'Prístup len pre učiteľov a adminov.' });
    return;
  }
  try {
    const result = await createClass(ctx, req.body);
    res.status(result.ok ? 200 : result.error === 'Forbidden' ? 403 : 400).json(result);
  } catch {
    res.status(500).json({ error: 'Interná chyba servera.' });
  }
}
