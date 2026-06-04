import { describe, it, expect } from 'vitest';
import { isTeacherOrAdmin, isStudent, requireAuth } from '../../backend/lib/requestContext';
import type { RequestContext } from '../../backend/lib/requestContext';

const teacherCtx: RequestContext = { mode: 'supabase_user', userId: 'u1', role: 'teacher' };
const adminCtx: RequestContext = { mode: 'supabase_user', userId: 'u2', role: 'admin' };
const studentAuthCtx: RequestContext = { mode: 'supabase_user', userId: 'u3', role: 'student' };
const studentSessionCtx: RequestContext = {
  mode: 'student_session',
  studentAccessCodeId: 'code-1',
  pseudonym: 'Líška-07',
  classId: 'class-1',
};
const anonCtx: RequestContext = { mode: 'anonymous' };

describe('isTeacherOrAdmin', () => {
  it('returns true for teacher', () => expect(isTeacherOrAdmin(teacherCtx)).toBe(true));
  it('returns true for admin', () => expect(isTeacherOrAdmin(adminCtx)).toBe(true));
  it('returns false for student (auth)', () => expect(isTeacherOrAdmin(studentAuthCtx)).toBe(false));
  it('returns false for student (session)', () => expect(isTeacherOrAdmin(studentSessionCtx)).toBe(false));
  it('returns false for anonymous', () => expect(isTeacherOrAdmin(anonCtx)).toBe(false));
});

describe('isStudent', () => {
  it('returns true for student_session', () => expect(isStudent(studentSessionCtx)).toBe(true));
  it('returns true for supabase student', () => expect(isStudent(studentAuthCtx)).toBe(true));
  it('returns false for teacher', () => expect(isStudent(teacherCtx)).toBe(false));
  it('returns false for anonymous', () => expect(isStudent(anonCtx)).toBe(false));
});

describe('requireAuth', () => {
  it('passes for any authenticated context', () => {
    expect(requireAuth(teacherCtx)).toBe(true);
    expect(requireAuth(studentSessionCtx)).toBe(true);
  });
  it('fails for anonymous', () => expect(requireAuth(anonCtx)).toBe(false));
});

describe('student session context — never leaks teacher data', () => {
  it('student context has no role field (not teacher/admin)', () => {
    expect('role' in studentSessionCtx).toBe(false);
  });

  it('isTeacherOrAdmin cannot be spoofed via student_session', () => {
    const spoofed = { mode: 'student_session', studentAccessCodeId: 'x', pseudonym: 'y', classId: 'z', role: 'admin' } as unknown as RequestContext;
    expect(isTeacherOrAdmin(spoofed)).toBe(false);
  });
});
