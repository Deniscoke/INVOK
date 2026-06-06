import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveContext, isTeacherOrAdmin } from '../../backend/lib/requestContext';
import { validateDashboardFilters } from '../../backend/validators/dashboardValidator';
import { getTeacherDashboardSummary } from '../../backend/services/dashboardService';

/** GET /api/dashboard/summary — anonymized KPI summary (teacher/admin only). */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  const ctx = await resolveContext(req);
  if (!isTeacherOrAdmin(ctx)) {
    res.status(403).json({ error: 'Prístup len pre učiteľov a adminov.' });
    return;
  }
  const filters = validateDashboardFilters(req.query as Record<string, unknown>);
  if (!filters.ok) {
    res.status(400).json({ error: 'Neplatné filtre.', issues: filters.issues });
    return;
  }
  try {
    res.status(200).json(await getTeacherDashboardSummary(ctx, filters.value));
  } catch {
    res.status(500).json({ error: 'Interná chyba servera.' });
  }
}
