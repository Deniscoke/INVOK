/**
 * SERVER-ONLY unified request context.
 *
 * Resolves the caller's identity from HTTP headers. Returns one of three modes:
 *
 *   - `supabase_user`   – verified Supabase JWT (teacher / admin / student via auth)
 *   - `student_session` – pseudonymous student bearer token (no auth.users row)
 *   - `anonymous`       – no valid credential
 *
 * Usage by API routes:
 *   const ctx = await resolveContext(req);
 *   if (ctx.mode === 'anonymous') { res.status(401)…; return; }
 *
 * Do NOT import from frontend code.
 */
import type { VercelRequest } from '@vercel/node';
import { bearer, getUserFromToken, getProfile } from './authContext.js';
import { verifyStudentSession } from '../services/studentAccessService.js';
import { getServerEnv, missingServerSecrets } from './env.js';

export type RequestContext =
  | { mode: 'supabase_user'; userId: string; role: 'admin' | 'teacher' | 'student' }
  | {
      mode: 'student_session';
      studentAccessCodeId: string;
      pseudonym: string;
      classId: string;
    }
  | { mode: 'anonymous' };

function isConfigured(): boolean {
  return missingServerSecrets(getServerEnv()).length === 0;
}

/** Try to resolve from the Authorization Bearer header (Supabase JWT). */
async function trySupabaseAuth(authHeader: string | string[] | undefined): Promise<RequestContext | null> {
  const token = bearer(authHeader);
  if (!token) return null;
  const user = await getUserFromToken(token);
  if (!user) return null;
  const profile = await getProfile(user.userId);
  if (!profile) return null;
  return { mode: 'supabase_user', userId: user.userId, role: profile.role };
}

/** Try to resolve from the X-Student-Token header (pseudonymous session). */
async function tryStudentSession(tokenHeader: string | string[] | undefined): Promise<RequestContext | null> {
  const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
  if (!token) return null;
  const result = await verifyStudentSession(token);
  if (!result.valid || !result.studentAccessCodeId || !result.studentAlias || !result.classId) return null;
  return {
    mode: 'student_session',
    studentAccessCodeId: result.studentAccessCodeId,
    pseudonym: result.studentAlias,
    classId: result.classId,
  };
}

/**
 * Resolve the request context.  When Supabase is not configured, returns a
 * typed mock context for local development (controlled by X-Dev-Role header).
 */
export async function resolveContext(req: VercelRequest): Promise<RequestContext> {
  if (!isConfigured()) {
    return devMockContext(req.headers['x-dev-role'] as string | undefined);
  }

  const supabaseCtx = await trySupabaseAuth(req.headers.authorization);
  if (supabaseCtx) return supabaseCtx;

  const studentCtx = await tryStudentSession(req.headers['x-student-token']);
  if (studentCtx) return studentCtx;

  return { mode: 'anonymous' };
}

function devMockContext(devRole: string | undefined): RequestContext {
  if (devRole === 'teacher') {
    return { mode: 'supabase_user', userId: 'dev-teacher', role: 'teacher' };
  }
  if (devRole === 'admin') {
    return { mode: 'supabase_user', userId: 'dev-admin', role: 'admin' };
  }
  // Default dev context: pseudonymous student
  return {
    mode: 'student_session',
    studentAccessCodeId: 'dev-access-code',
    pseudonym: 'Líška-07',
    classId: 'dev-class',
  };
}

export function isTeacherOrAdmin(ctx: RequestContext): boolean {
  return ctx.mode === 'supabase_user' && (ctx.role === 'teacher' || ctx.role === 'admin');
}

export function isStudent(ctx: RequestContext): boolean {
  return ctx.mode === 'student_session' || (ctx.mode === 'supabase_user' && ctx.role === 'student');
}

export function requireAuth(ctx: RequestContext): ctx is Exclude<RequestContext, { mode: 'anonymous' }> {
  return ctx.mode !== 'anonymous';
}
