/**
 * Catch-all router for /api/admin/* — consolidates 5 admin endpoints into a
 * single Vercel Function so we fit under the Hobby plan limit. URL contract
 * is unchanged; the frontend keeps calling /api/admin/schools etc.
 *
 * Dispatch table:
 *   POST   /api/admin/schools                  → createSchool
 *   POST   /api/admin/classes                  → createClass
 *   POST   /api/admin/teachers                 → addTeacherToSchool
 *   POST   /api/admin/student-codes            → generateStudentAccessCodes
 *   GET    /api/admin/student-codes?classId=…  → listStudentAccessCodes
 *   DELETE /api/admin/student-codes/[id]       → deactivateStudentAccessCode
 *   PATCH  /api/admin/student-codes/[id]       → deactivateStudentAccessCode
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveContext, isTeacherOrAdmin } from '../../backend/lib/requestContext';
import {
  createSchool,
  createClass,
  addTeacherToSchool,
  generateStudentAccessCodes,
  listStudentAccessCodes,
  deactivateStudentAccessCode,
} from '../../backend/services/pilotSetupService';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const ctx = await resolveContext(req);
  if (!isTeacherOrAdmin(ctx)) {
    res.status(403).json({ error: 'Prístup len pre učiteľov a adminov.' });
    return;
  }

  const segments = (req.query.path as string[] | undefined) ?? [];
  const root = segments[0] ?? '';
  const id = segments[1];

  try {
    if (root === 'schools' && req.method === 'POST') {
      const result = await createSchool(ctx, req.body);
      res.status(result.ok ? 200 : result.error === 'Forbidden' ? 403 : 400).json(result);
      return;
    }

    if (root === 'classes' && req.method === 'POST') {
      const result = await createClass(ctx, req.body);
      res.status(result.ok ? 200 : result.error === 'Forbidden' ? 403 : 400).json(result);
      return;
    }

    if (root === 'teachers' && req.method === 'POST') {
      const result = await addTeacherToSchool(ctx, req.body);
      res.status(result.ok ? 200 : result.error === 'Forbidden' ? 403 : 400).json(result);
      return;
    }

    if (root === 'student-codes') {
      if (id) {
        if (req.method === 'DELETE' || req.method === 'PATCH') {
          const result = await deactivateStudentAccessCode(ctx, id);
          res.status(result.ok ? 200 : result.error === 'Forbidden' ? 403 : 400).json(result);
          return;
        }
        res.setHeader('Allow', 'DELETE, PATCH');
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
      }
      if (req.method === 'POST') {
        const result = await generateStudentAccessCodes(ctx, req.body);
        res.status(result.ok ? 200 : result.error === 'Forbidden' ? 403 : 400).json(result);
        return;
      }
      if (req.method === 'GET') {
        const classId = typeof req.query.classId === 'string' ? req.query.classId : '';
        if (!classId) { res.status(400).json({ error: 'Chýba classId.' }); return; }
        res.status(200).json({ codes: await listStudentAccessCodes(ctx, classId) });
        return;
      }
      res.setHeader('Allow', 'GET, POST');
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    res.status(404).json({ error: 'Not Found' });
  } catch {
    res.status(500).json({ error: 'Interná chyba servera.' });
  }
}
