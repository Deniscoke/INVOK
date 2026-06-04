import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveContext, isTeacherOrAdmin } from '../../backend/lib/requestContext';
import { createTeacherReview, listTeacherReviews } from '../../backend/services/teacherReviewService';
import { REVIEW_DECISIONS, type ReviewDecision } from '../../backend/validators/teacherReviewValidator';

/**
 * POST /api/teacher/reviews  – create a teacher review (teacher/admin only).
 * GET  /api/teacher/reviews  – list the reviewer's own reviews (optional ?decision=).
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
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
}
