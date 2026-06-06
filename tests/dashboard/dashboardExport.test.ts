import { describe, it, expect } from 'vitest';
import { buildCsv, getDashboardCsvExport, type DashboardRecord } from '../../backend/services/dashboardService';
import type { RequestContext } from '../../backend/lib/requestContext';

const teacher: RequestContext = { mode: 'supabase_user', userId: 't1', role: 'teacher' };

const records: DashboardRecord[] = [
  { classId: 'c1', missionId: 'A', status: 'approved', submissionKind: 'solution_submission', xpAwarded: 72, problemQualityScore: null, problemRewardXp: 0, aiScore: 80, suggestedTeacherReview: false, reviewed: true, decision: 'approved', finalScore: 90 },
  { classId: 'c1', missionId: 'A', status: 'ai_reviewed', submissionKind: 'problem_proposal', xpAwarded: 0, problemQualityScore: 65, problemRewardXp: 18, aiScore: 65, suggestedTeacherReview: true, reviewed: false, decision: null, finalScore: null },
];

const HEADER = 'class_id,mission_id,competency_id,submissions_count,reviewed_count,avg_ai_score,avg_teacher_score,avg_problem_quality_score,total_final_xp,date_from,date_to';

describe('buildCsv', () => {
  const csv = buildCsv(records, { A: ['fact_detective'] }, { kind: 'all' });

  it('has the expected aggregate header', () => {
    expect(csv.split('\n')[0]).toBe(HEADER);
  });

  it('emits a row per class/mission/competency', () => {
    expect(csv).toContain('c1,A,fact_detective');
  });

  it('contains no personal data, tokens or hashes', () => {
    expect(csv).not.toMatch(/@/);
    expect(csv.toLowerCase()).not.toContain('token');
    expect(csv.toLowerCase()).not.toContain('hash');
    expect(csv).not.toContain('Líška');
  });
});

describe('getDashboardCsvExport (mock path)', () => {
  it('returns an anonymized CSV for a teacher', async () => {
    const csv = await getDashboardCsvExport(teacher, { kind: 'all' });
    expect(csv.startsWith(HEADER)).toBe(true);
    expect(csv.split('\n').length).toBeGreaterThan(1);
    expect(csv).not.toMatch(/@/);
  });
});
