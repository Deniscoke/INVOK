/**
 * Catch-all router for /api/dashboard/* — consolidates 6 dashboard endpoints
 * into a single Vercel Function (Hobby plan limit). URLs are unchanged.
 *
 * Dispatch table:
 *   GET /api/dashboard/summary           → getTeacherDashboardSummary
 *   GET /api/dashboard/competencies      → getCompetencyProgressSummary
 *   GET /api/dashboard/problem-proposals → getProblemProposalSummary
 *   GET /api/dashboard/reviews           → getTeacherReviewStats
 *   GET /api/dashboard/classes           → listClassesForTeacher
 *   GET /api/dashboard/export.csv        → getDashboardCsvExport
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveContext, isTeacherOrAdmin } from '../../backend/lib/requestContext.js';
import { validateDashboardFilters } from '../../backend/validators/dashboardValidator.js';
import {
  getTeacherDashboardSummary,
  getCompetencyProgressSummary,
  getProblemProposalSummary,
  getTeacherReviewStats,
  getDashboardCsvExport,
} from '../../backend/services/dashboardService.js';
import { listClassesForTeacher } from '../../backend/services/pilotSetupService.js';

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

  const segments = (req.query.path as string[] | undefined) ?? [];
  const route = segments[0] ?? '';

  try {
    // Classes don't take dashboard filters.
    if (route === 'classes') {
      res.status(200).json({ classes: await listClassesForTeacher(ctx) });
      return;
    }

    const filters = validateDashboardFilters(req.query as Record<string, unknown>);
    if (!filters.ok) {
      res.status(400).json({ error: 'Neplatné filtre.', issues: filters.issues });
      return;
    }

    if (route === 'summary') {
      res.status(200).json(await getTeacherDashboardSummary(ctx, filters.value));
      return;
    }
    if (route === 'competencies') {
      res.status(200).json({ competencies: await getCompetencyProgressSummary(ctx, filters.value) });
      return;
    }
    if (route === 'problem-proposals') {
      res.status(200).json(await getProblemProposalSummary(ctx, filters.value));
      return;
    }
    if (route === 'reviews') {
      res.status(200).json(await getTeacherReviewStats(ctx, filters.value));
      return;
    }
    if (route === 'export.csv') {
      const csv = await getDashboardCsvExport(ctx, filters.value);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="invok-dashboard-export.csv"');
      res.status(200).send(csv);
      return;
    }

    res.status(404).json({ error: 'Not Found' });
  } catch {
    res.status(500).json({ error: 'Interná chyba servera.' });
  }
}
