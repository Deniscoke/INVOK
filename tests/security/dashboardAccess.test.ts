import { describe, it, expect } from 'vitest';
import { canAccessDashboard, getTeacherDashboardSummary, getDashboardCsvExport } from '../../backend/services/dashboardService';
import type { RequestContext } from '../../backend/lib/requestContext';

const teacher: RequestContext = { mode: 'supabase_user', userId: 't1', role: 'teacher' };
const admin: RequestContext = { mode: 'supabase_user', userId: 'a1', role: 'admin' };
const studentSession: RequestContext = { mode: 'student_session', studentAccessCodeId: 'c', pseudonym: 'Líška-07', classId: 'cl' };
const studentAuth: RequestContext = { mode: 'supabase_user', userId: 's1', role: 'student' };
const anon: RequestContext = { mode: 'anonymous' };

describe('canAccessDashboard', () => {
  it('allows teacher and admin only', () => {
    expect(canAccessDashboard(teacher)).toBe(true);
    expect(canAccessDashboard(admin)).toBe(true);
    expect(canAccessDashboard(studentSession)).toBe(false);
    expect(canAccessDashboard(studentAuth)).toBe(false);
    expect(canAccessDashboard(anon)).toBe(false);
  });
});

describe('scoped data access', () => {
  it('returns no data to a student', async () => {
    const s = await getTeacherDashboardSummary(studentSession, { kind: 'all' });
    expect(s.submissionsCount).toBe(0);
    expect(s.totalFinalXp).toBe(0);
  });

  it('returns no data to anonymous', async () => {
    const s = await getTeacherDashboardSummary(anon, { kind: 'all' });
    expect(s.submissionsCount).toBe(0);
  });

  it('returns aggregated data to a teacher (mock path)', async () => {
    const s = await getTeacherDashboardSummary(teacher, { kind: 'all' });
    expect(s.submissionsCount).toBeGreaterThan(0);
    expect(s.classesCount).toBeGreaterThan(0);
  });

  it('CSV export for a non-teacher is header-only (no rows)', async () => {
    const csv = await getDashboardCsvExport(anon, { kind: 'all' });
    expect(csv.split('\n').length).toBe(1);
  });
});
