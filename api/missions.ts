import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getMissions } from '../backend/services/missionService';

/** GET /api/missions – returns the mission catalog. */
export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  res.status(200).json({ missions: getMissions() });
}
