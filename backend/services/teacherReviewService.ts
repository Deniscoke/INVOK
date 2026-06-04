/**
 * Teacher review service (SERVER-ONLY).
 *
 * Provides aggregated statistics for the teacher dashboard:
 * pending-review counts, class-level competency coverage, AI confidence.
 * Read-only in Phase 3; teacher approval workflow is Phase 5.
 *
 * Do NOT import from frontend code.
 */
import type { RequestContext } from '../lib/requestContext';
import { getServerEnv, missingServerSecrets } from '../lib/env';

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

function isConfigured(): boolean {
  return missingServerSecrets(getServerEnv()).length === 0;
}

export async function getTeacherDashboardStats(ctx: RequestContext): Promise<TeacherDashboardStats> {
  if (ctx.mode !== 'supabase_user' || (ctx.role !== 'teacher' && ctx.role !== 'admin')) {
    return { classes: [], totalPending: 0, source: 'mock' };
  }
  return isConfigured() ? dbStats(ctx.userId) : mockStats();
}

function mockStats(): TeacherDashboardStats {
  return {
    classes: [
      {
        classId: 'demo-class',
        className: 'Trieda 5.B',
        pendingReviewCount: 3,
        totalSubmissions: 12,
        averageAiConfidence: 0.71,
        averageScore: 68,
      },
    ],
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

      const evaluations = rows
        .map((r) => r.ai_evaluations as Record<string, unknown> | undefined)
        .filter(Boolean) as Record<string, unknown>[];

      const avgConf = evaluations.length
        ? evaluations.reduce((sum, e) => sum + Number(e.confidence ?? 0), 0) / evaluations.length
        : 0;
      const avgScore = evaluations.length
        ? evaluations.reduce((sum, e) => sum + Number(e.score ?? 0), 0) / evaluations.length
        : 0;

      classes.push({
        classId,
        className: String(classData.name ?? classId),
        pendingReviewCount: pending,
        totalSubmissions: rows.length,
        averageAiConfidence: Math.round(avgConf * 100) / 100,
        averageScore: Math.round(avgScore),
      });
    }

    return {
      classes,
      totalPending: classes.reduce((s, c) => s + c.pendingReviewCount, 0),
      source: 'db',
    };
  } catch {
    return mockStats();
  }
}
