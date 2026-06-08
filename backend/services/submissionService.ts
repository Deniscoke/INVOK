/**
 * Submission service (SERVER-ONLY).
 *
 * Handles the core workflow:
 *   validate input → store submission → run mock AI validation
 *   → store ai_evaluation → update user_progress
 *
 * Works with two identity types:
 *   - supabase_user (teacher/admin/student via auth): student_id = profiles.id
 *   - student_session (pseudonymous): student_access_code_id, student_id = null
 *
 * All writes bypass RLS via the service role. Reads respect RLS when possible.
 * When Supabase is not configured the service returns safe mock data.
 *
 * Do NOT import from frontend code.
 */
import type { RequestContext } from '../lib/requestContext';
import type { SubmissionInput, SubmissionQueryFilter, SubmissionKind } from '../validators/submissionValidator';
import { validateSubmissionWithAI, type AIValidationResult } from './aiValidationService';
import { scoreProblemProposal } from './problemProposalService';
import { getMissionById } from './missionService';
import { levelForXp } from './progressService';
import { getServerEnv, missingServerSecrets } from '../lib/env';

export interface SubmissionRow {
  id: string;
  missionId: string;
  pseudonym: string | null;
  studentId: string | null;
  studentAccessCodeId: string | null;
  classId: string | null;
  responseText: string;
  evidenceText: string;
  evidenceType: string;
  status: string;
  xpAwarded: number;
  createdAt: string;
}

export interface SubmissionWithEvaluation extends SubmissionRow {
  evaluation: {
    valid: boolean;
    score: number;
    confidence: number;
    reasons: { criterion: string; result: string; explanation: string }[];
    detectedCompetencies: { id: string; strength: number }[];
    suggestedTeacherReview: boolean;
    model: string;
  } | null;
}

export type CreateResult =
  | {
      ok: true;
      submissionId: string;
      xpAwarded: number;
      kind: SubmissionKind;
      provisional: boolean;
      evaluation: SubmissionWithEvaluation['evaluation'];
    }
  | { ok: false; error: string };

function isConfigured(): boolean {
  return missingServerSecrets(getServerEnv()).length === 0;
}

/**
 * Evaluate a submission by kind. A `problem_proposal` is scored against the
 * problem rubric and earns a provisional reward (10–40%); other kinds use the
 * mission rubric and full XP. XP is provisional until a teacher review.
 */
