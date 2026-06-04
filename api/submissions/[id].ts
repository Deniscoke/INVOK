import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveContext, requireAuth } from '../../backend/lib/requestContext';
import { getSubmissionById } from '../../backend/services/submissionService';
import { getTeacherReviewForSubmission } from '../../backend/services/teacherReviewService';

/**
 * GET /api/submissions/[id]
 * Returns a single submission by ID. The caller can only see:
 *  - their own submission (student)
 *  - submissions in their classes (teacher/admin)
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
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

  const id = req.query.id;
  if (typeof id !== 'string' || id.trim().length === 0) {
    res.status(400).json({ error: 'Chýba ID odovzdania.' });
    return;
  }

  try {
    const submission = await getSubmissionById(ctx, id.trim());
    if (!submission) {
      res.status(404).json({ error: 'Odovzdanie nenájdené alebo nemáš prístup.' });
      return;
    }
    // Include the teacher review (final feedback) if one exists and is in scope.
    const review = await getTeacherReviewForSubmission(ctx, id.trim());
    res.status(200).json({ submission, review });
  } catch {
    res.status(500).json({ error: 'Interná chyba servera.' });
  }
}
