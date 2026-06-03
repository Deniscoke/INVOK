import type { VercelRequest, VercelResponse } from '@vercel/node';
import { joinClass } from '../../backend/services/studentAccessService';

/**
 * POST /api/student/join  { code, pseudonym }
 * Pseudonymous class join. Returns an opaque session token + alias. NEVER
 * returns code or token hashes. Falls back to a safe mock when Supabase is
 * unconfigured (`source: 'mock'`).
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const body = (req.body ?? {}) as { code?: unknown; pseudonym?: unknown };
  const result = await joinClass({ code: String(body.code ?? ''), pseudonym: String(body.pseudonym ?? '') });
  res.status(result.ok ? 200 : 400).json(result);
}
