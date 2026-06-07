/**
 * Frontend dashboard API client.
 *
 * Sends the teacher's Supabase JWT (if any). On failure we behave differently
 * based on the account scope:
 *
 *   • Real Supabase teacher → return an EMPTY dashboard (zeros) so the user
 *     sees the true state of their account instead of fake demo numbers.
 *     Locally cached classes (created via /pilot while the API was down) are
 *     still surfaced so the dashboard reflects what the teacher just set up.
 *
 *   • Demo mode (no Supabase) → keep the rich anonymized mock data — handy
 *     for offline demos and pitch decks.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getSnapshot } from './authService';

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

export interface CompetencyItem {
  id: string;
  childName: string;
  avgProgress: number;
  submissionsCount: number;
  reviewedCount: number;
}

export interface ProblemProposalSummary {
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

export interface DashboardData {
  summary: DashboardSummary;
  competencies: CompetencyItem[];
  proposals: ProblemProposalSummary;
  reviews: ReviewStats;
  /**
   * `api`   — numbers came from the real backend
   * `mock`  — anonymized demo numbers (no Supabase configured)
   * `empty` — real Supabase account, API unreachable: show clean zeros
   */
  source: 'api' | 'mock' | 'empty';
}

/**
 * A "real" teacher account = Supabase is configured AND someone is logged in
 * as a teacher/admin. Used to pick between empty-state and demo-mock fallbacks.
 */
export function isRealTeacherAccount(): boolean {
  if (!isSupabaseConfigured) return false;
  const user = getSnapshot().user;
  return user?.role === 'teacher' || user?.role === 'admin';
}

export interface DashboardFilterParams {
  classId?: string;
  from?: string;
  to?: string;
  kind?: 'all' | 'problem_proposal' | 'solution_submission';
}

function queryString(params: DashboardFilterParams): string {
  const sp = new URLSearchParams();
  if (params.classId) sp.set('classId', params.classId);
  if (params.from) sp.set('from', params.from);
  if (params.to) sp.set('to', params.to);
  if (params.kind && params.kind !== 'all') sp.set('kind', params.kind);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function authHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function getJson<T>(path: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(path, { headers });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as T;
}

export interface DashboardClass {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Local class cache
// ---------------------------------------------------------------------------
// While the serverless API may be temporarily unavailable, classes created
// via /pilot still get an id (mock or real). We cache the minimum metadata
// per-user so the dashboard can reflect them between page loads.
// ---------------------------------------------------------------------------

const CLASS_CACHE_PREFIX = 'invok_dashboard_classes:';

function classCacheKey(): string {
  const user = getSnapshot().user;
  return `${CLASS_CACHE_PREFIX}${user?.id ?? 'demo'}`;
}

function readCachedClasses(): DashboardClass[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(classCacheKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c): c is DashboardClass => !!c && typeof (c as DashboardClass).id === 'string' && typeof (c as DashboardClass).name === 'string')
      .map((c) => ({ id: c.id, name: c.name }));
  } catch {
    return [];
  }
}

function writeCachedClasses(classes: DashboardClass[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(classCacheKey(), JSON.stringify(classes));
  } catch {
    /* ignore quota / privacy errors */
  }
}

/** Remember a class created via /pilot so the dashboard can show it offline. */
export function rememberClass(input: DashboardClass): void {
  if (!input.id || !input.name) return;
  const existing = readCachedClasses();
  if (existing.some((c) => c.id === input.id)) return;
  writeCachedClasses([...existing, { id: input.id, name: input.name }]);
}

/** Cached classes for the current user (empty in demo mode). */
export function getCachedClasses(): DashboardClass[] {
  return isRealTeacherAccount() ? readCachedClasses() : [];
}

/** Drop the local class cache (e.g. on sign-out). */
export function clearCachedClasses(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(classCacheKey());
  } catch {
    /* ignore */
  }
}

/**
 * Real classes for the current teacher/admin.
 *
 *   • API ok           → real classes (and we refresh the local cache).
 *   • API down + real  → locally cached classes (may be empty).
 *   • API down + demo  → two anonymized demo classes so the offline pitch
 *                        deck still renders something sensible.
 */
export async function fetchClasses(): Promise<DashboardClass[]> {
  try {
    const res = await fetch('/api/dashboard/classes', { headers: await authHeaders() });
    if (!res.ok) throw new Error();
    const data = (await res.json()) as { classes: DashboardClass[] };
    const classes = data.classes.map((c) => ({ id: c.id, name: c.name }));
    if (isRealTeacherAccount()) writeCachedClasses(classes);
    return classes;
  } catch {
    if (isRealTeacherAccount()) return readCachedClasses();
    return [
      { id: 'demo-class-a', name: 'Trieda 5.A' },
      { id: 'demo-class-b', name: 'Trieda 5.B' },
    ];
  }
}

