import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveContext, requireAuth } from '../../backend/lib/requestContext';
import { validateSubmissionInput } from '../../backend/validators/submissionValidator';
import { createSubmission } from '../../backend/services/submissionService';

/**
 * POST /api/submissions
 * Creates a submission, runs mock AI validation, stores the evaluation,
 * updates progress. Works for both teacher/admin (Supabase JWT) and
 * pseudonymous students (X-Student-Token).
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const ctx = await resolveContext(req);
  if (!requireAuth(ctx)) {
    res.status(401).json({ error: 'Nie si prihlásený.' });
    return;
  }

  const parsed = validateSubmissionInput(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: 'Neplatné vstupy.', issues: parsed.issues });
    return;
  }

  try {
    const result = await createSubmission(ctx, parsed.value);
    res.status(result.ok ? 200 : 400).json(result);
  } catch {
    res.status(500).json({ error: 'Interná chyba servera.', suggestedTeacherReview: true });
  }
}
