import { describe, it, expect } from 'vitest';
import { createTeacherReview, getTeacherReviewForSubmission, listTeacherReviews } from '../../backend/services/teacherReviewService';
import type { RequestContext } from '../../backend/lib/requestContext';

const anonCtx: RequestContext = { mode: 'anonymous' };
const studentSessionCtx: RequestContext = { mode: 'student_session', studentAccessCodeId: 'c1', pseudonym: 'Líška-07', classId: 'class-1' };
const teacherCtx: RequestContext = { mode: 'supabase_user', userId: 't1', role: 'teacher' };

const review = { submissionId: 'sub-1', decision: 'approved' as const, finalValid: true, finalScore: 80 };

describe('teacher review access control', () => {
  it('anonymous cannot create a review', async () => {
    const result = await createTeacherReview(anonCtx, review);
    expect(result.ok).toBe(false);
  });

  it('student cannot create a review', async () => {
    const result = await createTeacherReview(studentSessionCtx, review);
    expect(result.ok).toBe(false);
  });

  it('student cannot list teacher reviews', async () => {
    const reviews = await listTeacherReviews(studentSessionCtx, {});
    expect(reviews).toHaveLength(0);
  });

  it('anonymous cannot read a review', async () => {
    const result = await getTeacherReviewForSubmission(anonCtx, 'sub-1');
    expect(result).toBeNull();
  });

  it('review result never contains secrets or hashes', async () => {
    const result = await createTeacherReview(teacherCtx, review);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('code_hash');
    expect(serialized).not.toContain('session_token_hash');
    expect(serialized).not.toContain('SERVICE_ROLE');
    expect(serialized).not.toContain('ANTHROPIC_API_KEY');
  });
});
