/**
 * Catch-all router for /api/teacher/* — consolidates 3 teacher endpoints.
 *
 * Dispatch table:
 *   POST /api/teacher/reviews                     → createTeacherReview
 *   GET  /api/teacher/reviews?decision=…          → listTeacherReviews
 *   GET  /api/teacher/reviews/[submissionId]      → getTeacherReviewForSubmission
 *   GET  /api/teacher/submissions                 → getTeacherSubmissions
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveContext, isTeacherOrAdmin, requireAuth } from '../../backend/lib/requestContext';
import {
  createTeacherReview,
  listTeacherReviews,
  getTeacherReviewForSubmission,
} from '../../backend/services/teacherReviewService';
import { REVIEW_DECISIONS, type ReviewDecision } from '../../backend/validators/teacherReviewValidator';
import { getTeacherSubmissions } from '../../backend/services/submissionService';
import { validateQueryFilter } from '../../backend/validators/submissionValidator';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const segments = (req.query.path as string[] | undefined) ?? [];
  const root = segments[0] ?? '';

  // /api/teacher/submissions
  if (root === 'submissions') {
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
    const filter = validateQueryFilter(req.query as Record<string, unknown>);
    if (!filter.ok) {
      res.status(400).json({ error: 'Neplatné filtre.', issues: filter.issues });
      return;
    }
    try {
      res.status(200).json({ submissions: await getTeacherSubmissions(ctx, filter.value) });
    } catch {
      res.status(500).json({ error: 'Interná chyba servera.' });
    }
    return;
  }

  // /api/teacher/reviews and /api/teacher/reviews/[submissionId]
  if (root === 'reviews') {
    const submissionId = segments[1];

    // GET /api/teacher/reviews/[submissionId]
    if (submissionId) {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
      }
      const ctx = await resolveContext(req);
      if (!requireAuth(ctx)) {
        res.status(401).json({ error: 'Nie si prihlásený.' });
        return;
      }
      try {
        const review = await getTeacherReviewForSubmission(ctx, submissionId.trim());
        res.status(200).json({ review });
      } catch {
        res.status(500).json({ error: 'Interná chyba servera.' });
      }
      return;
    }

    // POST or GET /api/teacher/reviews (teacher/admin only)
    const ctx = await resolveContext(req);
    if (!isTeacherOrAdmin(ctx)) {
      res.status(403).json({ error: 'Prístup len pre učiteľov a adminov.' });
      return;
    }
    if (req.method === 'POST') {
      try {
        const result = await createTeacherReview(ctx, req.body);
        res.status(result.ok ? 200 : 400).json(result);
      } catch {
        res.status(500).json({ error: 'Interná chyba servera.' });
      }
      return;
    }
    if (req.method === 'GET') {
      const raw = typeof req.query.decision === 'string' ? req.query.decision : undefined;
      const decision = (REVIEW_DECISIONS as readonly string[]).includes(raw ?? '') ? (raw as ReviewDecision) : undefined;
      const reviews = await listTeacherReviews(ctx, { decision });
      res.status(200).json({ reviews });
      return;
    }
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  res.status(404).json({ error: 'Not Found' });
}
