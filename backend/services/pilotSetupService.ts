/**
 * Pilot setup service (SERVER-ONLY).
 *
 * Lets a teacher/admin (or a dev/pilot bootstrap) create a school, class,
 * teacher membership and pseudonymous student access codes.
 *
 * Privacy: student codes are returned as PLAINTEXT exactly ONCE (for printing)
 * and only the sha256 HASH is stored. Plaintext is never persisted or logged.
 * List endpoints never return the hash or the plaintext.
 *
 * Do NOT import from frontend code.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestContext } from '../lib/requestContext';
import { isTeacherOrAdmin } from '../lib/requestContext';
import { getServerEnv, missingServerSecrets } from '../lib/env';
import { generateCode, hashCode } from '../lib/hash';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import {
  validateSchoolInput,
  validateClassInput,
  validateTeacherInput,
  validateStudentCodesInput,
} from '../validators/pilotSetupValidator';

export interface CreatedEntity {
  ok: boolean;
  id?: string;
  name?: string;
  status?: string;
  message?: string;
  error?: string;
  source: 'mock' | 'db';
}

export interface GeneratedCode {
  pseudonym: string;
  code: string; // PLAINTEXT — shown once, never stored
}

export interface GenerateCodesResult {
  ok: boolean;
  classId?: string;
  codes?: GeneratedCode[];
  oneTimeView: true;
  source: 'mock' | 'db';
  error?: string;
}

export interface StudentCodeListItem {
  id: string;
  pseudonym: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ClassListItem {
  id: string;
  name: string;
  grade: number | null;
  schoolId: string | null;
}

function isConfigured(): boolean {
  return missingServerSecrets(getServerEnv()).length === 0;
}
function setupMode(): boolean {
  return getServerEnv().pilotSetupEnabled;
}
function isAdmin(ctx: RequestContext): boolean {
  return ctx.mode === 'supabase_user' && ctx.role === 'admin';
}
function source(): 'mock' | 'db' {
  return isConfigured() ? 'db' : 'mock';
}

// ---------------------------------------------------------------------------
// School / class / teacher
// ---------------------------------------------------------------------------
export async function createSchool(ctx: RequestContext, raw: unknown): Promise<CreatedEntity> {
  if (!(isAdmin(ctx) || (isTeacherOrAdmin(ctx) && setupMode()))) return { ok: false, error: 'Forbidden', source: source() };
  const v = validateSchoolInput(raw);
  if (!v.ok) return { ok: false, error: v.issues.map((i) => i.message).join(' '), source: source() };

  if (!isConfigured() || ctx.mode !== 'supabase_user') {
    return { ok: true, id: `mock-school-${v.value.slug ?? 'demo'}`, name: v.value.name, source: 'mock' };
  }
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('schools').insert({ name: v.value.name, region: v.value.region ?? null }).select('id, name').single();
    if (error || !data) return { ok: false, error: 'Vytvorenie školy zlyhalo.', source: 'db' };
    const row = data as Record<string, unknown>;
    // Best-effort: make the creator a school admin (ignored if no profile row yet).
    await admin.from('school_memberships').insert({ school_id: String(row.id), user_id: ctx.userId, role: 'admin' });
    return { ok: true, id: String(row.id), name: String(row.name), source: 'db' };
  } catch {
    return { ok: false, error: 'Interná chyba servera.', source: 'db' };
  }
}

export async function createClass(ctx: RequestContext, raw: unknown): Promise<CreatedEntity> {
  if (!isTeacherOrAdmin(ctx)) return { ok: false, error: 'Forbidden', source: source() };
  const v = validateClassInput(raw);
  if (!v.ok) return { ok: false, error: v.issues.map((i) => i.message).join(' '), source: source() };

  if (!isConfigured() || ctx.mode !== 'supabase_user') {
    return { ok: true, id: 'mock-class', name: v.value.name, source: 'mock' };
  }
  try {
    const admin = getSupabaseAdmin();
    if (!setupMode() && !(await managesSchool(admin, ctx, v.value.schoolId))) {
      return { ok: false, error: 'Škola nie je vo vašom rozsahu.', source: 'db' };
    }
    const { data, error } = await admin.from('classes').insert({ school_id: v.value.schoolId, name: v.value.name, grade: v.value.grade ?? null }).select('id, name').single();
    if (error || !data) return { ok: false, error: 'Vytvorenie triedy zlyhalo.', source: 'db' };
    const row = data as Record<string, unknown>;
    await admin.from('class_memberships').insert({ class_id: String(row.id), user_id: ctx.userId, role: 'teacher' });
    return { ok: true, id: String(row.id), name: String(row.name), source: 'db' };
  } catch {
    return { ok: false, error: 'Interná chyba servera.', source: 'db' };
  }
}

export async function addTeacherToSchool(ctx: RequestContext, raw: unknown): Promise<CreatedEntity> {
  if (!(isAdmin(ctx) || (isTeacherOrAdmin(ctx) && setupMode()))) return { ok: false, error: 'Forbidden', source: source() };
  const v = validateTeacherInput(raw);
  if (!v.ok) return { ok: false, error: v.issues.map((i) => i.message).join(' '), source: source() };

  if (!isConfigured() || ctx.mode !== 'supabase_user') {
    return { ok: true, status: 'pending', message: 'Demo: učiteľ by bol pozvaný po registrácii.', source: 'mock' };
  }
  try {
    const admin = getSupabaseAdmin();
    if (!v.value.teacherUserId) {
      return { ok: true, status: 'pending', message: 'Učiteľ sa musí najprv zaregistrovať (Supabase user + profil), potom ho pridáme cez teacherUserId.', source: 'db' };
    }
    const { data: profile } = await admin.from('profiles').select('id').eq('id', v.value.teacherUserId).maybeSingle();
    if (!profile) return { ok: true, status: 'pending', message: 'Profil učiteľa zatiaľ neexistuje.', source: 'db' };
    await admin.from('school_memberships').insert({ school_id: v.value.schoolId, user_id: v.value.teacherUserId, role: 'teacher' });
    return { ok: true, status: 'added', source: 'db' };
  } catch {
    return { ok: false, error: 'Interná chyba servera.', source: 'db' };
  }
}

// ---------------------------------------------------------------------------
// Student access codes
// ---------------------------------------------------------------------------
export async function generateStudentAccessCodes(ctx: RequestContext, raw: unknown): Promise<GenerateCodesResult> {
  if (!isTeacherOrAdmin(ctx)) return { ok: false, oneTimeView: true, source: source(), error: 'Forbidden' };
  const v = validateStudentCodesInput(raw);
  if (!v.ok) return { ok: false, oneTimeView: true, source: source(), error: v.issues.map((i) => i.message).join(' ') };

  const codes: GeneratedCode[] = Array.from({ length: v.value.count }, (_, i) => ({
    pseudonym: `${v.value.pseudonymPrefix}-${String(i + 1).padStart(2, '0')}`,
    code: generateCode(8),
  }));

  if (!isConfigured() || ctx.mode !== 'supabase_user') {
    return { ok: true, classId: v.value.classId, codes, oneTimeView: true, source: 'mock' };
  }
  try {
    const admin = getSupabaseAdmin();
    if (!(await managesClass(admin, ctx, v.value.classId))) return { ok: false, oneTimeView: true, source: 'db', error: 'Trieda nie je vo vašom rozsahu.' };
    const rows = codes.map((c) => ({ class_id: v.value.classId, pseudonym: c.pseudonym, code_hash: hashCode(c.code), is_active: true, created_by: ctx.userId }));
    const { error } = await admin.from('student_access_codes').insert(rows);
    if (error) return { ok: false, oneTimeView: true, source: 'db', error: 'Uloženie kódov zlyhalo.' };
    return { ok: true, classId: v.value.classId, codes, oneTimeView: true, source: 'db' };
  } catch {
    return { ok: false, oneTimeView: true, source: 'db', error: 'Interná chyba servera.' };
  }
}

export async function listStudentAccessCodes(ctx: RequestContext, classId: string): Promise<StudentCodeListItem[]> {
  if (!isTeacherOrAdmin(ctx)) return [];
  if (!isConfigured() || ctx.mode !== 'supabase_user') {
    return [
      { id: 'mock-code-1', pseudonym: 'Líška-01', isActive: true, createdAt: new Date().toISOString(), lastUsedAt: null },
      { id: 'mock-code-2', pseudonym: 'Líška-02', isActive: true, createdAt: new Date().toISOString(), lastUsedAt: null },
    ];
  }
  try {
    const admin = getSupabaseAdmin();
    if (!(await managesClass(admin, ctx, classId))) return [];
    // NOTE: explicitly excludes code_hash — never returned to clients.
    const { data } = await admin
      .from('student_access_codes')
      .select('id, pseudonym, is_active, created_at, last_used_at')
      .eq('class_id', classId)
      .order('created_at', { ascending: true });
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      pseudonym: String(r.pseudonym),
      isActive: Boolean(r.is_active),
      createdAt: String(r.created_at ?? ''),
      lastUsedAt: r.last_used_at ? String(r.last_used_at) : null,
    }));
  } catch {
    return [];
  }
}

export async function deactivateStudentAccessCode(ctx: RequestContext, codeId: string): Promise<{ ok: boolean; source: 'mock' | 'db'; error?: string }> {
  if (!isTeacherOrAdmin(ctx)) return { ok: false, source: source(), error: 'Forbidden' };
  if (!isConfigured() || ctx.mode !== 'supabase_user') return { ok: true, source: 'mock' };
  try {
    const admin = getSupabaseAdmin();
    const { data: code } = await admin.from('student_access_codes').select('class_id').eq('id', codeId).maybeSingle();
    const row = code as Record<string, unknown> | null;
    if (!row || !(await managesClass(admin, ctx, String(row.class_id)))) return { ok: false, source: 'db', error: 'Kód nie je vo vašom rozsahu.' };
    await admin.from('student_access_codes').update({ is_active: false }).eq('id', codeId);
    return { ok: true, source: 'db' };
  } catch {
    return { ok: false, source: 'db', error: 'Interná chyba servera.' };
  }
}

// ---------------------------------------------------------------------------
// Classes (for dashboard filter)
// ---------------------------------------------------------------------------
export async function listClassesForTeacher(ctx: RequestContext): Promise<ClassListItem[]> {
  if (!isTeacherOrAdmin(ctx)) return [];
  if (!isConfigured() || ctx.mode !== 'supabase_user') {
    return [
      { id: 'demo-class-a', name: 'Trieda 5.A', grade: 5, schoolId: 'demo-school' },
      { id: 'demo-class-b', name: 'Trieda 5.B', grade: 5, schoolId: 'demo-school' },
    ];
  }
  try {
    const admin = getSupabaseAdmin();
    if (ctx.role === 'admin') {
      const { data: schools } = await admin.from('school_memberships').select('school_id').eq('user_id', ctx.userId).eq('role', 'admin');
      const schoolIds = ((schools ?? []) as Record<string, unknown>[]).map((s) => String(s.school_id));
      if (schoolIds.length === 0) return [];
      const { data } = await admin.from('classes').select('id, name, grade, school_id').in('school_id', schoolIds);
      return ((data ?? []) as Record<string, unknown>[]).map(mapClass);
    }
    const { data: memberships } = await admin.from('class_memberships').select('classes(id, name, grade, school_id)').eq('user_id', ctx.userId).eq('role', 'teacher');
    return ((memberships ?? []) as Record<string, unknown>[])
      .map((m) => m.classes as Record<string, unknown> | null)
      .filter((c): c is Record<string, unknown> => c !== null)
      .map(mapClass);
  } catch {
    return [];
  }
}

function mapClass(row: Record<string, unknown>): ClassListItem {
  return { id: String(row.id), name: String(row.name), grade: row.grade != null ? Number(row.grade) : null, schoolId: row.school_id ? String(row.school_id) : null };
}

// ---------------------------------------------------------------------------
// Scope helpers (SECURITY DEFINER-free; service role bypasses RLS)
// ---------------------------------------------------------------------------
async function managesClass(admin: SupabaseClient, ctx: Extract<RequestContext, { mode: 'supabase_user' }>, classId: string): Promise<boolean> {
  if (setupMode()) return true;
  const { data: teacher } = await admin.from('class_memberships').select('id').eq('class_id', classId).eq('user_id', ctx.userId).eq('role', 'teacher').maybeSingle();
  if (teacher) return true;
  const { data: cls } = await admin.from('classes').select('school_id').eq('id', classId).maybeSingle();
  const row = cls as Record<string, unknown> | null;
  if (!row) return false;
  return managesSchool(admin, ctx, String(row.school_id));
}

async function managesSchool(admin: SupabaseClient, ctx: Extract<RequestContext, { mode: 'supabase_user' }>, schoolId: string): Promise<boolean> {
  if (setupMode()) return true;
  const { data } = await admin.from('school_memberships').select('id').eq('school_id', schoolId).eq('user_id', ctx.userId).eq('role', 'admin').maybeSingle();
  return Boolean(data);
}
