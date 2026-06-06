import { describe, it, expect } from 'vitest';
import { listClassesForTeacher } from '../../backend/services/pilotSetupService';
import type { RequestContext } from '../../backend/lib/requestContext';

const teacher: RequestContext = { mode: 'supabase_user', userId: 't1', role: 'teacher' };
const admin: RequestContext = { mode: 'supabase_user', userId: 'a1', role: 'admin' };
const studentSession: RequestContext = { mode: 'student_session', studentAccessCodeId: 'c', pseudonym: 'Líška-07', classId: 'cl' };
const anon: RequestContext = { mode: 'anonymous' };

describe('dashboard classes', () => {
  it('returns classes for a teacher/admin (mock)', async () => {
    const teacherClasses = await listClassesForTeacher(teacher);
    expect(teacherClasses.length).toBeGreaterThan(0);
    expect(teacherClasses[0]).toHaveProperty('id');
    expect(teacherClasses[0]).toHaveProperty('name');
    expect((await listClassesForTeacher(admin)).length).toBeGreaterThan(0);
  });

  it('returns nothing to a student or anonymous user', async () => {
    expect(await listClassesForTeacher(studentSession)).toHaveLength(0);
    expect(await listClassesForTeacher(anon)).toHaveLength(0);
  });

  it('class list carries no personal data', async () => {
    const serialized = JSON.stringify(await listClassesForTeacher(teacher));
    expect(serialized).not.toMatch(/@/);
    expect(serialized.toLowerCase()).not.toContain('hash');
  });
});
