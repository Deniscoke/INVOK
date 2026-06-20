/**
 * Frontend client for the INVOK input/output questionnaire.
 * Uses the pseudonymous student session token (Authorization: Bearer).
 */
const STUDENT_TOKEN_KEY = 'invok_student_session';

export type QuestionnairePhase = 'input' | 'output';

export interface QuestionnaireResult {
  ok: boolean;
  phase?: QuestionnairePhase;
  areaScores?: Record<string, number>;
  totalScore?: number;
  maxScore?: number;
  xpAwarded?: number;
  error?: string;
}

export interface QuestionnaireSummary {
  phase: QuestionnairePhase;
  areaScores: Record<string, number>;
  totalScore: number;
  maxScore: number;
  xpAwarded: number;
  createdAt: string;
}

function token(): string | null {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(STUDENT_TOKEN_KEY) : null;
}

export async function submitQuestionnaire(
  phase: QuestionnairePhase,
  answers: Record<string, number>,
  openAnswers: Record<string, string>,
): Promise<QuestionnaireResult> {
  const t = token();
  if (!t) return { ok: false, error: 'Nie si prihlásený ako žiak. Pripoj sa kódom triedy od učiteľa.' };
  try {
    const res = await fetch('/api/student/questionnaire', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
      body: JSON.stringify({ phase, answers, openAnswers }),
    });
    const data = (await res.json().catch(() => null)) as QuestionnaireResult | null;
    if (res.status === 401) {
      return { ok: false, error: 'Tvoja relácia vypršala. Odhlás sa a znova sa pripoj kódom triedy.' };
    }
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error ?? 'Uloženie dotazníka zlyhalo.' };
    return data;
  } catch {
    return { ok: false, error: 'Spojenie so serverom zlyhalo.' };
  }
}

export async function fetchMyQuestionnaires(): Promise<QuestionnaireSummary[]> {
  const t = token();
  if (!t) return [];
  try {
    const res = await fetch('/api/student/questionnaire', { headers: { authorization: `Bearer ${t}` } });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; responses?: QuestionnaireSummary[] } | null;
    return res.ok && data?.ok && Array.isArray(data.responses) ? data.responses : [];
  } catch {
    return [];
  }
}
