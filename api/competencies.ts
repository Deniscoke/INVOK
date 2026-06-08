import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCompetencies } from '../backend/services/missionService.js';

/** GET /api/competencies – returns the competency catalog (child + teacher view). */
export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  res.status(200).json({ competencies: getCompetencies() });
}
