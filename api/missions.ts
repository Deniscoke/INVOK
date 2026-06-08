import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getMissions } from '../backend/services/missionService.js';
import { getServerEnv, missingServerSecrets } from '../backend/lib/env.js';

/**
 * GET /api/missions
 * Returns published missions. When Supabase is configured, the future DB path
 * will be used; for now the JSON catalog is the source of truth.
 * Does not return teacher-only fields or sensitive internal data.
 */
export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const source = missingServerSecrets(getServerEnv()).length === 0 ? 'catalog' : 'mock';
  const missions = getMissions().map(({ id, title, story, goal, evidenceRequired, targetCompetencies, rubric, baseXp, difficulty, suggestedMode }) => ({
    id, title, story, goal, evidenceRequired, targetCompetencies, rubric, baseXp, difficulty, suggestedMode,
  }));

  res.status(200).json({ missions, source });
}