async function evaluateSubmission(
  input: SubmissionInput,
): Promise<{ evaluation: AIValidationResult; xpAwarded: number; isProposal: boolean }> {
  if (input.submissionKind === 'problem_proposal') {
    const scored = await scoreProblemProposal(input);
    return { evaluation: scored.evaluation, xpAwarded: scored.provisionalXp, isProposal: true };
  }
  const mission = getMissionById(input.missionId);
  const evaluation = await validateSubmissionWithAI(
    { ...input, studentResponse: input.evidenceText || input.studentResponse },
    { rubric: mission?.rubric, targetCompetencies: mission?.targetCompetencies },
  );
  const xpAwarded = evaluation.valid ? Math.round((mission?.baseXp ?? 80) * (evaluation.score / 100)) : 0;
  return { evaluation, xpAwarded, isProposal: false };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createSubmission(
  ctx: RequestContext,
  input: SubmissionInput,
): Promise<CreateResult> {
  if (ctx.mode === 'anonymous') return { ok: false, error: 'Nie si prihlásený.' };
  return isConfigured() ? dbCreate(ctx, input) : mockCreate(ctx, input);
}

export async function getOwnSubmissions(ctx: RequestContext): Promise<SubmissionWithEvaluation[]> {
  if (ctx.mode === 'anonymous') return [];
  return isConfigured() ? dbGetOwn(ctx) : mockSubmissions(ctx);
}

export async function getSubmissionById(
  ctx: RequestContext,
  submissionId: string,
): Promise<SubmissionWithEvaluation | null> {
  if (ctx.mode === 'anonymous') return null;
  return isConfigured() ? dbGetById(ctx, submissionId) : null;
}

export async function getTeacherSubmissions(
  ctx: RequestContext,
  filters: SubmissionQueryFilter,
): Promise<SubmissionWithEvaluation[]> {
  if (ctx.mode !== 'supabase_user' || (ctx.role !== 'teacher' && ctx.role !== 'admin')) return [];
  return isConfigured() ? dbGetTeacherList(ctx, filters) : mockTeacherSubmissions();
}

export async function getStudentProgress(ctx: RequestContext): Promise<{
  totalXp: number;
  level: number;
  competencyProgress: { competencyId: string; xp: number; level: number; mastery: number }[];
}> {
  if (ctx.mode === 'anonymous') return { totalXp: 0, level: 1, competencyProgress: [] };
  if (isConfigured()) return dbGetProgress(ctx);
  return {
    totalXp: 480,
    level: levelForXp(480),
    competencyProgress: [
      { competencyId: 'fact_detective', xp: 160, level: levelForXp(160), mastery: 0.48 },
      { competencyId: 'maker_venture', xp: 120, level: levelForXp(120), mastery: 0.38 },
      { competencyId: 'self_captain', xp: 80, level: levelForXp(80), mastery: 0.30 },
    ],
  };
}

// ---------------------------------------------------------------------------
// Mock paths
// ---------------------------------------------------------------------------

async function mockCreate(_ctx: RequestContext, input: SubmissionInput): Promise<CreateResult> {
  const { evaluation, xpAwarded, isProposal } = await evaluateSubmission(input);
  return {
    ok: true,
    submissionId: `mock-${Date.now()}`,
    xpAwarded,
    kind: input.submissionKind ?? 'solution_submission',
    provisional: isProposal,
    evaluation: {
      valid: evaluation.valid,
      score: evaluation.score,
      confidence: evaluation.confidence,
      reasons: evaluation.reasons,
      detectedCompetencies: evaluation.detectedCompetencies.map((d) => ({ id: d.id, strength: d.strength })),
      suggestedTeacherReview: evaluation.suggestedTeacherReview,
      model: evaluation.model,
    },
  };
}

function mockSubmissions(ctx: RequestContext): SubmissionWithEvaluation[] {
  const pseudonym = ctx.mode === 'student_session' ? ctx.pseudonym : null;
  return [
    {
      id: 'mock-sub-1',
      missionId: 'map_school_problem',
      pseudonym,
      studentId: null,
      studentAccessCodeId: null,
      classId: null,
      responseText: 'Zmapoval som problém s chaosom v jedálni...',
      evidenceText: 'Pozoroval som 3 dni.',
      evidenceType: 'text',
      status: 'ai_reviewed',
      xpAwarded: 65,
      createdAt: new Date().toISOString(),
      evaluation: {
        valid: true,
        score: 81,
        confidence: 0.74,
        reasons: [{ criterion: 'Jasnosť', result: 'met', explanation: 'Problém je jasne pomenovaný.' }],
        detectedCompetencies: [{ id: 'fact_detective', strength: 0.6 }],
        suggestedTeacherReview: false,
        model: 'mock-formative-validator-v1',
      },
    },
  ];
}

function mockTeacherSubmissions(): SubmissionWithEvaluation[] {
  return [
    {
      id: 'mock-t-1',
      missionId: 'design_solution',
      pseudonym: 'Sokol-12',
      studentId: null,
      studentAccessCodeId: null,
      classId: 'demo-class',
      responseText: 'Navrhujem...',
      evidenceText: '',
      evidenceType: 'text',
      status: 'ai_reviewed',
      xpAwarded: 90,
      createdAt: new Date().toISOString(),
      evaluation: {
        valid: true,
        score: 78,
        confidence: 0.68,
        reasons: [],
        detectedCompetencies: [{ id: 'maker_venture', strength: 0.55 }],
        suggestedTeacherReview: true,
        model: 'mock-formative-validator-v1',
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// DB paths
// ---------------------------------------------------------------------------

async function dbCreate(ctx: RequestContext, input: SubmissionInput): Promise<CreateResult> {
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin');
    const admin = getSupabaseAdmin();

    // Determine identity fields
    const studentId = ctx.mode === 'supabase_user' ? ctx.userId : null;
    const studentAccessCodeId = ctx.mode === 'student_session' ? ctx.studentAccessCodeId : null;
    const classId = ctx.mode === 'student_session' ? ctx.classId : (input.classId ?? null);

    const { data: sub, error: subErr } = await admin
      .from('submissions')
      .insert({
        mission_id: input.missionId,
        student_id: studentId,
        student_access_code_id: studentAccessCodeId,
        class_id: classId,
        response_text: input.studentResponse,
        evidence_text: input.evidenceText,
        evidence_type: input.evidenceType,
        submission_kind: input.submissionKind ?? 'solution_submission',
        status: 'submitted',
      })
      .select('id')
      .single();

    if (subErr || !sub) return { ok: false, error: 'Uloženie odovzdania zlyhalo.' };
    const submissionId = String((sub as Record<string, unknown>).id);

    // Evaluate (problem proposal uses the problem rubric + provisional reward)
    const { evaluation, xpAwarded, isProposal } = await evaluateSubmission(input);

    // Store AI evaluation
    await admin.from('ai_evaluations').insert({
      submission_id: submissionId,
      valid: evaluation.valid,
      score: evaluation.score,
      confidence: evaluation.confidence,
      reasons: evaluation.reasons,
      detected_competencies: evaluation.detectedCompetencies,
      suggested_teacher_review: evaluation.suggestedTeacherReview,
      model: evaluation.model,
    });

    // PROVISIONAL XP only: recorded on the submission row but NOT committed to
    // the student's totals. Final XP is applied to profile/user_progress only
    // after a teacher review (approved/adjusted) — see teacherReviewService.
    await admin
      .from('submissions')
      .update({
        status: 'ai_reviewed',
        xp_awarded: xpAwarded,
        problem_quality_score: isProposal ? evaluation.score : null,
        problem_reward_xp: isProposal ? xpAwarded : 0,
      })
      .eq('id', submissionId);

    return {
      ok: true,
      submissionId,
      xpAwarded,
      kind: input.submissionKind ?? 'solution_submission',
      provisional: isProposal,
      evaluation: {
        valid: evaluation.valid,
        score: evaluation.score,
        confidence: evaluation.confidence,
        reasons: evaluation.reasons,
        detectedCompetencies: evaluation.detectedCompetencies.map((d) => ({ id: d.id, strength: d.strength })),
        suggestedTeacherReview: evaluation.suggestedTeacherReview,
        model: evaluation.model,
      },
    };
  } catch {
    return { ok: false, error: 'Interná chyba servera.' };
  }
}

async function dbGetOwn(ctx: RequestContext): Promise<SubmissionWithEvaluation[]> {
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin');
    const admin = getSupabaseAdmin();

    let query = admin
      .from('submissions')
      .select('id, mission_id, student_id, student_access_code_id, class_id, response_text, evidence_text, evidence_type, status, xp_awarded, created_at, ai_evaluations(valid, score, confidence, reasons, detected_competencies, suggested_teacher_review, model)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (ctx.mode === 'supabase_user') {
      query = query.eq('student_id', ctx.userId);
    } else if (ctx.mode === 'student_session') {
      query = query.eq('student_access_code_id', ctx.studentAccessCodeId);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return (data as unknown as Record<string, unknown>[]).map(rowToSubmission);
  } catch {
    return [];
  }
}

async function dbGetById(ctx: RequestContext, id: string): Promise<SubmissionWithEvaluation | null> {
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin');
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from('submissions')
      .select('id, mission_id, student_id, student_access_code_id, class_id, response_text, evidence_text, evidence_type, status, xp_awarded, created_at, ai_evaluations(valid, score, confidence, reasons, detected_competencies, suggested_teacher_review, model)')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as unknown as Record<string, unknown>;

    // Authorization: owner or teacher-of-student
    if (ctx.mode === 'supabase_user') {
      if (ctx.role === 'student' && row.student_id !== ctx.userId) return null;
    } else if (ctx.mode === 'student_session') {
      if (row.student_access_code_id !== ctx.studentAccessCodeId) return null;
    }

    return rowToSubmission(row);
  } catch {
    return null;
  }
}

async function dbGetTeacherList(
  ctx: RequestContext,
  filters: SubmissionQueryFilter,
): Promise<SubmissionWithEvaluation[]> {
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin');
    const admin = getSupabaseAdmin();

    // Find classes the teacher manages
    const { data: memberships } = await admin
      .from('class_memberships')
      .select('class_id')
      .eq('user_id', ctx.mode === 'supabase_user' ? ctx.userId : '')
      .eq('role', 'teacher');
    const teacherClassIds = ((memberships ?? []) as Record<string, unknown>[]).map((m) => String(m.class_id));
    if (teacherClassIds.length === 0) return [];

    const classFilter = filters.classId
      ? [filters.classId].filter((id) => teacherClassIds.includes(id))
      : teacherClassIds;
    if (classFilter.length === 0) return [];

    let query = admin
      .from('submissions')
      .select('id, mission_id, student_id, student_access_code_id, class_id, response_text, evidence_text, evidence_type, status, xp_awarded, created_at, ai_evaluations(valid, score, confidence, reasons, detected_competencies, suggested_teacher_review, model)')
      .in('class_id', classFilter)
      .order('created_at', { ascending: false })
      .limit(100);

    if (filters.missionId) query = query.eq('mission_id', filters.missionId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.from) query = query.gte('created_at', filters.from);
    if (filters.to) query = query.lte('created_at', filters.to);

    const { data, error } = await query;
    if (error || !data) return [];
    return (data as unknown as Record<string, unknown>[]).map(rowToSubmission);
  } catch {
    return [];
  }
}

async function dbGetProgress(ctx: RequestContext): Promise<{
  totalXp: number;
  level: number;
  competencyProgress: { competencyId: string; xp: number; level: number; mastery: number }[];
}> {
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin');
    const admin = getSupabaseAdmin();

    if (ctx.mode !== 'supabase_user') {
      return { totalXp: 0, level: 1, competencyProgress: [] };
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('total_xp, level')
      .eq('id', ctx.userId)
      .single();
    const profileRow = profile as Record<string, unknown> | null;

    const { data: progress } = await admin
      .from('user_progress')
      .select('competency_id, xp, level, mastery')
      .eq('user_id', ctx.userId);
    const progressRows = ((progress ?? []) as Record<string, unknown>[]).map((r) => ({
      competencyId: String(r.competency_id),
      xp: Number(r.xp),
      level: Number(r.level),
      mastery: Number(r.mastery),
    }));

    return {
      totalXp: Number(profileRow?.total_xp ?? 0),
      level: Number(profileRow?.level ?? 1),
      competencyProgress: progressRows,
    };
  } catch {
    return { totalXp: 0, level: 1, competencyProgress: [] };
  }
}

// ---------------------------------------------------------------------------
// Row mapper — safe subset, no hashes/secrets
// ---------------------------------------------------------------------------
function rowToSubmission(row: Record<string, unknown>): SubmissionWithEvaluation {
  const evalRow = row.ai_evaluations as Record<string, unknown> | null | undefined;
  return {
    id: String(row.id),
    missionId: String(row.mission_id),
    pseudonym: null, // pseudonym is in student_access_codes, not here
    studentId: row.student_id ? String(row.student_id) : null,
    studentAccessCodeId: row.student_access_code_id ? String(row.student_access_code_id) : null,
    classId: row.class_id ? String(row.class_id) : null,
    responseText: String(row.response_text ?? ''),
    evidenceText: String(row.evidence_text ?? ''),
    evidenceType: String(row.evidence_type ?? 'text'),
    status: String(row.status ?? 'submitted'),
    xpAwarded: Number(row.xp_awarded ?? 0),
    createdAt: String(row.created_at ?? ''),
    evaluation: evalRow
      ? {
          valid: Boolean(evalRow.valid),
          score: Number(evalRow.score),
          confidence: Number(evalRow.confidence),
          reasons: (evalRow.reasons as { criterion: string; result: string; explanation: string }[]) ?? [],
          detectedCompetencies: (evalRow.detected_competencies as { id: string; strength: number }[]) ?? [],
          suggestedTeacherReview: Boolean(evalRow.suggested_teacher_review),
          model: String(evalRow.model ?? ''),
        }
      : null,
  };
}
