import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServerEnv } from '../backend/lib/env';

/** GET /api/health – lightweight liveness probe. Never returns secrets. */
export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const env = getServerEnv();
  res.status(200).json({
    status: 'ok',
    service: 'invok-api',
    env: env.appEnv,
    time: new Date().toISOString(),
  });
}
