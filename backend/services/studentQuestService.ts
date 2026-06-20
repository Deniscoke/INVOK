/**
 * Student quest CRUD + lifecycle (SERVER-ONLY).
 *
 * Quests are student-proposed (or AI-drafted) tasks that go through a
 * teacher-approved state machine before they can be submitted. The state
 * machine and the max-5-active limit are enforced at the DB level (see
 * supabase/migrations/007_student_quests.sql).
 *
 * Pseudonymity: each quest is anchored to a `student_access_codes` row, NOT
 * to a `profiles` row, because students authenticate without an email.
 *
 * MOCK fallback: when Supabase isn't configured we return informative errors
 * — the frontend already has its own localStorage fallback for demo mode.
 */
import { getServerEnv, missingServerSecrets } from '../lib/env.js';
import { verifyStudentSession } from './studentAccessService.js';
import type { ValidationIssue } from './studentAccessService.js';
import { listQuestFiles, type QuestFile } from '../lib/storage.js';

export type QuestSource = 'student' | 'ai';

export type QuestState =
  | 'draft'
  | 'pending_approval'
  | 'changes_requested'
  | 'approved'
  | 'submitted'
  | 'completed'
  | 'rejected';

export interface StudentQuest {
  id: string;
  studentAccessCodeId: string;
  classId: string;
  studentAlias?: string; // joined from student_access_codes
  title: string;
  description: string | null;
  goal: string;
  affectedGroup: string | null;
  evidence: string | null;
  firstIdea: string | null;
  source: QuestSource;
  aiModel: string | null;
  state: QuestState;
  proposedDeadline: string | null;
  approvedDeadline: string | null;
  teacherFeedback: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  submissionId: string | null;
  xpEstimate: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuestInput {
  title: string;
  description?: string;
  goal: string;
  affectedGroup?: string;
  evidence?: string;
  firstIdea?: string;
  source: QuestSource;
  proposedDeadline?: string;
  missionTemplateId?: string;
  aiModel?: string;
  aiPrompt?: string;
}

export type ServiceResult<T> =
  | { ok: true; data: T; source: 'db' | 'mock' }
  | { ok: false; error: string; status?: number };

const MAX_ACTIVE_QUESTS = 5;

function isConfigured(): boolean {
  return missingServerSecrets(getServerEnv()).length === 0;
}

function mockUnavailable<T>(): ServiceResult<T> {
  return {
    ok: false,
    error:
      'Supabase backend nie je nastavený – v demo režime sa misie ukladajú lokálne v prehliadači.',
    status: 503,
  };
}

function validateCreate(input: unknown): { ok: true; value: CreateQuestInput } | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const body = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (title.length < 3 || title.length > 160) {
    issues.push({ field: 'title', message: 'Názov misie musí mať 3–160 znakov.' });
  }
  const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
  if (goal.length < 10) {
    issues.push({ field: 'goal', message: 'Cieľ misie musí mať aspoň 10 znakov.' });
  }
  const source = body.source === 'ai' ? 'ai' : body.source === 'student' ? 'student' : null;
  if (!source) {
    issues.push({ field: 'source', message: 'Zdroj misie musí byť „student“ alebo „ai“.' });
  }
  const proposedDeadline = typeof body.proposedDeadline === 'string' ? body.proposedDeadline : undefined;
  if (proposedDeadline && !/^\d{4}-\d{2}-\d{2}$/.test(proposedDeadline)) {
    issues.push({ field: 'proposedDeadline', message: 'Termín musí byť dátum vo formáte YYYY-MM-DD.' });
  }

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      title,
      goal,
      source: source as QuestSource,
      description: typeof body.description === 'string' ? body.description.trim().slice(0, 4000) : undefined,
      affectedGroup: typeof body.affectedGroup === 'string' ? body.affectedGroup.trim().slice(0, 200) : undefined,
      evidence: typeof body.evidence === 'string' ? body.evidence.trim().slice(0, 2000) : undefined,
      firstIdea: typeof body.firstIdea === 'string' ? body.firstIdea.trim().slice(0, 2000) : undefined,
      proposedDeadline,
      missionTemplateId: typeof body.missionTemplateId === 'string' ? body.missionTemplateId : undefined,
      aiModel: typeof body.aiModel === 'string' ? body.aiModel : undefined,
      aiPrompt: typeof body.aiPrompt === 'string' ? body.aiPrompt.slice(0, 4000) : undefined,
    },
  };
}

