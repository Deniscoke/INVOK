import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateSubmissionInput } from '../../backend/validators/submissionValidator';
import { validateSubmission } from '../../backend/services/aiValidationService';
import { getMissionById } from '../../backend/services/missionService';

/**
 * POST /api/ai/validate-submission
 *
 * Runs FORMATIVE (not final) validation. Validates input first, then returns a
 * structured, explainable result. AI never replaces the teacher's judgement.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const parsed = validateSubmissionInput(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: 'Invalid submission', issues: parsed.issues });
    return;
  }

  try {
    const mission = getMissionById(parsed.value.missionId);
    const evaluation = await validateSubmission(parsed.value, {
      rubric: mission?.rubric,
      targetCompetencies: mission?.targetCompetencies,
    });
    res.status(200).json(evaluation);
  } catch {
    // Never leak internals (stack traces, secrets) to the client.
    res.status(500).json({ error: 'Validation failed', suggestedTeacherReview: true });
  }
}
