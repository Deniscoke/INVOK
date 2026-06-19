/**
 * Frontend submission API client.
 *
 * Sends the student session token (if available) via X-Student-Token header
 * so the server can resolve the pseudonymous context. Never sends the service
 * role key or any hash — those stay server-only.
 *
 * When /api/* is unavailable (plain Vite dev), falls back to a safe local
 * demo scorer so pilot demos still work offline.
 */

import { isSupabaseConfigured } from './supabaseClient';
import { getSnapshot } from './authService';
import { submitDemo } from './demoSubmissionService';

export type SubmissionKind = 'problem_proposal' | 'solution_submission' | 'reflection';

export interface SubmissionPayload {
  missionId: string;
  studentResponse: string;
  evidenceText: string;
  evidenceType: 'text';
  classId?: string;
  submissionKind?: SubmissionKind;
  /** When set, the server evaluates the submission against a student-proposed quest. */
  studentQuestId?: string;
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
  kind?: SubmissionKind;
  provisional?: boolean;
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

export interface PhotoEvidence {
  /** Original filename, e.g. `IMG_1234.jpg` */
  fileName: string;
  /** MIME type, e.g. `image/jpeg` */
  mimeType: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Optional caption written by the student */
  caption?: string;
  /** Data URL preview (base64, capped) — kept local for now, used by demo scorer */
  dataUrl?: string;
}

export interface SolutionSubmissionFields {
  missionId: string;
  classId?: string;
  /** Hlavný popis riešenia / odpovede na misiu */
  solutionSummary: string;
  /** Dôkaz, pozorovanie alebo popis fotky */
  evidence: string;
  /** Konkrétny prvý krok */
  firstStep: string;
  /** Koho sa to týka / aký je prínos */
  impact?: string;
  /** Voliteľná fotka ako dôkaz (popis + base64 náhľad) */
  photo?: PhotoEvidence;
  /** When the submission belongs to a student-proposed quest. */
  studentQuestId?: string;
}

function studentToken(): string | null {
  return localStorage.getItem('invok_student_session');
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = studentToken();
  if (token) headers['x-student-token'] = token;
  // Helps local API dev when Supabase is not configured.
  if (!isSupabaseConfigured) headers['x-dev-role'] = 'student';
  return headers;
}

async function parseJsonResponse(response: Response): Promise<Record<string, unknown> | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function submitMission(payload: SubmissionPayload, photo?: PhotoEvidence): Promise<SubmissionResult> {
  try {
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(response);

    // Any kind of API breakage → safe local demo so testing/demo never blocks.
    if (!data || response.status >= 500) return submitDemo(payload, photo);

    // Not authenticated / no class session (401/403): in a pilot demo the
    // presenter may not have joined a class — fall back to the local demo
    // scorer so "Odovzdať" still produces formative AI feedback.
    if (response.status === 401 || response.status === 403) return submitDemo(payload, photo);

    const result = data as unknown as SubmissionResult & { error?: string };
    if (!response.ok || !result.ok) {
      // Validation errors (400) etc.: show the server message verbatim so the
      // student can fix their input.
      return { ok: false, error: result.error ?? 'Odovzdanie zlyhalo.', source: 'api' };
    }
    return { ...result, source: 'api' };
  } catch {
    // Network / missing API (plain Vite dev) — keep demos working.
    return submitDemo(payload, photo);
  }
}

export interface ProblemProposalFields {
  missionId: string;
  title: string;
  affectedGroup: string;
  observation: string;
  evidence: string;
  firstIdea: string;
  classId?: string;
}

/**
 * Submit a PROBLEM PROPOSAL (first phase of the entrepreneurial process).
 * Composes the structured fields into the submission text and tags it as a
 * `problem_proposal` so the server scores it with the problem rubric and grants
 * provisional reward XP.
 */
export async function submitProblemProposal(fields: ProblemProposalFields): Promise<SubmissionResult> {
  const studentResponse = [
    `Problém: ${fields.title}`,
    `Koho sa týka: ${fields.affectedGroup}`,
    `Čo som si všimol: ${fields.observation}`,
    `Dôkaz alebo pozorovanie: ${fields.evidence}`,
    `Prvý nápad na riešenie: ${fields.firstIdea}`,
  ].join('\n');
  return submitMission({
    missionId: fields.missionId,
    studentResponse,
    evidenceText: fields.evidence,
    evidenceType: 'text',
    classId: fields.classId,
    submissionKind: 'problem_proposal',
  });
}

/**
 * Submit a structured solution with richer evidence for better AI scoring.
 * Photos are described in text (filename, size, caption) so the existing
 * text-based scorer can boost the evidence signal; the base64 preview stays
 * client-side for now (demo mode shows it in the result card).
 */
export async function submitSolution(fields: SolutionSubmissionFields): Promise<SubmissionResult> {
  const photo = fields.photo;
  const evidenceParts = [fields.evidence.trim()];
  if (photo) {
    const sizeKb = Math.max(1, Math.round(photo.sizeBytes / 1024));
    const photoSummary = [
      `Foto dôkaz: ${photo.fileName} (${photo.mimeType}, ~${sizeKb} kB)`,
      photo.caption?.trim() ? `Popis fotky: ${photo.caption.trim()}` : '',
    ].filter(Boolean).join('\n');
    evidenceParts.push(photoSummary);
  }
  const evidenceText = evidenceParts.filter(Boolean).join('\n');

  const studentResponse = [
    `Riešenie / odpoveď: ${fields.solutionSummary.trim()}`,
    fields.impact?.trim() ? `Prínos / koho sa týka: ${fields.impact.trim()}` : '',
    `Prvý krok: ${fields.firstStep.trim()}`,
    evidenceText ? `Dôkaz: ${evidenceText}` : '',
  ].filter(Boolean).join('\n');

  return submitMission({
    missionId: fields.missionId,
    studentResponse,
    evidenceText,
    evidenceType: 'text',
    classId: fields.classId,
    submissionKind: 'solution_submission',
    studentQuestId: fields.studentQuestId,
  }, photo);
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