function mapRow(row: Record<string, unknown>): StudentQuest {
  const access = row.student_access_codes as Record<string, unknown> | undefined;
  return {
    id: String(row.id),
    studentAccessCodeId: String(row.student_access_code_id),
    classId: String(row.class_id),
    studentAlias: access ? String(access.pseudonym ?? '') : undefined,
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    goal: String(row.goal),
    affectedGroup: (row.affected_group as string | null) ?? null,
    evidence: (row.evidence as string | null) ?? null,
    firstIdea: (row.first_idea as string | null) ?? null,
    source: row.source === 'ai' ? 'ai' : 'student',
    aiModel: (row.ai_model as string | null) ?? null,
    state: row.state as QuestState,
    proposedDeadline: (row.proposed_deadline as string | null) ?? null,
    approvedDeadline: (row.approved_deadline as string | null) ?? null,
    teacherFeedback: (row.teacher_feedback as string | null) ?? null,
    approvedBy: (row.approved_by as string | null) ?? null,
    approvedAt: (row.approved_at as string | null) ?? null,
    submissionId: (row.submission_id as string | null) ?? null,
    xpEstimate: Number(row.xp_estimate ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Student-side operations (require a session token)
// ---------------------------------------------------------------------------

export async function listOwnQuests(sessionToken: string): Promise<ServiceResult<StudentQuest[]>> {
  if (!isConfigured()) return mockUnavailable();
  const session = await verifyStudentSession(sessionToken);
  if (!session.valid || !session.studentAccessCodeId) {
    return { ok: false, error: 'Neplatná študentská session.', status: 401 };
  }
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('student_quests')
      .select('*, student_access_codes(pseudonym)')
      .eq('student_access_code_id', session.studentAccessCodeId)
      .order('created_at', { ascending: false });
    if (error) return { ok: false, error: error.message, status: 500 };
    const rows = (data ?? []) as Record<string, unknown>[];
    return { ok: true, data: rows.map(mapRow), source: 'db' };
  } catch {
    return { ok: false, error: 'Načítanie misií zlyhalo.', status: 500 };
  }
}

export async function createOwnQuest(
  sessionToken: string,
  input: unknown,
): Promise<ServiceResult<StudentQuest>> {
  if (!isConfigured()) return mockUnavailable();
  const session = await verifyStudentSession(sessionToken);
  if (!session.valid || !session.studentAccessCodeId || !session.classId) {
    return { ok: false, error: 'Neplatná študentská session.', status: 401 };
  }
  const validation = validateCreate(input);
  if (!validation.ok) {
    return { ok: false, error: validation.issues.map((i) => i.message).join(' '), status: 400 };
  }
  const value = validation.value;

  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
    const admin = getSupabaseAdmin();

    // Pre-flight: enforce the 5-active limit. The DB trigger is the source
    // of truth, but checking here gives us a friendly error before the
    // exception path.
    const { count } = await admin
      .from('student_quests')
      .select('id', { count: 'exact', head: true })
      .eq('student_access_code_id', session.studentAccessCodeId)
      .not('state', 'in', '("completed","rejected")');
    if ((count ?? 0) >= MAX_ACTIVE_QUESTS) {
      return {
        ok: false,
        error:
          'Máš už 5 aktívnych misií. Najprv niektorú dokonči alebo zruš, potom môžeš pridať novú.',
        status: 409,
      };
    }

    const { data, error } = await admin
      .from('student_quests')
      .insert({
        student_access_code_id: session.studentAccessCodeId,
        class_id: session.classId,
        title: value.title,
        description: value.description ?? null,
        goal: value.goal,
        affected_group: value.affectedGroup ?? null,
        evidence: value.evidence ?? null,
        first_idea: value.firstIdea ?? null,
        source: value.source,
        ai_model: value.aiModel ?? null,
        ai_prompt: value.aiPrompt ?? null,
        proposed_deadline: value.proposedDeadline ?? null,
        mission_template_id: value.missionTemplateId ?? null,
        state: 'pending_approval',
      })
      .select('*, student_access_codes(pseudonym)')
      .single();
    if (error) {
      if (error.message.includes('STUDENT_QUEST_LIMIT_REACHED')) {
        return { ok: false, error: 'Limit 5 aktívnych misií dosiahnutý.', status: 409 };
      }
      return { ok: false, error: error.message, status: 500 };
    }
    return { ok: true, data: mapRow(data as Record<string, unknown>), source: 'db' };
  } catch {
    return { ok: false, error: 'Uloženie misie zlyhalo.', status: 500 };
  }
}

export async function deleteOwnQuest(
  sessionToken: string,
  questId: string,
): Promise<ServiceResult<{ deleted: boolean }>> {
  if (!isConfigured()) return mockUnavailable();
  const session = await verifyStudentSession(sessionToken);
  if (!session.valid || !session.studentAccessCodeId) {
    return { ok: false, error: 'Neplatná študentská session.', status: 401 };
  }
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
    const admin = getSupabaseAdmin();
    const { data: existing } = await admin
      .from('student_quests')
      .select('id, state, student_access_code_id')
      .eq('id', questId)
      .maybeSingle();
    const row = existing as Record<string, unknown> | null;
    if (!row || row.student_access_code_id !== session.studentAccessCodeId) {
      return { ok: false, error: 'Misia sa nenašla.', status: 404 };
    }
    if (row.state === 'approved' || row.state === 'submitted' || row.state === 'completed') {
      return {
        ok: false,
        error: 'Schválenú alebo odovzdanú misiu už nemôžeš sám zmazať — popros učiteľa.',
        status: 409,
      };
    }
    const { error } = await admin.from('student_quests').delete().eq('id', questId);
    if (error) return { ok: false, error: error.message, status: 500 };
    return { ok: true, data: { deleted: true }, source: 'db' };
  } catch {
    return { ok: false, error: 'Mazanie zlyhalo.', status: 500 };
  }
}

