import { describe, it, expect } from 'vitest';
import { createSubmission, getOwnSubmissions, getStudentProgress } from '../../backend/services/submissionService';
import type { RequestContext } from '../../backend/lib/requestContext';

const studentCtx: RequestContext = {
  mode: 'student_session',
  studentAccessCodeId: 'mock-access-code',
  pseudonym: 'Líška-07',
  classId: 'demo-class',
};

const teacherCtx: RequestContext = {
  mode: 'supabase_user',
  userId: 'dev-teacher',
  role: 'teacher',
};

const anonCtx: RequestContext = { mode: 'anonymous' };

describe('createSubmission (mock path)', () => {
  it('creates a valid submission and returns evaluation shape', async () => {
    const result = await createSubmission(studentCtx, {
      missionId: 'design_solution',
      studentResponse: 'Navrhujem riešenie, pretože som pozoroval problém v jedálni. Prvý krok je rozdeliť triedy.',
      evidenceText: 'Sledoval som situáciu tri dni.',
      evidenceType: 'text',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.submissionId).toBe('string');
      expect(result.submissionId.length).toBeGreaterThan(0);
      expect(typeof result.xpAwarded).toBe('number');
      expect(result.xpAwarded).toBeGreaterThanOrEqual(0);
      expect(result.evaluation).toBeDefined();
      if (result.evaluation) {
        expect(typeof result.evaluation.valid).toBe('boolean');
        expect(result.evaluation.score).toBeGreaterThanOrEqual(0);
        expect(result.evaluation.score).toBeLessThanOrEqual(100);
        expect(typeof result.evaluation.suggestedTeacherReview).toBe('boolean');
      }
    }
  });

  it('rejects anonymous context', async () => {
    const result = await createSubmission(anonCtx, {
      missionId: 'design_solution',
      studentResponse: 'x'.repeat(30),
      evidenceText: '',
      evidenceType: 'text',
    });
    expect(result.ok).toBe(false);
  });
});

describe('getOwnSubmissions (mock path)', () => {
  it('returns submissions for authenticated student', async () => {
    const subs = await getOwnSubmissions(studentCtx);
    expect(Array.isArray(subs)).toBe(true);
  });

  it('returns empty for anonymous', async () => {
    const subs = await getOwnSubmissions(anonCtx);
    expect(subs).toHaveLength(0);
  });
});

describe('getStudentProgress (mock path)', () => {
  it('returns valid progress shape', async () => {
    const progress = await getStudentProgress(studentCtx);
    expect(typeof progress.totalXp).toBe('number');
    expect(typeof progress.level).toBe('number');
    expect(progress.level).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(progress.competencyProgress)).toBe(true);
  });

  it('teacher context returns valid progress shape too', async () => {
    const progress = await getStudentProgress(teacherCtx);
    expect(typeof progress.totalXp).toBe('number');
  });
});
