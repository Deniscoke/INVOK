import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveContext, isTeacherOrAdmin } from '../../../backend/lib/requestContext';
import { deactivateStudentAccessCode } from '../../../backend/services/pilotSetupService';

/** DELETE|PATCH /api/admin/student-codes/[id] — deactivate a student code. */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'DELETE' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'DELETE, PATCH');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  const ctx = await resolveContext(req);
  if (!isTeacherOrAdmin(ctx)) {
    res.status(403).json({ error: 'Prístup len pre učiteľov a adminov.' });
    return;
  }
  const id = req.query.id;
  if (typeof id !== 'string' || id.trim().length === 0) {
    res.status(400).json({ error: 'Chýba id.' });
    return;
  }
  try {
    const result = await deactivateStudentAccessCode(ctx, id.trim());
    res.status(result.ok ? 200 : result.error === 'Forbidden' ? 403 : 400).json(result);
  } catch {
    res.status(500).json({ error: 'Interná chyba servera.' });
  }
}