export async function fetchDashboard(params: DashboardFilterParams): Promise<DashboardData> {
  const qs = queryString(params);
  try {
    const headers = await authHeaders();
    const [summary, competencies, proposals, reviews] = await Promise.all([
      getJson<DashboardSummary>(`/api/dashboard/summary${qs}`, headers),
      getJson<{ competencies: CompetencyItem[] }>(`/api/dashboard/competencies${qs}`, headers),
      getJson<ProblemProposalSummary>(`/api/dashboard/problem-proposals${qs}`, headers),
      getJson<ReviewStats>(`/api/dashboard/reviews${qs}`, headers),
    ]);
    return { summary, competencies: competencies.competencies, proposals, reviews, source: 'api' };
  } catch {
    return isRealTeacherAccount() ? emptyDashboard() : mockDashboard();
  }
}

export async function downloadDashboardCsv(params: DashboardFilterParams): Promise<void> {
  let csv: string;
  try {
    const res = await fetch(`/api/dashboard/export.csv${queryString(params)}`, { headers: await authHeaders() });
    if (!res.ok) throw new Error();
    csv = await res.text();
  } catch {
    csv = mockCsv();
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'invok-dashboard-export.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// --- Safe anonymized mock (no PII) -----------------------------------------
const MOCK_COMPETENCIES: CompetencyItem[] = [
  { id: 'fact_detective', childName: 'Detektív faktov', avgProgress: 64, submissionsCount: 18, reviewedCount: 11 },
  { id: 'maker_venture', childName: 'Tvorca riešení', avgProgress: 58, submissionsCount: 16, reviewedCount: 9 },
  { id: 'team_builder', childName: 'Staviteľ tímu', avgProgress: 61, submissionsCount: 12, reviewedCount: 7 },
  { id: 'digital_navigator', childName: 'Digitálny navigátor', avgProgress: 49, submissionsCount: 10, reviewedCount: 5 },
  { id: 'community_hero', childName: 'Hrdina komunity', avgProgress: 55, submissionsCount: 9, reviewedCount: 6 },
  { id: 'resource_guardian', childName: 'Strážca zdrojov', avgProgress: 47, submissionsCount: 7, reviewedCount: 4 },
  { id: 'planet_guardian', childName: 'Ochranca planéty', avgProgress: 52, submissionsCount: 8, reviewedCount: 5 },
  { id: 'self_captain', childName: 'Kapitán svojho rastu', avgProgress: 60, submissionsCount: 14, reviewedCount: 9 },
];

export function mockDashboard(): DashboardData {
  return {
    source: 'mock',
    summary: { studentsCount: 24, classesCount: 2, missionsCount: 7, submissionsCount: 86, reviewedCount: 53, pendingReviewCount: 12, problemProposalsCount: 31, totalFinalXp: 4200 },
    competencies: MOCK_COMPETENCIES,
    proposals: { count: 31, avgProblemQualityScore: 72, avgProvisionalXp: 18, avgFinalXp: 14, needsTeacherReview: 9 },
    reviews: { approved: 20, adjusted: 14, needsRevision: 8, rejected: 2, avgAiScore: 76, avgTeacherScore: 72, avgScoreDelta: -4 },
  };
}

/**
 * Empty dashboard shape for a real Supabase account when the API is unreachable.
 * The class count reflects locally cached classes (created via /pilot) so the
 * teacher still sees their own setup progress even while the backend recovers.
 */
export function emptyDashboard(): DashboardData {
  const cachedClasses = readCachedClasses().length;
  return {
    source: 'empty',
    summary: {
      studentsCount: 0,
      classesCount: cachedClasses,
      missionsCount: 0,
      submissionsCount: 0,
      reviewedCount: 0,
      pendingReviewCount: 0,
      problemProposalsCount: 0,
      totalFinalXp: 0,
    },
    competencies: [],
    proposals: { count: 0, avgProblemQualityScore: 0, avgProvisionalXp: 0, avgFinalXp: 0, needsTeacherReview: 0 },
    reviews: { approved: 0, adjusted: 0, needsRevision: 0, rejected: 0, avgAiScore: 0, avgTeacherScore: 0, avgScoreDelta: 0 },
  };
}

function mockCsv(): string {
  return [
    'class_id,mission_id,competency_id,submissions_count,reviewed_count,avg_ai_score,avg_teacher_score,avg_problem_quality_score,total_final_xp,date_from,date_to',
    'demo-class-a,map_school_problem,fact_detective,9,6,74,71,68,420,,',
    'demo-class-a,design_solution,maker_venture,8,5,69,72,0,360,,',
    'demo-class-b,reflect_growth,self_captain,7,4,71,70,0,300,,',
  ].join('\n');
}
