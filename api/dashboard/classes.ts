import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveContext, isTeacherOrAdmin } from '../../backend/lib/requestContext';
import { listClassesForTeacher } from '../../backend/services/pilotSetupService';

/** GET /api/dashboard/classes — real classes for the current teacher/admin. */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  const ctx = await resolveContext(req);
  if (!isTeacherOrAdmin(ctx)) {
    res.status(403).json({ error: 'Prístup len pre učiteľov a adminov.' });
    return;
  }
  try {
    res.status(200).json({ classes: await listClassesForTeacher(ctx) });
  } catch {
    res.status(500).json({ error: 'Interná chyba servera.' });
  }
}