// ---------------------------------------------------------------------------
// Submission integration (called from submissionService when a student
// odovzdá riešenie a uvedie `studentQuestId`).
// ---------------------------------------------------------------------------

/**
 * Load a quest by id for a given pseudonymous student. Returns null if the
 * quest does not belong to the student, or if Supabase isn't configured.
 *
 * Caller is expected to enforce that the state is `approved` (or
 * `changes_requested`) before allowing a submission.
 */
export async function loadQuestForStudent(
  studentAccessCodeId: string,
  questId: string,
): Promise<StudentQuest | null> {
  if (!isConfigured()) return null;
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('student_quests')
      .select('*, student_access_codes(pseudonym)')
      .eq('id', questId)
      .maybeSingle();
    const row = data as Record<string, unknown> | null;
    if (!row) return null;
    if (row.student_access_code_id !== studentAccessCodeId) return null;
    return mapRow(row);
  } catch {
    return null;
  }
}

/**
 * Mark a quest as `submitted` and link the submission back to it.
 *
 * Idempotent — safe to call if the quest is already `submitted` or
 * `completed`. Logs but does not throw on DB errors (a failed transition
 * must never break the submission flow).
 */
export async function markQuestSubmitted(questId: string, submissionId: string): Promise<void> {
  if (!isConfigured()) return;
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
    const admin = getSupabaseAdmin();
    await admin
      .from('student_quests')
      .update({ state: 'submitted', submission_id: submissionId })
      .eq('id', questId)
      .in('state', ['approved', 'changes_requested']);
  } catch {
    /* best-effort */
  }
}

