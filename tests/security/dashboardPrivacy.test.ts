import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  getDashboardCsvExport,
  getTeacherDashboardSummary,
  getCompetencyProgressSummary,
  getProblemProposalSummary,
  getTeacherReviewStats,
} from '../../backend/services/dashboardService';
import type { RequestContext } from '../../backend/lib/requestContext';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../');
const teacher: RequestContext = { mode: 'supabase_user', userId: 't1', role: 'teacher' };

describe('dashboard export never leaks personal data', () => {
  it('CSV has no email / access code / token / hash / pseudonym', async () => {
    const csv = (await getDashboardCsvExport(teacher, { kind: 'all' })).toLowerCase();
    expect(csv).not.toMatch(/@/);
    expect(csv).not.toContain('token');
    expect(csv).not.toContain('hash');
    expect(csv).not.toContain('pseudonym');
    expect(csv).not.toContain('líška');
    expect(csv).not.toContain('sk-proj');
    expect(csv).not.toContain('service_role');
  });

  it('summary/competency/proposal/review JSON contain no PII', async () => {
    const blob = JSON.stringify([
      await getTeacherDashboardSummary(teacher, { kind: 'all' }),
      await getCompetencyProgressSummary(teacher, { kind: 'all' }),
      await getProblemProposalSummary(teacher, { kind: 'all' }),
      await getTeacherReviewStats(teacher, { kind: 'all' }),
    ]);
    expect(blob).not.toMatch(/@/);
    expect(blob).not.toContain('Líška');
    expect(blob.toLowerCase()).not.toContain('token');
    expect(blob.toLowerCase()).not.toContain('hash');
  });
});

describe('frontend dashboard client carries no secrets', () => {
  it('dashboardApi.ts has no email/secret patterns', () => {
    const src = readFileSync(resolve(root, 'frontend', 'src', 'services', 'dashboardApi.ts'), 'utf8');
    expect(src).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(src).not.toContain('sk-proj');
    expect(src).not.toContain('service_role');
    expect(src).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
