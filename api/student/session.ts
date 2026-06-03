import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyStudentSession } from '../../backend/services/studentAccessService';

/**
 * POST /api/student/session  { sessionToken }
 * Verifies / refreshes a pseudonymous student session. Returns only public
 * session info (alias, classId) — never any hash.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const body = (req.body ?? {}) as { sessionToken?: unknown };
  const result = await verifyStudentSession(body.sessionToken);
  res.status(result.valid ? 200 : 401).json(result);
}
