import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateSubmissionInput } from '../../backend/validators/submissionValidator';
import { validateSubmission } from '../../backend/services/aiValidationService';
import { getMissionById } from '../../backend/services/missionService';
import { resolveContext, requireAuth } from '../../backend/lib/requestContext';
import { getServerEnv, missingServerSecrets } from '../../backend/lib/env';

/**
 * POST /api/ai/validate-submission
 *
 * Two modes:
 *   1. Inline: { missionId, studentResponse, evidenceText, evidenceType }
 *      → validate in-memory, return result (no DB write).
 *   2. By ID: { submissionId }
 *      → load submission from DB, run mock AI validation, write to ai_evaluations.
 *
 * AI is FORMATIVE — never a final grader. Teacher stays the guarantor.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;

  // Mode 2: validate an existing submission by ID
  if (body.submissionId) {
    const ctx = await resolveContext(req);
    if (!requireAuth(ctx)) {
      res.status(401).json({ error: 'Nie si prihlásený.' });
      return;
    }
    if (typeof body.submissionId !== 'string') {
      res.status(400).json({ error: 'submissionId musí byť reťazec.' });
      return;
    }
    if (missingServerSecrets(getServerEnv()).length > 0) {
      res.status(200).json({ info: 'Supabase nie je nakonfigurované — použite inline mode.', suggestedTeacherReview: true });
      return;
    }
    try {
      const { getSupabaseAdmin } = await import('../../backend/lib/supabaseAdmin');
      const admin = getSupabaseAdmin();
      const { data: sub } = await admin
        .from('submissions')
        .select('id, mission_id, response_text, evidence_text, evidence_type')
        .eq('id', body.submissionId)
        .maybeSingle();
      if (!sub) { res.status(404).json({ error: 'Odovzdanie nenájdené.' }); return; }
      const row = sub as Record<string, unknown>;
      const mission = getMissionById(String(row.mission_id));
      const evaluation = await validateSubmission(
        { missionId: String(row.mission_id), studentResponse: String(row.response_text), evidenceText: String(row.evidence_text ?? ''), evidenceType: 'text' },
        { rubric: mission?.rubric, targetCompetencies: mission?.targetCompetencies },
      );
      await admin.from('ai_evaluations').upsert({
        submission_id: String(row.id),
        valid: evaluation.valid, score: evaluation.score, confidence: evaluation.confidence,
        reasons: evaluation.reasons, detected_competencies: evaluation.detectedCompetencies,
        suggested_teacher_review: evaluation.suggestedTeacherReview, model: evaluation.model,
      }, { onConflict: 'submission_id' });
      await admin.from('submissions').update({ status: 'ai_reviewed' }).eq('id', String(row.id));
      res.status(200).json(evaluation);
    } catch {
      res.status(500).json({ error: 'Validácia zlyhala.', suggestedTeacherReview: true });
    }
    return;
  }

  // Mode 1: inline validation (no DB write)
  const parsed = validateSubmissionInput(body);
  if (!parsed.ok) {
    res.status(400).json({ error: 'Neplatné vstupy.', issues: parsed.issues });
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
    res.status(500).json({ error: 'Validácia zlyhala.', suggestedTeacherReview: true });
  }
}