/**
 * Reflect a teacher review back into the quest state.
 *   - approved / adjusted  → completed
 *   - needs_revision       → changes_requested (student can edit + resubmit)
 *   - rejected             → rejected (terminal)
 *
 * Idempotent and silent on errors.
 */
export async function reflectReviewOnQuest(
  submissionId: string,
  decision: 'approved' | 'adjusted' | 'needs_revision' | 'rejected',
): Promise<void> {
  if (!isConfigured()) return;
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
    const admin = getSupabaseAdmin();
    const nextState: QuestState | null =
      decision === 'approved' || decision === 'adjusted' ? 'completed' :
      decision === 'needs_revision' ? 'changes_requested' :
      decision === 'rejected' ? 'rejected' :
      null;
    if (!nextState) return;
    await admin
      .from('student_quests')
      .update({ state: nextState })
      .eq('submission_id', submissionId);
  } catch {
    /* best-effort */
  }
}

// ---------------------------------------------------------------------------
// Teacher-side operations
// (called from /api/teacher/* under an authenticated Supabase request context)
// ---------------------------------------------------------------------------

import type { RequestContext } from '../lib/requestContext.js';

export async function listClassPendingQuests(
  ctx: RequestContext,
  classId?: string,
): Promise<ServiceResult<StudentQuest[]>> {
  if (ctx.mode !== 'supabase_user' || (ctx.role !== 'teacher' && ctx.role !== 'admin')) {
    return { ok: false, error: 'Iba učiteľ/admin.', status: 403 };
  }
  const teacherUserId = ctx.userId;
  const teacherRole = ctx.role;
  if (!isConfigured()) return mockUnavailable();
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
    const admin = getSupabaseAdmin();

    // Resolve which classes this teacher manages — use class_memberships.
    const { data: memberships } = await admin
      .from('class_memberships')
      .select('class_id')
      .eq('user_id', teacherUserId)
      .eq('role', 'teacher');
    const classIds = ((memberships ?? []) as Array<{ class_id: string }>).map((m) => m.class_id);
    if (classIds.length === 0) {
      return { ok: true, data: [], source: 'db' };
    }
    const filterIds = classId ? classIds.filter((id) => id === classId) : classIds;
    if (filterIds.length === 0) {
      return { ok: false, error: 'Túto triedu neviem priradiť k tebe.', status: 403 };
    }

    const { data, error } = await admin
      .from('student_quests')
      .select('*, student_access_codes(pseudonym)')
      .in('class_id', filterIds)
      .in('state', ['pending_approval', 'changes_requested', 'approved', 'submitted'])
      .order('created_at', { ascending: false });
    if (error) return { ok: false, error: error.message, status: 500 };
    const rows = (data ?? []) as Record<string, unknown>[];
    return { ok: true, data: rows.map(mapRow), source: 'db' };
  } catch {
    return { ok: false, error: 'Načítanie misií zlyhalo.', status: 500 };
  }
}

/** List a quest's uploaded attachments (teacher who manages the class, or admin). */
export async function listQuestAttachments(ctx: RequestContext, questId: string): Promise<ServiceResult<QuestFile[]>> {
  if (ctx.mode !== 'supabase_user' || (ctx.role !== 'teacher' && ctx.role !== 'admin')) {
    return { ok: false, error: 'Iba učiteľ/admin.', status: 403 };
  }
  if (!isConfigured()) return mockUnavailable();
  if (!questId) return { ok: false, error: 'Chýba ID misie.', status: 400 };
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
    const admin = getSupabaseAdmin();
    const { data } = await admin.from('student_quests').select('class_id').eq('id', questId).maybeSingle();
    const row = data as Record<string, unknown> | null;
    if (!row) return { ok: false, error: 'Misia sa nenašla.', status: 404 };
    if (ctx.role !== 'admin') {
      const { data: membership } = await admin
        .from('class_memberships')
        .select('id')
        .eq('class_id', row.class_id as string)
        .eq('user_id', ctx.userId)
        .eq('role', 'teacher')
        .maybeSingle();
      if (!membership) return { ok: false, error: 'Túto triedu neučíš.', status: 403 };
    }
    return { ok: true, data: await listQuestFiles(questId), source: 'db' };
  } catch {
    return { ok: false, error: 'Načítanie príloh zlyhalo.', status: 500 };
  }
}

