/**
 * Frontend teacher review API client.
 * Sends the teacher's Supabase JWT (if configured) as a Bearer token.
 * Falls back to a local mock when the API is unavailable (demo mode).
 */
import { supabase } from './supabaseClient';

export type ReviewDecision = 'approved' | 'adjusted' | 'needs_revision' | 'rejected';

export interface ReviewPayload {
  submissionId: string;
  aiEvaluationId?: string;
  decision: ReviewDecision;
  finalValid: boolean;
  finalScore: number;
  feedbackText?: string;
  adjustmentReason?: string;
}

export interface ReviewRecord {
  id: string;
  submissionId: string;
  decision: ReviewDecision;
  finalValid: boolean;
  finalScore: number;
  feedbackText: string | null;
  adjustmentReason: string | null;
}

export interface SubmitReviewResult {
  ok: boolean;
  review?: ReviewRecord;
  finalXp?: number;
  newStatus?: string;
  error?: string;
  source: 'api' | 'mock';
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

export async function submitReview(payload: ReviewPayload): Promise<SubmitReviewResult> {
  try {
    const response = await fetch('/api/teacher/reviews', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as SubmitReviewResult & { error?: string };
    if (!response.ok || !data.ok) return { ok: false, error: data.error ?? 'Hodnotenie zlyhalo.', source: 'api' };
    return { ...data, source: 'api' };
  } catch {
    return mockReview(payload);
  }
}

/** Local demo computation when no backend is available. */
function mockReview(payload: ReviewPayload): SubmitReviewResult {
  const committed = payload.decision === 'approved' || payload.decision === 'adjusted';
  const finalXp = committed ? Math.round(100 * (Math.min(100, Math.max(0, payload.finalScore)) / 100)) : 0;
  const statusByDecision: Record<ReviewDecision, string> = {
    approved: 'approved',
    adjusted: 'teacher_reviewed',
    needs_revision: 'needs_revision',
    rejected: 'rejected',
  };
  return {
    ok: true,
    source: 'mock',
    finalXp,
    newStatus: statusByDecision[payload.decision],
    review: {
      id: `mock-${Date.now()}`,
      submissionId: payload.submissionId,
      decision: payload.decision,
      finalValid: payload.finalValid,
      finalScore: payload.finalScore,
      feedbackText: payload.feedbackText ?? null,
      adjustmentReason: payload.adjustmentReason ?? null,
    },
  };
}
