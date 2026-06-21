/**
 * INVOK Akadémia progress (SERVER-ONLY).
 *
 * Pseudonymous: a lesson completion is anchored to a `student_access_codes` row.
 * XP is server-authoritative (a fixed amount per lesson, granted once) and only
 * when the quiz is passed (>= 60%). Mirrors questionnaireService.
 */
import { getServerEnv, missingServerSecrets } from '../lib/env.js';
import { verifyStudentSession } from './studentAccessService.js';

const LESSON_XP = 30;
const PASS_RATIO = 0.6;

export interface CompleteLessonResult {
  ok: boolean;
  passed?: boolean;
  alreadyDone?: boolean;
  xpAwarded?: number;
  error?: string;
  status?: number;
}

function isConfigured(): boolean {
  return missingServerSecrets(getServerEnv()).length === 0;
}

export async function completeLesson(
  token: string,
  moduleId: unknown,
  lessonId: unknown,
  quizScore: unknown,
  quizMax: unknown,
): Promise<CompleteLessonResult> {
  if (!isConfigured()) return { ok: false, error: 'Backend nie je nastavený.', status: 503 };
  const mid = typeof moduleId === 'string' ? moduleId : '';
  const lid = typeof lessonId === 'string' ? lessonId : '';
  if (!mid || !lid) return { ok: false, error: 'Chýba modul alebo lekcia.', status: 400 };
  const score = Number(quizScore);
  const max = Number(quizMax);
  if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) {
    return { ok: false, error: 'Neplatný výsledok kvízu.', status: 400 };
  }
  const session = await verifyStudentSession(token);
  if (!session.valid || !session.studentAccessCodeId || !session.classId) {
    return { ok: false, error: 'Neplatná študentská session.', status: 401 };
  }

  const passed = score >= Math.ceil(max * PASS_RATIO);
  if (!passed) return { ok: true, passed: false, xpAwarded: 0 };

  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
    const admin = getSupabaseAdmin();

    const { data: existing } = await admin
      .from('academy_progress')
      .select('id')
      .eq('student_access_code_id', session.studentAccessCodeId)
      .eq('lesson_id', lid)
      .maybeSingle();
    if (existing) return { ok: true, passed: true, alreadyDone: true, xpAwarded: 0 };

    const { error } = await admin.from('academy_progress').insert({
      student_access_code_id: session.studentAccessCodeId,
      class_id: session.classId,
      module_id: mid,
      lesson_id: lid,
      quiz_score: Math.round(score),
      quiz_max: Math.round(max),
      xp_awarded: LESSON_XP,
    });
    if (error) return { ok: false, error: error.message, status: 500 };
    return { ok: true, passed: true, alreadyDone: false, xpAwarded: LESSON_XP };
  } catch {
    return { ok: false, error: 'Uloženie lekcie zlyhalo.', status: 500 };
  }
}

export async function listMyAcademy(
  token: string,
): Promise<{ ok: boolean; completedLessonIds?: string[]; error?: string; status?: number }> {
  if (!isConfigured()) return { ok: false, error: 'Backend nie je nastavený.', status: 503 };
  const session = await verifyStudentSession(token);
  if (!session.valid || !session.studentAccessCodeId) {
    return { ok: false, error: 'Neplatná študentská session.', status: 401 };
  }
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('academy_progress')
      .select('lesson_id')
      .eq('student_access_code_id', session.studentAccessCodeId);
    if (error) return { ok: false, error: error.message, status: 500 };
    const rows = (data ?? []) as Array<{ lesson_id: string }>;
    return { ok: true, completedLessonIds: rows.map((r) => r.lesson_id) };
  } catch {
    return { ok: false, error: 'Načítanie postupu zlyhalo.', status: 500 };
  }
}

/** Total XP from completed academy lessons (folds into progress). */
export async function sumAcademyXp(studentAccessCodeId: string): Promise<number> {
  if (!isConfigured()) return 0;
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('academy_progress')
      .select('xp_awarded')
      .eq('student_access_code_id', studentAccessCodeId);
    const rows = (data ?? []) as Array<{ xp_awarded: number | null }>;
    return rows.reduce((sum, r) => sum + (Number(r.xp_awarded) || 0), 0);
  } catch {
    return 0;
  }
}
