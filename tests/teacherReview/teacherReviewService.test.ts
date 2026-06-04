import { describe, it, expect } from 'vitest';
import { createTeacherReview, canReviewSubmission } from '../../backend/services/teacherReviewService';
import { finalXpForReview } from '../../backend/services/progressService';
import type { RequestContext } from '../../backend/lib/requestContext';

const teacherCtx: RequestContext = { mode: 'supabase_user', userId: 't1', role: 'teacher' };
const studentSessionCtx: RequestContext = { mode: 'student_session', studentAccessCodeId: 'c1', pseudonym: 'Líška-07', classId: 'class-1' };
const studentAuthCtx: RequestContext = { mode: 'supabase_user', userId: 's1', role: 'student' };

const approved = { submissionId: 'sub-1', decision: 'approved' as const, finalValid: true, finalScore: 80 };

describe('createTeacherReview (mock path)', () => {
  it('teacher can create a review', async () => {
    const result = await createTeacherReview(teacherCtx, approved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.review.decision).toBe('approved');
      expect(result.newStatus).toBe('approved');
      expect(result.finalXp).toBeGreaterThan(0);
    }
  });

  it('student (session) CANNOT create a review', async () => {
    const result = await createTeacherReview(studentSessionCtx, approved);
    expect(result.ok).toBe(false);
  });

  it('student (auth) CANNOT create a review', async () => {
    const result = await createTeacherReview(studentAuthCtx, approved);
    expect(result.ok).toBe(false);
  });

  it('adjusted without reason is rejected', async () => {
    const result = await createTeacherReview(teacherCtx, { ...approved, decision: 'adjusted' });
    expect(result.ok).toBe(false);
  });
});

describe('canReviewSubmission', () => {
  it('true for teacher, false for students', () => {
    expect(canReviewSubmission(teacherCtx)).toBe(true);
    expect(canReviewSubmission(studentSessionCtx)).toBe(false);
    expect(canReviewSubmission(studentAuthCtx)).toBe(false);
  });
});

describe('finalXpForReview (progress rules by decision)', () => {
  it('approved/adjusted award XP scaled by score', () => {
    expect(finalXpForReview(100, 80, 'approved')).toBe(80);
    expect(finalXpForReview(150, 50, 'adjusted')).toBe(75);
  });

  it('needs_revision and rejected award NO XP', () => {
    expect(finalXpForReview(100, 90, 'needs_revision')).toBe(0);
    expect(finalXpForReview(100, 90, 'rejected')).toBe(0);
  });

  it('clamps score before scaling', () => {
    expect(finalXpForReview(100, 250, 'approved')).toBe(100);
    expect(finalXpForReview(100, -50, 'approved')).toBe(0);
  });
});
