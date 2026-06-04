import { describe, it, expect } from 'vitest';
import { validateSubmissionInput, validateQueryFilter } from '../../backend/validators/submissionValidator';

describe('validateSubmissionInput', () => {
  const valid = {
    missionId: 'design_solution',
    studentResponse: 'x'.repeat(25),
    evidenceText: 'Dôkaz',
    evidenceType: 'text',
  };

  it('accepts a valid submission', () => {
    expect(validateSubmissionInput(valid).ok).toBe(true);
  });

  it('rejects a response shorter than 20 chars', () => {
    const result = validateSubmissionInput({ ...valid, studentResponse: 'Krátky' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].field).toBe('studentResponse');
  });

  it('rejects HTML/script injection in studentResponse', () => {
    const result = validateSubmissionInput({ ...valid, studentResponse: '<script>alert(1)</script>' + 'x'.repeat(20) });
    expect(result.ok).toBe(false);
  });

  it('rejects HTML injection in evidenceText', () => {
    const result = validateSubmissionInput({ ...valid, evidenceText: '<iframe src="evil.com"></iframe>' });
    expect(result.ok).toBe(false);
  });

  it('rejects disallowed evidenceType', () => {
    const result = validateSubmissionInput({ ...valid, evidenceType: 'video' });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-object body', () => {
    expect(validateSubmissionInput('string').ok).toBe(false);
    expect(validateSubmissionInput(null).ok).toBe(false);
  });

  it('accepts optional classId', () => {
    const result = validateSubmissionInput({ ...valid, classId: 'my-class-id' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.classId).toBe('my-class-id');
  });
});

describe('validateQueryFilter', () => {
  it('accepts valid filters', () => {
    const result = validateQueryFilter({ status: 'submitted', missionId: 'foo', from: '2025-01-01' });
    expect(result.ok).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = validateQueryFilter({ status: 'unknown_status' });
    expect(result.ok).toBe(false);
  });

  it('rejects invalid date', () => {
    const result = validateQueryFilter({ from: 'not-a-date' });
    expect(result.ok).toBe(false);
  });
});
