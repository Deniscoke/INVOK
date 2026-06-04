import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveContext, requireAuth } from '../../../backend/lib/requestContext';
import { getTeacherReviewForSubmission } from '../../../backend/services/teacherReviewService';

/**
 * GET /api/teacher/reviews/[submissionId]
 * Returns the latest teacher review for a submission. Access is scoped:
 * class manager or the submission owner only (enforced in the service).
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

  const submissionId = req.query.submissionId;
  if (typeof submissionId !== 'string' || submissionId.trim().length === 0) {
    res.status(400).json({ error: 'Chýba submissionId.' });
    return;
  }

  try {
    const review = await getTeacherReviewForSubmission(ctx, submissionId.trim());
    res.status(200).json({ review });
  } catch {
    res.status(500).json({ error: 'Interná chyba servera.' });
  }
}
