import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveContext, isTeacherOrAdmin } from '../../backend/lib/requestContext';
import { validateDashboardFilters } from '../../backend/validators/dashboardValidator';
import { getDashboardCsvExport } from '../../backend/services/dashboardService';

/**
 * GET /api/dashboard/export.csv — anonymized, aggregate-only CSV export.
 * Contains NO names/emails/codes/tokens/hashes — only class UUIDs, slugs and
 * numeric aggregates. Teacher/admin only, scoped to their classes/school.
 */
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
    const csv = await getDashboardCsvExport(ctx, filters.value);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="invok-dashboard-export.csv"');
    res.status(200).send(csv);
  } catch {
    res.status(500).json({ error: 'Interná chyba servera.' });
  }
}
