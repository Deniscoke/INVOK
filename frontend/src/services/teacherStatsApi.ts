/**
 * Teacher/director dashboard stats — class-level questionnaire growth.
 * Uses the teacher's Supabase auth session (Bearer JWT).
 */
import { supabase } from './supabaseClient';

export interface ClassAreaStat {
  id: string;
  avgInput: number | null;
  avgOutput: number | null;
  growthPct: number | null;
}

export interface ClassQuestionnaireStats {
  ok: boolean;
  totalStudents?: number;
  inputCount?: number;
  outputCount?: number;
  avgInputTotal?: number | null;
  avgOutputTotal?: number | null;
  areas?: ClassAreaStat[];
  error?: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchQuestionnaireStats(classId?: string): Promise<ClassQuestionnaireStats | null> {
  try {
    const qs = classId ? `?classId=${encodeURIComponent(classId)}` : '';
    const res = await fetch(`/api/teacher/stats${qs}`, { headers: await authHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as ClassQuestionnaireStats;
  } catch {
    return null;
  }
}

export interface ClassStudent {
  accessCodeId: string;
  pseudonym: string;
  totalXp: number;
  level: number;
  competencies: { competencyId: string; mastery: number }[];
  questionnaireInput: number | null;
  questionnaireOutput: number | null;
  academyDone: number;
  questsTotal: number;
  questsCompleted: number;
}

export async function fetchClassStudents(classId?: string): Promise<ClassStudent[]> {
  try {
    const qs = classId ? `?classId=${encodeURIComponent(classId)}` : '';
    const res = await fetch(`/api/teacher/students${qs}`, { headers: await authHeaders() });
    if (!res.ok) return [];
    const data = (await res.json()) as { ok?: boolean; students?: ClassStudent[] };
    return data.ok && Array.isArray(data.students) ? data.students : [];
  } catch {
    return [];
  }
}