export type ApprovalDecision = 'approve' | 'request_changes' | 'reject';

export interface ApproveInput {
  questId: string;
  decision: ApprovalDecision;
  teacherFeedback?: string;
  approvedDeadline?: string; // YYYY-MM-DD
  xpEstimate?: number;
}

const TERMINAL_STATES: QuestState[] = ['completed', 'rejected'];

export async function reviewQuest(
  ctx: RequestContext,
  input: ApproveInput,
): Promise<ServiceResult<StudentQuest>> {
  if (ctx.mode !== 'supabase_user' || (ctx.role !== 'teacher' && ctx.role !== 'admin')) {
    return { ok: false, error: 'Iba učiteľ/admin.', status: 403 };
  }
  const teacherUserId = ctx.userId;
  const teacherRole = ctx.role;
  if (!isConfigured()) return mockUnavailable();
  if (!input || !input.questId || !input.decision) {
    return { ok: false, error: 'Chýba ID misie alebo rozhodnutie.', status: 400 };
  }
  const allowed: ApprovalDecision[] = ['approve', 'request_changes', 'reject'];
  if (!allowed.includes(input.decision)) {
    return { ok: false, error: 'Neznáme rozhodnutie.', status: 400 };
  }
  if (input.approvedDeadline && !/^\d{4}-\d{2}-\d{2}$/.test(input.approvedDeadline)) {
    return { ok: false, error: 'Termín musí byť dátum vo formáte YYYY-MM-DD.', status: 400 };
  }
  if (input.xpEstimate != null && (input.xpEstimate < 0 || input.xpEstimate > 1000)) {
    return { ok: false, error: 'XP odhad musí byť 0–1000.', status: 400 };
  }

  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin.js');
    const admin = getSupabaseAdmin();

    const { data: existing } = await admin
      .from('student_quests')
      .select('id, class_id, state')
      .eq('id', input.questId)
      .maybeSingle();
    const row = existing as Record<string, unknown> | null;
    if (!row) return { ok: false, error: 'Misia sa nenašla.', status: 404 };
    if (TERMINAL_STATES.includes(row.state as QuestState)) {
      return { ok: false, error: 'Misia je už uzavretá.', status: 409 };
    }

    // Verify the teacher actually manages this class.
    const { data: membership } = await admin
      .from('class_memberships')
      .select('id')
      .eq('class_id', row.class_id as string)
      .eq('user_id', teacherUserId)
      .eq('role', 'teacher')
      .maybeSingle();
    if (!membership && teacherRole !== 'admin') {
      return { ok: false, error: 'Túto triedu neučíš.', status: 403 };
    }

    const nextState: QuestState =
      input.decision === 'approve' ? 'approved' :
      input.decision === 'request_changes' ? 'changes_requested' :
      'rejected';

    const patch: Record<string, unknown> = {
      state: nextState,
      teacher_feedback: input.teacherFeedback?.trim() || null,
    };
    if (input.decision === 'approve') {
      patch.approved_by = teacherUserId;
      patch.approved_at = new Date().toISOString();
      if (input.approvedDeadline) patch.approved_deadline = input.approvedDeadline;
      if (input.xpEstimate != null) patch.xp_estimate = Math.floor(input.xpEstimate);
    }

    const { data, error } = await admin
      .from('student_quests')
      .update(patch)
      .eq('id', input.questId)
      .select('*, student_access_codes(pseudonym)')
      .single();
    if (error) return { ok: false, error: error.message, status: 500 };
    return { ok: true, data: mapRow(data as Record<string, unknown>), source: 'db' };
  } catch {
    return { ok: false, error: 'Hodnotenie misie zlyhalo.', status: 500 };
  }
}
