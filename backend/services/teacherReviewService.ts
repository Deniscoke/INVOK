/**
 * Teacher review service (SERVER-ONLY).
 *
 * The teacher is the guarantor: AI proposes, the teacher confirms or adjusts.
 * Every review is an auditable row in `teacher_reviews`. Final XP is committed
 * here (approved/adjusted), never at submission time.
 *
 * Mock fallback (no Supabase) keeps the workflow runnable and testable offline.
 * Do NOT import from frontend code.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestContext } from '../lib/requestContext';
import { isTeacherOrAdmin } from '../lib/requestContext';
import { getServerEnv, missingServerSecrets } from '../lib/env';
import {
  validateTeacherReviewInput,
  type TeacherReviewInput,
  type ReviewDecision,
} from '../validators/teacherReviewValidator';
import { getMissionById } from './missionService';
import { applyXp, finalXpForReview, levelForXp } from './progressService';

export interface TeacherReviewRecord {
  id: string;
  submissionId: string;
  aiEvaluationId: string | null;
  reviewerId: string;
  decision: ReviewDecision;
  finalValid: boolean;
  finalScore: number;
  feedbackText: string | null;
  adjustmentReason: string | null;
  createdAt: string;
}

export type CreateReviewResult =
  | { ok: true; review: TeacherReviewRecord; finalXp: number; newStatus: string; source: 'mock' | 'db' }
  | { ok: false; error: string };

/** submission.status to set for each decision. */
const STATUS_BY_DECISION: Record<ReviewDecision, string> = {
  approved: 'approved',
  adjusted: 'teacher_reviewed',
  needs_revision: 'needs_revision',
  rejected: 'rejected',
};

const DEFAULT_BASE_XP = 100;

function isConfigured(): boolean {
  return missingServerSecrets(getServerEnv()).length === 0;
}

/** Role gate (scope is enforced additionally in the DB path). */
export function canReviewSubmission(ctx: RequestContext, _submission?: { classId?: string | null }): boolean {
  return isTeacherOrAdmin(ctx);
}

export async function createTeacherReview(ctx: RequestContext, raw: unknown): Promise<CreateReviewResult> {
  if (!isTeacherOrAdmin(ctx)) {
    return { ok: false, error: 'Len učiteľ alebo admin môže vytvoriť hodnotenie.' };
  }
  const validation = validateTeacherReviewInput(raw);
  if (!validation.ok) {
    return { ok: false, error: validation.issues.map((i) => i.message).join(' ') };
  }
  return isConfigured() ? dbCreateReview(ctx, validation.value) : mockCreateReview(ctx, validation.value);
}

export async function getTeacherReviewForSubmission(
  ctx: RequestContext,
  submissionId: string,
): Promise<TeacherReviewRecord | null> {
  if (ctx.mode === 'anonymous') return null;
  return isConfigured() ? dbGetReview(ctx, submissionId) : null;
}

export async function listTeacherReviews(
  ctx: RequestContext,
  filters: { decision?: ReviewDecision; classId?: string },
): Promise<TeacherReviewRecord[]> {
  if (!isTeacherOrAdmin(ctx)) return [];
  return isConfigured() ? dbListReviews(ctx, filters) : [];
}

