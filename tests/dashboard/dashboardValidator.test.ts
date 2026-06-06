import { describe, it, expect } from 'vitest';
import { validateDashboardFilters } from '../../backend/validators/dashboardValidator';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('validateDashboardFilters', () => {
  it('accepts a valid UUID classId and slug missionId', () => {
    const r = validateDashboardFilters({ classId: UUID, missionId: 'map_school_problem' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.classId).toBe(UUID);
  });

  it('rejects a non-UUID classId', () => {
    expect(validateDashboardFilters({ classId: 'demo-class-a' }).ok).toBe(false);
  });

  it('rejects a missionId with illegal characters', () => {
    expect(validateDashboardFilters({ missionId: 'bad id!' }).ok).toBe(false);
  });

  it('rejects an invalid date', () => {
    expect(validateDashboardFilters({ from: 'not-a-date' }).ok).toBe(false);
  });

  it('rejects from after to', () => {
    expect(validateDashboardFilters({ from: '2026-02-01', to: '2026-01-01' }).ok).toBe(false);
  });

  it('rejects an unknown kind and status', () => {
    expect(validateDashboardFilters({ kind: 'nonsense' }).ok).toBe(false);
    expect(validateDashboardFilters({ status: 'nope' }).ok).toBe(false);
  });

  it('defaults kind to "all" when omitted', () => {
    const r = validateDashboardFilters({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.kind).toBe('all');
  });

  it('accepts valid status and kind', () => {
    const r = validateDashboardFilters({ kind: 'problem_proposal', status: 'approved' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.kind).toBe('problem_proposal');
      expect(r.value.status).toBe('approved');
    }
  });
});
