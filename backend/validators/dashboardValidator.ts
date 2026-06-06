/**
 * Validation for dashboard filter query params.
 *
 * Never builds SQL strings — values feed the Supabase query builder
 * (parameterized). UUIDs (school/class) and slugs (mission/competency) are
 * shape-checked; dates must be valid ISO; enums are whitelisted.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9_]{1,80}$/;

export const DASHBOARD_KINDS = ['all', 'problem_proposal', 'solution_submission'] as const;
export type DashboardKind = (typeof DASHBOARD_KINDS)[number];

export const DASHBOARD_STATUSES = [
  'submitted',
  'ai_reviewed',
  'teacher_reviewed',
  'approved',
  'needs_revision',
  'rejected',
] as const;
export type DashboardStatus = (typeof DASHBOARD_STATUSES)[number];

export interface DashboardFilters {
  schoolId?: string;
  classId?: string;
  missionId?: string;
  competencyId?: string;
  from?: string;
  to?: string;
  kind: DashboardKind;
  status?: DashboardStatus;
}

export interface FilterIssue {
  field: string;
  message: string;
}

export type DashboardFilterResult =
  | { ok: true; value: DashboardFilters }
  | { ok: false; issues: FilterIssue[] };

function isIsoDate(value: string): boolean {
  return value.length >= 8 && !Number.isNaN(Date.parse(value));
}

export function validateDashboardFilters(raw: unknown): DashboardFilterResult {
  const issues: FilterIssue[] = [];
  const q = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

  const str = (key: string): string | undefined => (typeof q[key] === 'string' ? (q[key] as string).trim() : undefined);

  const schoolId = str('schoolId');
  if (schoolId !== undefined && !UUID_RE.test(schoolId)) issues.push({ field: 'schoolId', message: 'schoolId musí byť UUID.' });

  const classId = str('classId');
  if (classId !== undefined && !UUID_RE.test(classId)) issues.push({ field: 'classId', message: 'classId musí byť UUID.' });

  const missionId = str('missionId');
  if (missionId !== undefined && !SLUG_RE.test(missionId)) issues.push({ field: 'missionId', message: 'missionId má nepovolený formát.' });

  const competencyId = str('competencyId');
  if (competencyId !== undefined && !SLUG_RE.test(competencyId)) issues.push({ field: 'competencyId', message: 'competencyId má nepovolený formát.' });

  const from = str('from');
  if (from !== undefined && !isIsoDate(from)) issues.push({ field: 'from', message: 'from musí byť platný dátum.' });

  const to = str('to');
  if (to !== undefined && !isIsoDate(to)) issues.push({ field: 'to', message: 'to musí byť platný dátum.' });

  if (from && to && isIsoDate(from) && isIsoDate(to) && Date.parse(from) > Date.parse(to)) {
    issues.push({ field: 'from', message: 'from nesmie byť po to.' });
  }

  const kindRaw = str('kind');
  let kind: DashboardKind = 'all';
  if (kindRaw !== undefined) {
    if (!(DASHBOARD_KINDS as readonly string[]).includes(kindRaw)) {
      issues.push({ field: 'kind', message: `kind musí byť: ${DASHBOARD_KINDS.join(', ')}.` });
    } else {
      kind = kindRaw as DashboardKind;
    }
  }

  const statusRaw = str('status');
  let status: DashboardStatus | undefined;
  if (statusRaw !== undefined) {
    if (!(DASHBOARD_STATUSES as readonly string[]).includes(statusRaw)) {
      issues.push({ field: 'status', message: `status musí byť jeden z povolených.` });
    } else {
      status = statusRaw as DashboardStatus;
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { schoolId, classId, missionId, competencyId, from, to, kind, status } };
}