// ---------------------------------------------------------------------------
// Mock path
// ---------------------------------------------------------------------------
function mockCreateReview(ctx: RequestContext, input: TeacherReviewInput): CreateReviewResult {
  const reviewerId = ctx.mode === 'supabase_user' ? ctx.userId : 'mock-reviewer';
  const finalXp = finalXpForReview(DEFAULT_BASE_XP, input.finalScore, input.decision);
  return {
    ok: true,
    source: 'mock',
    finalXp,
    newStatus: STATUS_BY_DECISION[input.decision],
    review: {
      id: `mock-review-${Date.now()}`,
      submissionId: input.submissionId,
      aiEvaluationId: input.aiEvaluationId ?? null,
      reviewerId,
      decision: input.decision,
      finalValid: input.finalValid,
      finalScore: input.finalScore,
      feedbackText: input.feedbackText ?? null,
      adjustmentReason: input.adjustmentReason ?? null,
      createdAt: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// DB path
// ---------------------------------------------------------------------------
async function dbCreateReview(ctx: RequestContext, input: TeacherReviewInput): Promise<CreateReviewResult> {
  if (ctx.mode !== 'supabase_user') return { ok: false, error: 'Neoprávnený kontext.' };
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin');
    const admin = getSupabaseAdmin();

    // Load submission and enforce class scope.
    const { data: subData } = await admin
      .from('submissions')
      .select('id, mission_id, class_id, student_id')
      .eq('id', input.submissionId)
      .maybeSingle();
    const submission = subData as Record<string, unknown> | null;
    if (!submission) return { ok: false, error: 'Odovzdanie nenájdené.' };

    const inScope = await managesClass(admin, ctx.userId, submission.class_id as string | null);
    if (!inScope) return { ok: false, error: 'Toto odovzdanie nie je vo vašej triede.' };

    const { data: reviewData, error: reviewErr } = await admin
      .from('teacher_reviews')
      .insert({
        submission_id: input.submissionId,
        ai_evaluation_id: input.aiEvaluationId ?? null,
        reviewer_id: ctx.userId,
        decision: input.decision,
        final_valid: input.finalValid,
        final_score: input.finalScore,
        feedback_text: input.feedbackText ?? null,
        adjustment_reason: input.adjustmentReason ?? null,
      })
      .select('id, created_at')
      .single();
    if (reviewErr || !reviewData) return { ok: false, error: 'Uloženie hodnotenia zlyhalo.' };

    const mission = getMissionById(String(submission.mission_id));
    const baseXp = mission?.baseXp ?? DEFAULT_BASE_XP;
    const finalXp = finalXpForReview(baseXp, input.finalScore, input.decision);
    const newStatus = STATUS_BY_DECISION[input.decision];

    await applyReviewToSubmission(admin, {
      submissionId: input.submissionId,
      studentId: submission.student_id ? String(submission.student_id) : null,
      targetCompetencies: mission?.targetCompetencies ?? [],
      finalXp,
      newStatus,
    });

    const row = reviewData as Record<string, unknown>;
    return {
      ok: true,
      source: 'db',
      finalXp,
      newStatus,
      review: {
        id: String(row.id),
        submissionId: input.submissionId,
        aiEvaluationId: input.aiEvaluationId ?? null,
        reviewerId: ctx.userId,
        decision: input.decision,
        finalValid: input.finalValid,
        finalScore: input.finalScore,
        feedbackText: input.feedbackText ?? null,
        adjustmentReason: input.adjustmentReason ?? null,
        createdAt: String(row.created_at ?? new Date().toISOString()),
      },
    };
  } catch {
    return { ok: false, error: 'Interná chyba servera.' };
  }
}

/** Apply the review outcome: set submission status + commit final XP. */
export async function applyReviewToSubmission(
  admin: SupabaseClient,
  params: { submissionId: string; studentId: string | null; targetCompetencies: string[]; finalXp: number; newStatus: string },
): Promise<void> {
  await admin
    .from('submissions')
    .update({ status: params.newStatus, xp_awarded: params.finalXp })
    .eq('id', params.submissionId);

  // Commit XP to the student's totals only for auth-based students with XP > 0.
  if (!params.studentId || params.finalXp <= 0) return;

  // Per-competency split.
  const competencies = params.targetCompetencies;
  if (competencies.length > 0) {
    const share = Math.round(params.finalXp / competencies.length);
    for (const competencyId of competencies) {
      const { data: existing } = await admin
        .from('user_progress')
        .select('id, xp, level, mastery')
        .eq('user_id', params.studentId)
        .eq('competency_id', competencyId)
        .maybeSingle();
      const existingRow = existing as Record<string, unknown> | null;
      const updated = applyXp(
        {
          competencyId,
          xp: Number(existingRow?.xp ?? 0),
          level: Number(existingRow?.level ?? 1),
          mastery: Number(existingRow?.mastery ?? 0),
        },
        share,
        0.05,
      );
      if (existingRow) {
        await admin.from('user_progress').update({ xp: updated.xp, level: updated.level, mastery: updated.mastery }).eq('id', String(existingRow.id));
      } else {
        await admin.from('user_progress').insert({ user_id: params.studentId, competency_id: competencyId, xp: updated.xp, level: updated.level, mastery: updated.mastery });
      }
    }
  }

  // Profile total XP + level.
  const { data: prof } = await admin.from('profiles').select('total_xp').eq('id', params.studentId).single();
  const profileRow = prof as Record<string, unknown> | null;
  if (profileRow) {
    const newXp = Number(profileRow.total_xp ?? 0) + params.finalXp;
    await admin.from('profiles').update({ total_xp: newXp, level: levelForXp(newXp) }).eq('id', params.studentId);
  }
}

async function managesClass(admin: SupabaseClient, userId: string, classId: string | null): Promise<boolean> {
  if (!classId) return false;
  const { data: teacher } = await admin
    .from('class_memberships')
    .select('id')
    .eq('class_id', classId)
    .eq('user_id', userId)
    .eq('role', 'teacher')
    .maybeSingle();
  if (teacher) return true;
  // School admin fallback
  const { data: cls } = await admin.from('classes').select('school_id').eq('id', classId).maybeSingle();
  const clsRow = cls as Record<string, unknown> | null;
  if (!clsRow) return false;
  const { data: adminMember } = await admin
    .from('school_memberships')
    .select('id')
    .eq('school_id', String(clsRow.school_id))
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  return Boolean(adminMember);
}

/** True if the caller may access a submission (class manager, or its owner). */
async function canAccessSubmission(admin: SupabaseClient, ctx: RequestContext, submission: Record<string, unknown>): Promise<boolean> {
  if (ctx.mode === 'supabase_user') {
    if (ctx.role === 'teacher' || ctx.role === 'admin') {
      return managesClass(admin, ctx.userId, (submission.class_id as string | null) ?? null);
    }
    return submission.student_id === ctx.userId;
  }
  if (ctx.mode === 'student_session') {
    return submission.student_access_code_id === ctx.studentAccessCodeId;
  }
  return false;
}

async function dbGetReview(ctx: RequestContext, submissionId: string): Promise<TeacherReviewRecord | null> {
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin');
    const admin = getSupabaseAdmin();

    // Scope check: only the class manager or the submission owner may read.
    const { data: subData } = await admin
      .from('submissions')
      .select('class_id, student_id, student_access_code_id')
      .eq('id', submissionId)
      .maybeSingle();
    const submission = subData as Record<string, unknown> | null;
    if (!submission || !(await canAccessSubmission(admin, ctx, submission))) return null;

    const { data } = await admin
      .from('teacher_reviews')
      .select('id, submission_id, ai_evaluation_id, reviewer_id, decision, final_valid, final_score, feedback_text, adjustment_reason, created_at')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return mapReview(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

async function dbListReviews(
  ctx: RequestContext,
  filters: { decision?: ReviewDecision; classId?: string },
): Promise<TeacherReviewRecord[]> {
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin');
    const admin = getSupabaseAdmin();
    let query = admin
      .from('teacher_reviews')
      .select('id, submission_id, ai_evaluation_id, reviewer_id, decision, final_valid, final_score, feedback_text, adjustment_reason, created_at')
      .eq('reviewer_id', ctx.mode === 'supabase_user' ? ctx.userId : '')
      .order('created_at', { ascending: false })
      .limit(100);
    if (filters.decision) query = query.eq('decision', filters.decision);
    const { data } = await query;
    return ((data ?? []) as Record<string, unknown>[]).map(mapReview);
  } catch {
    return [];
  }
}

function mapReview(row: Record<string, unknown>): TeacherReviewRecord {
  return {
    id: String(row.id),
    submissionId: String(row.submission_id),
    aiEvaluationId: row.ai_evaluation_id ? String(row.ai_evaluation_id) : null,
    reviewerId: String(row.reviewer_id),
    decision: String(row.decision) as ReviewDecision,
    finalValid: Boolean(row.final_valid),
    finalScore: Number(row.final_score),
    feedbackText: row.feedback_text ? String(row.feedback_text) : null,
    adjustmentReason: row.adjustment_reason ? String(row.adjustment_reason) : null,
    createdAt: String(row.created_at ?? ''),
  };
}

// ---------------------------------------------------------------------------
// Dashboard stats (Phase 3, unchanged)
// ---------------------------------------------------------------------------
export interface ClassStats {
  classId: string;
  className: string;
  pendingReviewCount: number;
  totalSubmissions: number;
  averageAiConfidence: number;
  averageScore: number;
}

export interface TeacherDashboardStats {
  classes: ClassStats[];
  totalPending: number;
  source: 'mock' | 'db';
}

export async function getTeacherDashboardStats(ctx: RequestContext): Promise<TeacherDashboardStats> {
  if (!isTeacherOrAdmin(ctx)) {
    return { classes: [], totalPending: 0, source: 'mock' };
  }
  return isConfigured() && ctx.mode === 'supabase_user' ? dbStats(ctx.userId) : mockStats();
}

function mockStats(): TeacherDashboardStats {
  return {
    classes: [{ classId: 'demo-class', className: 'Trieda 5.B', pendingReviewCount: 3, totalSubmissions: 12, averageAiConfidence: 0.71, averageScore: 68 }],
    totalPending: 3,
    source: 'mock',
  };
}

async function dbStats(userId: string): Promise<TeacherDashboardStats> {
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin');
    const admin = getSupabaseAdmin();
    const { data: memberships } = await admin
      .from('class_memberships')
      .select('class_id, classes(id, name)')
      .eq('user_id', userId)
      .eq('role', 'teacher');

    const classes: ClassStats[] = [];
    for (const m of (memberships ?? []) as Record<string, unknown>[]) {
      const classData = m.classes as Record<string, unknown> | undefined;
      if (!classData) continue;
      const classId = String(classData.id);
      const { data: subs } = await admin
        .from('submissions')
        .select('id, status, ai_evaluations(confidence, score, suggested_teacher_review)')
        .eq('class_id', classId);
      const rows = (subs ?? []) as Record<string, unknown>[];
      const pending = rows.filter((r) => {
        const ev = r.ai_evaluations as Record<string, unknown> | undefined;
        return ev?.suggested_teacher_review === true && r.status === 'ai_reviewed';
      }).length;
      const evaluations = rows.map((r) => r.ai_evaluations as Record<string, unknown> | undefined).filter(Boolean) as Record<string, unknown>[];
      const avgConf = evaluations.length ? evaluations.reduce((s, e) => s + Number(e.confidence ?? 0), 0) / evaluations.length : 0;
      const avgScore = evaluations.length ? evaluations.reduce((s, e) => s + Number(e.score ?? 0), 0) / evaluations.length : 0;
      classes.push({ classId, className: String(classData.name ?? classId), pendingReviewCount: pending, totalSubmissions: rows.length, averageAiConfidence: Math.round(avgConf * 100) / 100, averageScore: Math.round(avgScore) });
    }
    return { classes, totalPending: classes.reduce((s, c) => s + c.pendingReviewCount, 0), source: 'db' };
  } catch {
    return mockStats();
  }
}
