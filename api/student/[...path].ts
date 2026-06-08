/**
 * Catch-all router for /api/student/* — consolidates 2 endpoints.
 *
 * Dispatch table:
 *   POST /api/student/join     → joinClass (pseudonymous student login)
 *   POST /api/student/session  → verifyStudentSession
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { joinClass, verifyStudentSession } from '../../backend/services/studentAccessService.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const segments = (req.query.path as string[] | undefined) ?? [];
  const route = segments[0] ?? '';
  const body = (req.body ?? {}) as Record<string, unknown>;

  if (route === 'join') {
    const result = await joinClass({
      code: String(body.code ?? ''),
      pseudonym: typeof body.pseudonym === 'string' ? body.pseudonym : undefined,
    });
    res.status(result.ok ? 200 : 400).json(result);
    return;
  }

  if (route === 'session') {
    const result = await verifyStudentSession(body.sessionToken);
    res.status(result.valid ? 200 : 401).json(result);
    return;
  }

  res.status(404).json({ error: 'Not Found' });
}
