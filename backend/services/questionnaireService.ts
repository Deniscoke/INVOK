/**
 * INVOK input/output questionnaire (SERVER-ONLY).
 *
 * Pseudonymous: responses are anchored to a `student_access_codes` row. One row
 * per (student, phase) — re-submitting upserts. Scoring is generic: answer keys
 * are `A1…F8`, grouped by their leading area letter, each value 1–5.
 *
 * Writes go through the service role (RLS-on table with no policies).
 */
import { getServerEnv, missingServerSecrets } from '../lib/env.js';
import { verifyStudentSession } from './studentAccessService.js';

export type QuestionnairePhase = 'input' | 'output';

const AREAS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
const ITEMS_PER_AREA = 8;
const MAX_SCORE = AREAS.length * ITEMS_PER_AREA * 5; // 240
const XP_INPUT = 50;
const XP_OUTPUT = 80;
const ANSWER_KEY = /^([A-F])([1-8])$/;

export interface QuestionnaireResult {
  ok: boolean;
  phase?: QuestionnairePhase;
  areaScores?: Record<string, number>;
  totalScore?: number;
  maxScore?: number;
  xpAwarded?: number;
  error?: string;
  status?: number;
}

export interface QuestionnaireSummary {
  phase: QuestionnairePhase;
  areaScores: Record<string, number>;
  totalScore: number;
  maxScore: number;
  xpAwarded: number;
  createdAt: string;
}

function isConfigured(): boolean {
  return missingServerSecrets(getServerEnv()).length === 0;
}

interface Scored {
  areaScores: Record<string, number>;
  total: number;
  count: number;
}

function scoreAnswers(answers: Record<string, unknown>): Scored | null {
  const areaScores: Record<string, number> = {};
  for (const area of AREAS) areaScores[area] = 0;
  let total = 0;
  let count = 0;
  for (const [key, raw] of Object.entries(answers)) {
    const match = key.match(ANSWER_KEY);
    if (!match) continue;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 5) return null;
    areaScores[match[1]] += value;
    total += value;
    count += 1;
  }
  return { areaScores, total, count };
}

function cleanOpenAnswers(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof input === 'object' && input !== null) {
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) out[key.slice(0, 8)] = value.slice(0, 1000);
    }
  }
  return out;
}

export async function saveQuestionnaire(
  token: string,
  phase: unknown,
  answers: unknown,
  openAnswers: unknown,
): Promise<QuestionnaireResult> {
  if (!isConfigured()) return { ok: false, error: 'Backend nie je nastavený.', status: 503 };
  if (phase !== 'input' && phase !== 'output') {
    return { ok: false, error: 'Neznáma fáza dotazníka.', status: 400 };
  }
  const session = await verifyStudentSession(token);
  if (!session.valid || !session.studentAccessCodeId || !session.classId) {
    return { ok: false, error: 'Neplatná študentská session.', status: 401 };
  }
  const answerObj = typeof answers === 'object' && answers !== null ? (answers as Record<string, unknown>) : {};
  const scored = scoreAnswers(answerObj);
  if (!scored || scored.count < AREAS.length * ITEMS_PER_AREA) {
    return { ok: false, error: 'Dotazník nie je úplný — odpovedz prosím na všetky otázky.', status: 400 };
  }
  const xp = phase === 'input' ? XP_INPUT : XP_OUTPUT;

  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
    const admin = getSupabaseAdmin();
    const { error } = await admin.from('questionnaire_responses').upsert(
      {
        student_access_code_id: session.studentAccessCodeId,
        class_id: session.classId,
        phase,
        answers: answerObj,
        open_answers: cleanOpenAnswers(openAnswers),
        area_scores: scored.areaScores,
        total_score: scored.total,
        max_score: MAX_SCORE,
        xp_awarded: xp,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_access_code_id,phase' },
    );
    if (error) return { ok: false, error: error.message, status: 500 };
    return {
      ok: true,
      phase,
      areaScores: scored.areaScores,
      totalScore: scored.total,
      maxScore: MAX_SCORE,
      xpAwarded: xp,
    };
  } catch {
    return { ok: false, error: 'Uloženie dotazníka zlyhalo.', status: 500 };
  }
}

export async function listMyQuestionnaires(
  token: string,
): Promise<{ ok: boolean; responses?: QuestionnaireSummary[]; error?: string; status?: number }> {
  if (!isConfigured()) return { ok: false, error: 'Backend nie je nastavený.', status: 503 };
  const session = await verifyStudentSession(token);
  if (!session.valid || !session.studentAccessCodeId) {
    return { ok: false, error: 'Neplatná študentská session.', status: 401 };
  }
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('questionnaire_responses')
      .select('phase, area_scores, total_score, max_score, xp_awarded, created_at')
      .eq('student_access_code_id', session.studentAccessCodeId);
    if (error) return { ok: false, error: error.message, status: 500 };
    const rows = (data ?? []) as Record<string, unknown>[];
    const responses: QuestionnaireSummary[] = rows.map((r) => ({
      phase: r.phase as QuestionnairePhase,
      areaScores: (r.area_scores as Record<string, number>) ?? {},
      totalScore: Number(r.total_score ?? 0),
      maxScore: Number(r.max_score ?? MAX_SCORE),
      xpAwarded: Number(r.xp_awarded ?? 0),
      createdAt: String(r.created_at),
    }));
    return { ok: true, responses };
  } catch {
    return { ok: false, error: 'Načítanie dotazníkov zlyhalo.', status: 500 };
  }
}

/** Total XP from completed questionnaires for one student (folds into progress). */
export async function sumQuestionnaireXp(studentAccessCodeId: string): Promise<number> {
  if (!isConfigured()) return 0;
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('questionnaire_responses')
      .select('xp_awarded')
      .eq('student_access_code_id', studentAccessCodeId);
    const rows = (data ?? []) as Array<{ xp_awarded: number | null }>;
    return rows.reduce((sum, r) => sum + (Number(r.xp_awarded) || 0), 0);
  } catch {
    return 0;
  }
}
