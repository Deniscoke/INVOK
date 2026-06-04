/**
 * Frontend submission API client.
 *
 * Sends the student session token (if available) via X-Student-Token header
 * so the server can resolve the pseudonymous context. Never sends the service
 * role key or any hash — those stay server-only.
 */

export interface SubmissionPayload {
  missionId: string;
  studentResponse: string;
  evidenceText: string;
  evidenceType: 'text';
  classId?: string;
}

export interface AiEvaluation {
  valid: boolean;
  score: number;
  confidence: number;
  reasons: { criterion: string; result: string; explanation: string }[];
  detectedCompetencies: { id: string; strength: number }[];
  suggestedTeacherReview: boolean;
  model: string;
}

export interface SubmissionResult {
  ok: boolean;
  submissionId?: string;
  xpAwarded?: number;
  evaluation?: AiEvaluation;
  error?: string;
  source: 'api' | 'mock';
}

export interface SubmissionRow {
  id: string;
  missionId: string;
  status: string;
  xpAwarded: number;
  createdAt: string;
  evaluation: AiEvaluation | null;
}

function studentToken(): string | null {
  return localStorage.getItem('invok_student_session');
}

function authHeaders(): Record<string, string> {
  const token = studentToken();
  if (token) return { 'x-student-token': token, 'content-type': 'application/json' };
  return { 'content-type': 'application/json' };
}

export async function submitMission(payload: SubmissionPayload): Promise<SubmissionResult> {
  try {
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as SubmissionResult & { error?: string };
    if (!response.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Odovzdanie zlyhalo.', source: 'api' };
    }
    return { ...data, source: 'api' };
  } catch {
    // Offline fallback: run mock validation inline via the AI endpoint
    return submitMock(payload);
  }
}

async function submitMock(payload: SubmissionPayload): Promise<SubmissionResult> {
  try {
    const response = await fetch('/api/ai/validate-submission', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ missionId: payload.missionId, studentResponse: payload.studentResponse, evidenceText: payload.evidenceText, evidenceType: payload.evidenceType }),
    });
    const eval_ = (await response.json()) as AiEvaluation;
    return {
      ok: true,
      submissionId: `local-${Date.now()}`,
      xpAwarded: eval_.valid ? Math.floor(eval_.score * 0.8) : 0,
      evaluation: eval_,
      source: 'mock',
    };
  } catch {
    return { ok: false, error: 'Nie je možné odovzdať bez pripojenia.', source: 'mock' };
  }
}

export async function fetchMySubmissions(): Promise<SubmissionRow[]> {
  try {
    const response = await fetch('/api/submissions/me', { headers: authHeaders() });
    if (!response.ok) return [];
    const data = (await response.json()) as { submissions: SubmissionRow[] };
    return data.submissions ?? [];
  } catch {
    return [];
  }
}

export async function fetchMyProgress(): Promise<{
  totalXp: number;
  level: number;
  competencyProgress: { competencyId: string; xp: number; level: number; mastery: number }[];
}> {
  try {
    const response = await fetch('/api/progress/me', { headers: authHeaders() });
    if (!response.ok) throw new Error('not ok');
    return (await response.json()) as { totalXp: number; level: number; competencyProgress: { competencyId: string; xp: number; level: number; mastery: number }[] };
  } catch {
    return { totalXp: 0, level: 1, competencyProgress: [] };
  }
}
