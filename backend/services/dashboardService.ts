/**
 * School/class dashboard reporting (SERVER-ONLY).
 *
 * Produces ANONYMIZED, AGGREGATE-only summaries (counts/averages) for teachers
 * and school admins. It never reads student names/emails/tokens/hashes — only
 * class UUIDs, mission/competency slugs and numeric scores. Aggregation math is
 * pure and unit-tested; the mock and Supabase paths feed the same functions.
 *
 * Scope: teacher → own classes; admin → own school's classes (DB-ready).
 * Do NOT import from frontend code.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestContext } from '../lib/requestContext';
import { isTeacherOrAdmin } from '../lib/requestContext';
import { getServerEnv, missingServerSecrets } from '../lib/env';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { getMissions, getCompetencies } from './missionService';
import type { DashboardFilters } from '../validators/dashboardValidator';

export interface DashboardRecord {
  classId: string | null;
  missionId: string;
  status: string;
  submissionKind: string;
  xpAwarded: number;
  problemQualityScore: number | null;
  problemRewardXp: number;
  aiScore: number | null;
  suggestedTeacherReview: boolean;
  reviewed: boolean;
  decision: string | null;
  finalScore: number | null;
}

export interface DashboardSummary {
  studentsCount: number;
  classesCount: number;
  missionsCount: number;
  submissionsCount: number;
  reviewedCount: number;
  pendingReviewCount: number;
  problemProposalsCount: number;
  totalFinalXp: number;
}

export interface CompetencyProgressItem {
  id: string;
  childName: string;
  avgProgress: number;
  submissionsCount: number;
  reviewedCount: number;
}

export interface ProblemProposalSummaryResult {
  count: number;
  avgProblemQualityScore: number;
  avgProvisionalXp: number;
  avgFinalXp: number;
  needsTeacherReview: number;
}

export interface ReviewStats {
  approved: number;
  adjusted: number;
  needsRevision: number;
  rejected: number;
  avgAiScore: number;
  avgTeacherScore: number;
  avgScoreDelta: number;
}

interface ScopeMeta {
  studentsCount: number;
  classesCount: number;
}

const COMMITTED = new Set(['approved', 'adjusted']);

// ---------------------------------------------------------------------------
// Pure aggregation (unit-tested, no I/O)
// ---------------------------------------------------------------------------
function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

function progressOf(record: DashboardRecord): number {
  return record.finalScore ?? record.aiScore ?? 0;
}

export function summarize(records: DashboardRecord[], meta: ScopeMeta): DashboardSummary {
  const reviewedCount = records.filter((r) => r.reviewed).length;
  return {
    studentsCount: meta.studentsCount,
    classesCount: meta.classesCount,
    missionsCount: new Set(records.map((r) => r.missionId)).size,
    submissionsCount: records.length,
    reviewedCount,
    pendingReviewCount: records.filter((r) => r.suggestedTeacherReview && !r.reviewed).length,
    problemProposalsCount: records.filter((r) => r.submissionKind === 'problem_proposal').length,
    totalFinalXp: records.filter((r) => r.decision && COMMITTED.has(r.decision)).reduce((s, r) => s + r.xpAwarded, 0),
  };
}

export function competencyBreakdown(
  records: DashboardRecord[],
  missionCompetencies: Record<string, string[]>,
  competencies: { id: string; childName: string }[],
): CompetencyProgressItem[] {
  return competencies.map((competency) => {
    const relevant = records.filter((r) => (missionCompetencies[r.missionId] ?? []).includes(competency.id));
    return {
      id: competency.id,
      childName: competency.childName,
      avgProgress: avg(relevant.map(progressOf)),
      submissionsCount: relevant.length,
      reviewedCount: relevant.filter((r) => r.reviewed).length,
    };
  });
}

export function problemProposalBreakdown(records: DashboardRecord[]): ProblemProposalSummaryResult {
  const proposals = records.filter((r) => r.submissionKind === 'problem_proposal');
  const reviewed = proposals.filter((r) => r.reviewed && r.decision && COMMITTED.has(r.decision));
  return {
    count: proposals.length,
    avgProblemQualityScore: avg(proposals.map((r) => r.problemQualityScore ?? 0)),
    avgProvisionalXp: avg(proposals.map((r) => r.problemRewardXp)),
    avgFinalXp: avg(reviewed.map((r) => r.xpAwarded)),
    needsTeacherReview: proposals.filter((r) => r.suggestedTeacherReview && !r.reviewed).length,
  };
}

export function reviewBreakdown(records: DashboardRecord[]): ReviewStats {
  const reviewed = records.filter((r) => r.reviewed && r.decision);
  const count = (decision: string): number => reviewed.filter((r) => r.decision === decision).length;
  const avgAiScore = avg(reviewed.map((r) => r.aiScore ?? 0));
  const avgTeacherScore = avg(reviewed.map((r) => r.finalScore ?? 0));
  return {
    approved: count('approved'),
    adjusted: count('adjusted'),
    needsRevision: count('needs_revision'),
    rejected: count('rejected'),
    avgAiScore,
    avgTeacherScore,
    avgScoreDelta: avgTeacherScore - avgAiScore,
  };
}

function csvField(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function buildCsv(
  records: DashboardRecord[],
  missionCompetencies: Record<string, string[]>,
  filters: DashboardFilters,
): string {
  interface Bucket {
    submissions: number;
    reviewed: number;
    ai: number[];
    teacher: number[];
    quality: number[];
    finalXp: number;
  }
  const buckets = new Map<string, Bucket & { classId: string; missionId: string; competencyId: string }>();

  for (const r of records) {
    for (const competencyId of missionCompetencies[r.missionId] ?? ['(none)']) {
      const key = `${r.classId ?? ''}|${r.missionId}|${competencyId}`;
      const bucket = buckets.get(key) ?? {
        classId: r.classId ?? '',
        missionId: r.missionId,
        competencyId,
        submissions: 0,
        reviewed: 0,
        ai: [],
        teacher: [],
        quality: [],
        finalXp: 0,
      };
      bucket.submissions += 1;
      if (r.reviewed) bucket.reviewed += 1;
      if (r.aiScore !== null) bucket.ai.push(r.aiScore);
      if (r.finalScore !== null) bucket.teacher.push(r.finalScore);
      if (r.problemQualityScore !== null) bucket.quality.push(r.problemQualityScore);
      if (r.decision && COMMITTED.has(r.decision)) bucket.finalXp += r.xpAwarded;
      buckets.set(key, bucket);
    }
  }

  const header = [
    'class_id', 'mission_id', 'competency_id', 'submissions_count', 'reviewed_count',
    'avg_ai_score', 'avg_teacher_score', 'avg_problem_quality_score', 'total_final_xp',
    'date_from', 'date_to',
  ];
  const lines = [header.join(',')];
  for (const b of buckets.values()) {
    lines.push([
      csvField(b.classId), csvField(b.missionId), csvField(b.competencyId),
      b.submissions, b.reviewed, avg(b.ai), avg(b.teacher), avg(b.quality), b.finalXp,
      csvField(filters.from ?? ''), csvField(filters.to ?? ''),
    ].join(','));
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Access + data loading
// ---------------------------------------------------------------------------
export function canAccessDashboard(ctx: RequestContext): boolean {
  return isTeacherOrAdmin(ctx);
}

function isConfigured(): boolean {
  return missingServerSecrets(getServerEnv()).length === 0;
}

function missionCompetencyMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const mission of getMissions()) map[mission.id] = mission.targetCompetencies;
  return map;
}

function applyFilters(records: DashboardRecord[], filters: DashboardFilters): DashboardRecord[] {
  return records.filter((r) => {
    if (filters.classId && r.classId !== filters.classId) return false;
    if (filters.missionId && r.missionId !== filters.missionId) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.kind !== 'all' && r.submissionKind !== filters.kind) return false;
    return true;
  });
}

async function load(ctx: RequestContext, filters: DashboardFilters): Promise<{ records: DashboardRecord[]; meta: ScopeMeta }> {
  if (!canAccessDashboard(ctx)) return { records: [], meta: { studentsCount: 0, classesCount: 0 } };
  if (!isConfigured() || ctx.mode !== 'supabase_user') {
    return { records: applyFilters(mockRecords(), filters), meta: { studentsCount: 24, classesCount: 2 } };
  }
  return dbLoad(ctx, filters);
}

// ---------------------------------------------------------------------------
// Mock path (deterministic, anonymized — no PII)
// ---------------------------------------------------------------------------
function mockRecords(): DashboardRecord[] {
  const missions = getMissions();
  const classes = ['demo-class-a', 'demo-class-b'];
  const decisions = ['approved', 'adjusted', 'needs_revision', 'rejected'];
  const records: DashboardRecord[] = [];

  missions.forEach((mission, mi) => {
    const n = 4 + (mi % 3);
    for (let k = 0; k < n; k += 1) {
      const idx = mi * 10 + k;
      const isProposal = idx % 4 === 0;
      const aiScore = 50 + ((idx * 7) % 50);
      const reviewed = idx % 3 !== 0;
      const decision = reviewed ? decisions[idx % 4] : null;
      const finalScore = reviewed ? Math.max(0, Math.min(100, aiScore + ((idx % 5) - 2) * 3)) : null;
      const committed = decision !== null && COMMITTED.has(decision);
      const baseXp = mission.baseXp;
      const provisional = Math.round(baseXp * (0.1 + (0.3 * aiScore) / 100));
      const xpAwarded = isProposal ? (committed ? provisional : 0) : committed ? Math.round((baseXp * (finalScore ?? 0)) / 100) : 0;
      const status = reviewed
        ? committed ? 'approved' : decision === 'needs_revision' ? 'needs_revision' : 'rejected'
        : 'ai_reviewed';
      records.push({
        classId: classes[idx % 2],
        missionId: mission.id,
        status,
        submissionKind: isProposal ? 'problem_proposal' : 'solution_submission',
        xpAwarded,
        problemQualityScore: isProposal ? aiScore : null,
        problemRewardXp: isProposal ? provisional : 0,
        aiScore,
        suggestedTeacherReview: !reviewed && aiScore < 70,
        reviewed,
        decision,
        finalScore,
      });
    }
  });
  return records;
}

// ---------------------------------------------------------------------------
// DB path (teacher-class scope; school-admin DB-ready)
// ---------------------------------------------------------------------------
async function scopedClassIds(admin: SupabaseClient, ctx: Extract<RequestContext, { mode: 'supabase_user' }>, filters: DashboardFilters): Promise<string[]> {
  let ids: string[] = [];
  if (ctx.role === 'admin') {
    const { data } = await admin
      .from('classes')
      .select('id, school_id, school_memberships:school_memberships!inner(user_id, role)')
      .eq('school_memberships.user_id', ctx.userId)
      .eq('school_memberships.role', 'admin');
    ids = ((data ?? []) as Record<string, unknown>[]).map((c) => String(c.id));
  } else {
    const { data } = await admin
      .from('class_memberships')
      .select('class_id')
      .eq('user_id', ctx.userId)
      .eq('role', 'teacher');
    ids = ((data ?? []) as Record<string, unknown>[]).map((m) => String(m.class_id));
  }
  if (filters.classId) ids = ids.filter((id) => id === filters.classId);
  return ids;
}

async function dbLoad(ctx: Extract<RequestContext, { mode: 'supabase_user' }>, filters: DashboardFilters): Promise<{ records: DashboardRecord[]; meta: ScopeMeta }> {
  try {
    const admin = getSupabaseAdmin();
    const classIds = await scopedClassIds(admin, ctx, filters);
    if (classIds.length === 0) return { records: [], meta: { studentsCount: 0, classesCount: 0 } };

    let query = admin
      .from('submissions')
      .select('class_id, mission_id, status, submission_kind, xp_awarded, problem_quality_score, problem_reward_xp, ai_evaluations(score, suggested_teacher_review), teacher_reviews(decision, final_score)')
      .in('class_id', classIds);
    if (filters.missionId) query = query.eq('mission_id', filters.missionId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.kind !== 'all') query = query.eq('submission_kind', filters.kind);
    if (filters.from) query = query.gte('created_at', filters.from);
    if (filters.to) query = query.lte('created_at', filters.to);

    const { data } = await query;
    const records = ((data ?? []) as Record<string, unknown>[]).map(toRecord);

    const { count } = await admin
      .from('class_memberships')
      .select('id', { count: 'exact', head: true })
      .in('class_id', classIds)
      .eq('role', 'student');

    return { records, meta: { studentsCount: count ?? 0, classesCount: classIds.length } };
  } catch {
    return { records: [], meta: { studentsCount: 0, classesCount: 0 } };
  }
}

function firstOf(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return (value[0] as Record<string, unknown>) ?? null;
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return null;
}

function toRecord(row: Record<string, unknown>): DashboardRecord {
  const ai = firstOf(row.ai_evaluations);
  const review = firstOf(row.teacher_reviews);
  return {
    classId: row.class_id ? String(row.class_id) : null,
    missionId: String(row.mission_id),
    status: String(row.status),
    submissionKind: String(row.submission_kind ?? 'solution_submission'),
    xpAwarded: Number(row.xp_awarded ?? 0),
    problemQualityScore: row.problem_quality_score != null ? Number(row.problem_quality_score) : null,
    problemRewardXp: Number(row.problem_reward_xp ?? 0),
    aiScore: ai && ai.score != null ? Number(ai.score) : null,
    suggestedTeacherReview: Boolean(ai?.suggested_teacher_review),
    reviewed: review !== null,
    decision: review ? String(review.decision) : null,
    finalScore: review && review.final_score != null ? Number(review.final_score) : null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function getTeacherDashboardSummary(ctx: RequestContext, filters: DashboardFilters): Promise<DashboardSummary> {
  const { records, meta } = await load(ctx, filters);
  return summarize(records, meta);
}

export async function getClassDashboardSummary(ctx: RequestContext, classId: string, filters: DashboardFilters): Promise<DashboardSummary> {
  return getTeacherDashboardSummary(ctx, { ...filters, classId });
}

export async function getSchoolDashboardSummary(ctx: RequestContext, schoolId: string, filters: DashboardFilters): Promise<DashboardSummary> {
  return getTeacherDashboardSummary(ctx, { ...filters, schoolId });
}

export async function getCompetencyProgressSummary(ctx: RequestContext, filters: DashboardFilters): Promise<CompetencyProgressItem[]> {
  const { records } = await load(ctx, filters);
  return competencyBreakdown(records, missionCompetencyMap(), getCompetencies().map((c) => ({ id: c.id, childName: c.childName })));
}

export async function getProblemProposalSummary(ctx: RequestContext, filters: DashboardFilters): Promise<ProblemProposalSummaryResult> {
  const { records } = await load(ctx, filters);
  return problemProposalBreakdown(records);
}

export async function getTeacherReviewStats(ctx: RequestContext, filters: DashboardFilters): Promise<ReviewStats> {
  const { records } = await load(ctx, filters);
  return reviewBreakdown(records);
}

export async function getDashboardCsvExport(ctx: RequestContext, filters: DashboardFilters): Promise<string> {
  const { records } = await load(ctx, filters);
  return buildCsv(records, missionCompetencyMap(), filters);
}
