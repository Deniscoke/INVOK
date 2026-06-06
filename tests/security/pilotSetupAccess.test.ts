import { describe, it, expect } from 'vitest';
import {
  createSchool,
  createClass,
  generateStudentAccessCodes,
} from '../../backend/services/pilotSetupService';
import type { RequestContext } from '../../backend/lib/requestContext';

const teacher: RequestContext = { mode: 'supabase_user', userId: 't1', role: 'teacher' };
const admin: RequestContext = { mode: 'supabase_user', userId: 'a1', role: 'admin' };
const studentSession: RequestContext = { mode: 'student_session', studentAccessCodeId: 'c', pseudonym: 'Líška-07', classId: 'cl' };
const studentAuth: RequestContext = { mode: 'supabase_user', userId: 's1', role: 'student' };
const anon: RequestContext = { mode: 'anonymous' };
const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('pilot setup access control', () => {
  it('anonymous cannot create a school or class', async () => {
    expect((await createSchool(anon, { schoolName: 'X' })).ok).toBe(false);
    expect((await createClass(anon, { schoolId: UUID, className: 'A' })).ok).toBe(false);
  });

  it('students cannot create classes or generate codes', async () => {
    expect((await createClass(studentSession, { schoolId: UUID, className: 'A' })).ok).toBe(false);
    expect((await createClass(studentAuth, { schoolId: UUID, className: 'A' })).ok).toBe(false);
    expect((await generateStudentAccessCodes(studentSession, { classId: UUID, count: 5, pseudonymPrefix: 'Líška' })).ok).toBe(false);
    expect((await generateStudentAccessCodes(anon, { classId: UUID, count: 5, pseudonymPrefix: 'Líška' })).ok).toBe(false);
  });

  it('admins can create a school; teachers can create a class (mock)', async () => {
    expect((await createSchool(admin, { schoolName: 'ZŠ Pilot' })).ok).toBe(true);
    expect((await createClass(teacher, { schoolId: UUID, className: 'Trieda 5.A' })).ok).toBe(true);
    expect((await generateStudentAccessCodes(teacher, { classId: UUID, count: 3, pseudonymPrefix: 'Líška' })).ok).toBe(true);
  });

  it('responses never contain a service key or hash', async () => {
    const blob = JSON.stringify([
      await createSchool(admin, { schoolName: 'ZŠ Pilot' }),
      await createClass(teacher, { schoolId: UUID, className: 'A' }),
    ]);
    expect(blob).not.toContain('SERVICE_ROLE');
    expect(blob).not.toContain('sk-proj');
    expect(blob).not.toContain('code_hash');
  });
});
