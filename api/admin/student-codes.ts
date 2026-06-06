import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveContext, isTeacherOrAdmin } from '../../backend/lib/requestContext';
import { generateStudentAccessCodes, listStudentAccessCodes } from '../../backend/services/pilotSetupService';

/**
 * POST /api/admin/student-codes — generate pseudonymous codes (plaintext shown ONCE).
 * GET  /api/admin/student-codes?classId=… — list codes WITHOUT plaintext or hash.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const ctx = await resolveContext(req);
  if (!isTeacherOrAdmin(ctx)) {
    res.status(403).json({ error: 'Prístup len pre učiteľov a adminov.' });
    return;
  }

  if (req.method === 'POST') {
    try {
      const result = await generateStudentAccessCodes(ctx, req.body);
      res.status(result.ok ? 200 : result.error === 'Forbidden' ? 403 : 400).json(result);
    } catch {
      res.status(500).json({ error: 'Interná chyba servera.' });
    }
    return;
  }

  if (req.method === 'GET') {
    const classId = typeof req.query.classId === 'string' ? req.query.classId : '';
    if (!classId) {
      res.status(400).json({ error: 'Chýba classId.' });
      return;
    }
    const codes = await listStudentAccessCodes(ctx, classId);
    res.status(200).json({ codes });
    return;
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: 'Method Not Allowed' });
}
