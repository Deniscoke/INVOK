/**
 * Frontend teacher API client for student-proposed quest approvals.
 *
 *   GET  /api/teacher/quests?classId=…    → list pending / changes_requested / approved
 *   POST /api/teacher/quests?action=review → approve / request_changes / reject
 *
 * Sends the teacher's Supabase JWT as a Bearer token (real accounts).
 * Falls back to a clean empty list when the API is unavailable, so the dashboard
 * never breaks in demo mode.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';

export type QuestState =
  | 'draft'
  | 'pending_approval'
  | 'changes_requested'
  | 'approved'
  | 'submitted'
  | 'completed'
  | 'rejected';

export interface TeacherQuestRow {
  id: string;
  classId: string;
  studentAccessCodeId: string;
  studentAlias?: string;
  title: string;
  description: string | null;
  goal: string;
  affectedGroup: string | null;
  evidence: string | null;
  firstIdea: string | null;
  source: 'student' | 'ai';
  aiModel: string | null;
  state: QuestState;
  proposedDeadline: string | null;
  approvedDeadline: string | null;
  teacherFeedback: string | null;
  submissionId: string | null;
  xpEstimate: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionEvaluation {
  valid: boolean;
  score: number;
  confidence: number;
  reasons: { criterion: string; result: string; explanation: string }[];
  detectedCompetencies: { id: string; strength: number }[];
  model: string;
}

export interface ExistingSubmissionReview {
  decision: string;
  finalScore: number;
  finalValid: boolean;
  feedbackText: string | null;
}

/** Fetch a submission's AI evaluation + existing teacher review (for the final, post-submission review). */
export async function fetchSubmissionReview(
  submissionId: string,
): Promise<{ evaluation: SubmissionEvaluation | null; review: ExistingSubmissionReview | null }> {
  try {
    const res = await fetch(`/api/submissions/${encodeURIComponent(submissionId)}`, { headers: await authHeaders() });
    const data = (await res.json().catch(() => null)) as
      | { submission?: { evaluation?: SubmissionEvaluation | null }; review?: ExistingSubmissionReview | null }
      | null;
    if (!res.ok || !data) return { evaluation: null, review: null };
    return { evaluation: data.submission?.evaluation ?? null, review: data.review ?? null };
  } catch {
    return { evaluation: null, review: null };
  }
}

export type ApprovalDecision = 'approve' | 'request_changes' | 'reject';

export interface ReviewQuestInput {
  questId: string;
  decision: ApprovalDecision;
  teacherFeedback?: string;
  approvedDeadline?: string; // YYYY-MM-DD
  xpEstimate?: number;
}

export interface ReviewQuestResult {
  ok: boolean;
  quest?: TeacherQuestRow;
  error?: string;
  source?: 'db' | 'mock';
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function listPendingQuests(classId?: string): Promise<TeacherQuestRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const qs = classId ? `?classId=${encodeURIComponent(classId)}` : '';
    const response = await fetch(`/api/teacher/quests${qs}`, { headers: await authHeaders() });
    const data = (await response.json()) as { ok?: boolean; quests?: TeacherQuestRow[]; error?: string };
    if (!response.ok || !data.ok || !Array.isArray(data.quests)) return [];
    return data.quests;
  } catch {
    return [];
  }
}

export async function reviewQuestRequest(input: ReviewQuestInput): Promise<ReviewQuestResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase nie je nastavený — schvaľovanie misií je dostupné len v reálnom režime.' };
  }
  try {
    const response = await fetch('/api/teacher/quests?action=review', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(input),
    });
    const data = (await response.json()) as ReviewQuestResult;
    if (!response.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Schválenie zlyhalo.' };
    }
    return data;
  } catch {
    return { ok: false, error: 'Sieťová chyba — skús neskôr.' };
  }
}
