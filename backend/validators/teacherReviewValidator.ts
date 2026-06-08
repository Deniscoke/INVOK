/**
 * Input validation for teacher reviews.
 *
 * Enforces decision-specific requirements (e.g. an adjustment needs a reason),
 * clamps the final score, and rejects HTML/script payloads in free-text fields.
 */
import { containsDangerousHtml } from './submissionValidator.js';

export const REVIEW_DECISIONS = ['approved', 'adjusted', 'needs_revision', 'rejected'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const REVIEW_LIMITS = {
  feedbackMax: 1500,
  adjustmentReasonMax: 1000,
  submissionIdMax: 80,
} as const;

export interface TeacherReviewInput {
  submissionId: string;
  aiEvaluationId?: string;
  decision: ReviewDecision;
  finalValid: boolean;
  finalScore: number;
  feedbackText?: string;
  adjustmentReason?: string;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export type ReviewValidationResult =
  | { ok: true; value: TeacherReviewInput }
  | { ok: false; issues: ValidationIssue[] };

function isDecision(value: unknown): value is ReviewDecision {
  return typeof value === 'string' && (REVIEW_DECISIONS as readonly string[]).includes(value);
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function validateTeacherReviewInput(raw: unknown): ReviewValidationResult {
  const issues: ValidationIssue[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, issues: [{ field: 'body', message: 'Telo požiadavky musí byť JSON objekt.' }] };
  }
  const body = raw as Record<string, unknown>;

  // submissionId
  if (typeof body.submissionId !== 'string' || body.submissionId.trim().length === 0) {
    issues.push({ field: 'submissionId', message: 'submissionId je povinný.' });
  } else if (body.submissionId.length > REVIEW_LIMITS.submissionIdMax) {
    issues.push({ field: 'submissionId', message: 'submissionId je príliš dlhý.' });
  }

  // aiEvaluationId (optional)
  if (body.aiEvaluationId !== undefined && body.aiEvaluationId !== null && typeof body.aiEvaluationId !== 'string') {
    issues.push({ field: 'aiEvaluationId', message: 'aiEvaluationId musí byť reťazec.' });
  }

  // decision
  if (!isDecision(body.decision)) {
    issues.push({ field: 'decision', message: `decision musí byť: ${REVIEW_DECISIONS.join(', ')}.` });
  }

  // finalValid
  if (typeof body.finalValid !== 'boolean') {
    issues.push({ field: 'finalValid', message: 'finalValid musí byť boolean.' });
  }

  // finalScore
  if (typeof body.finalScore !== 'number' || Number.isNaN(body.finalScore)) {
    issues.push({ field: 'finalScore', message: 'finalScore musí byť číslo.' });
  }

  // free-text fields
  const feedbackText = typeof body.feedbackText === 'string' ? body.feedbackText : undefined;
  if (feedbackText !== undefined) {
    if (feedbackText.length > REVIEW_LIMITS.feedbackMax) {
      issues.push({ field: 'feedbackText', message: `feedbackText je príliš dlhý (max ${REVIEW_LIMITS.feedbackMax}).` });
    } else if (containsDangerousHtml(feedbackText)) {
      issues.push({ field: 'feedbackText', message: 'feedbackText obsahuje zakázané HTML alebo scripty.' });
    }
  }

  const adjustmentReason = typeof body.adjustmentReason === 'string' ? body.adjustmentReason : undefined;
  if (adjustmentReason !== undefined) {
    if (adjustmentReason.length > REVIEW_LIMITS.adjustmentReasonMax) {
      issues.push({ field: 'adjustmentReason', message: `adjustmentReason je príliš dlhý (max ${REVIEW_LIMITS.adjustmentReasonMax}).` });
    } else if (containsDangerousHtml(adjustmentReason)) {
      issues.push({ field: 'adjustmentReason', message: 'adjustmentReason obsahuje zakázané HTML alebo scripty.' });
    }
  }

  // Decision-specific requirements
  if (isDecision(body.decision)) {
    if (body.decision === 'adjusted' && (!adjustmentReason || adjustmentReason.trim().length === 0)) {
      issues.push({ field: 'adjustmentReason', message: 'Pri úprave (adjusted) je potrebný dôvod úpravy.' });
    }
    if ((body.decision === 'needs_revision' || body.decision === 'rejected') && (!feedbackText || feedbackText.trim().length === 0)) {
      issues.push({ field: 'feedbackText', message: 'Pri vrátení/zamietnutí je potrebná spätná väzba.' });
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    value: {
      submissionId: (body.submissionId as string).trim(),
      aiEvaluationId: typeof body.aiEvaluationId === 'string' ? body.aiEvaluationId : undefined,
      decision: body.decision as ReviewDecision,
      finalValid: body.finalValid as boolean,
      finalScore: clampScore(body.finalScore as number),
      feedbackText: feedbackText?.trim(),
      adjustmentReason: adjustmentReason?.trim(),
    },
  };
}
