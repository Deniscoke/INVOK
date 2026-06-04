import { describe, it, expect } from 'vitest';
import { validateTeacherReviewInput } from '../../backend/validators/teacherReviewValidator';

const base = {
  submissionId: 'sub-1',
  decision: 'approved' as const,
  finalValid: true,
  finalScore: 80,
};

describe('validateTeacherReviewInput', () => {
  it('accepts a valid approved review', () => {
    expect(validateTeacherReviewInput(base).ok).toBe(true);
  });

  it('rejects unknown decision', () => {
    expect(validateTeacherReviewInput({ ...base, decision: 'maybe' }).ok).toBe(false);
  });

  it('requires adjustmentReason when decision = adjusted', () => {
    const without = validateTeacherReviewInput({ ...base, decision: 'adjusted' });
    expect(without.ok).toBe(false);
    const withReason = validateTeacherReviewInput({ ...base, decision: 'adjusted', adjustmentReason: 'Opravil som skóre.' });
    expect(withReason.ok).toBe(true);
  });

  it('requires feedbackText when decision = needs_revision', () => {
    expect(validateTeacherReviewInput({ ...base, decision: 'needs_revision' }).ok).toBe(false);
    expect(validateTeacherReviewInput({ ...base, decision: 'needs_revision', feedbackText: 'Dopracuj prvý krok.' }).ok).toBe(true);
  });

  it('requires feedbackText when decision = rejected', () => {
    expect(validateTeacherReviewInput({ ...base, decision: 'rejected' }).ok).toBe(false);
    expect(validateTeacherReviewInput({ ...base, decision: 'rejected', feedbackText: 'Mimo zadania.' }).ok).toBe(true);
  });

  it('clamps finalScore to 0..100', () => {
    const high = validateTeacherReviewInput({ ...base, finalScore: 250 });
    expect(high.ok).toBe(true);
    if (high.ok) expect(high.value.finalScore).toBe(100);
    const low = validateTeacherReviewInput({ ...base, finalScore: -10 });
    if (low.ok) expect(low.value.finalScore).toBe(0);
  });

  it('rejects HTML/script in feedback or adjustment reason', () => {
    expect(validateTeacherReviewInput({ ...base, feedbackText: '<script>x</script>' }).ok).toBe(false);
    expect(validateTeacherReviewInput({ ...base, decision: 'adjusted', adjustmentReason: '<img onerror=alert(1)>' }).ok).toBe(false);
  });

  it('rejects missing submissionId', () => {
    expect(validateTeacherReviewInput({ ...base, submissionId: '' }).ok).toBe(false);
  });
});
