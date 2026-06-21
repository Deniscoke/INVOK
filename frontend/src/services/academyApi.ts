/**
 * Frontend client for the INVOK Akadémia (video lessons + quiz → XP).
 * Uses the pseudonymous student session token.
 */
const STUDENT_TOKEN_KEY = 'invok_student_session';

export interface CompleteLessonResult {
  ok: boolean;
  passed?: boolean;
  alreadyDone?: boolean;
  xpAwarded?: number;
  error?: string;
}

function token(): string | null {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(STUDENT_TOKEN_KEY) : null;
}

export async function completeAcademyLesson(
  moduleId: string,
  lessonId: string,
  quizScore: number,
  quizMax: number,
): Promise<CompleteLessonResult> {
  const t = token();
  if (!t) return { ok: false, error: 'Nie si prihlásený ako žiak. Pripoj sa kódom triedy.' };
  try {
    const res = await fetch('/api/student/academy', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
      body: JSON.stringify({ moduleId, lessonId, quizScore, quizMax }),
    });
    const data = (await res.json().catch(() => null)) as CompleteLessonResult | null;
    if (res.status === 401) return { ok: false, error: 'Relácia vypršala — pripoj sa znova kódom triedy.' };
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error ?? 'Uloženie lekcie zlyhalo.' };
    return data;
  } catch {
    return { ok: false, error: 'Spojenie so serverom zlyhalo.' };
  }
}

export async function fetchMyAcademy(): Promise<string[]> {
  const t = token();
  if (!t) return [];
  try {
    const res = await fetch('/api/student/academy', { headers: { authorization: `Bearer ${t}` } });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; completedLessonIds?: string[] } | null;
    return res.ok && data?.ok && Array.isArray(data.completedLessonIds) ? data.completedLessonIds : [];
  } catch {
    return [];
  }
}
