/**
 * Pseudonymous student access service (SERVER-ONLY).
 *
 * Students do NOT use email. They join a class with a code + a pseudonym and
 * receive an opaque session token (the secret stays client-side; only its hash
 * is stored). No personal data is persisted.
 *
 * Two clearly separated paths:
 *   - MOCK fallback (when Supabase secrets are absent): deterministic, no DB.
 *     `source: 'mock'`.
 *   - DB-ready path (when configured): hashes the code, validates against
 *     `class_join_codes`, provisions a `student_access_codes` row + a
 *     `student_sessions` row. `source: 'db'`.
 *
 * Responses NEVER contain code or token hashes.
 * Do NOT import from frontend code.
 */
import { getServerEnv, missingServerSecrets } from '../lib/env';
import { generateCode, generateSessionToken, hashCode, hashToken } from '../lib/hash';

export interface JoinInput {
  code: string;
  pseudonym: string;
}

export type JoinResult =
  | {
      ok: true;
      studentAlias: string;
      classId: string;
      sessionMode: 'pseudonymous';
      sessionToken: string;
      source: 'mock' | 'db';
    }
  | { ok: false; error: string };

export interface SessionResult {
  valid: boolean;
  sessionMode: 'pseudonymous';
  studentAlias?: string;
  classId?: string;
  source: 'mock' | 'db';
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export type JoinValidation =
  | { ok: true; value: JoinInput }
  | { ok: false; issues: ValidationIssue[] };

const PSEUDONYM_RE = /^[\p{L}\p{N} ._-]{2,40}$/u;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function validateJoinInput(raw: unknown): JoinValidation {
  const issues: ValidationIssue[] = [];
  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

  const code = body.code;
  if (typeof code !== 'string' || code.trim().length < 4 || code.trim().length > 40) {
    issues.push({ field: 'code', message: 'Kód musí mať 4 až 40 znakov.' });
  }

  const pseudonym = body.pseudonym;
  if (typeof pseudonym !== 'string') {
    issues.push({ field: 'pseudonym', message: 'Pseudonym je povinný.' });
  } else if (pseudonym.includes('@')) {
    issues.push({ field: 'pseudonym', message: 'Pseudonym nesmie byť e-mail.' });
  } else if (!PSEUDONYM_RE.test(pseudonym.trim())) {
    issues.push({ field: 'pseudonym', message: 'Pseudonym má 2–40 znakov (písmená, čísla, . _ -).' });
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { code: (code as string).trim(), pseudonym: (pseudonym as string).trim() } };
}

function isConfigured(): boolean {
  return missingServerSecrets(getServerEnv()).length === 0;
}

export async function joinClass(input: JoinInput): Promise<JoinResult> {
  const validation = validateJoinInput(input);
  if (!validation.ok) {
    return { ok: false, error: validation.issues.map((i) => i.message).join(' ') };
  }
  return isConfigured() ? dbJoin(validation.value) : mockJoin(validation.value);
}

export async function verifyStudentSession(token: unknown): Promise<SessionResult> {
  if (typeof token !== 'string' || token.length < 8) {
    return { valid: false, sessionMode: 'pseudonymous', source: isConfigured() ? 'db' : 'mock' };
  }
  return isConfigured() ? dbVerifySession(token) : { valid: true, sessionMode: 'pseudonymous', source: 'mock' };
}

// --- MOCK path (no DB) ------------------------------------------------------
function mockJoin(value: JoinInput): JoinResult {
  return {
    ok: true,
    studentAlias: value.pseudonym,
    classId: 'demo-class',
    sessionMode: 'pseudonymous',
    sessionToken: generateSessionToken(),
    source: 'mock',
  };
}

// --- DB-ready path ----------------------------------------------------------
async function dbJoin(value: JoinInput): Promise<JoinResult> {
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin');
    const admin = getSupabaseAdmin();

    const { data: joinCode } = await admin
      .from('class_join_codes')
      .select('id, class_id, expires_at, max_uses, used_count')
      .eq('code_hash', hashCode(value.code))
      .maybeSingle();

    const code = joinCode as Record<string, unknown> | null;
    if (!code) return { ok: false, error: 'Neplatný alebo expirovaný kód.' };
    if (code.expires_at && new Date(String(code.expires_at)).getTime() < Date.now()) {
      return { ok: false, error: 'Kód expiroval.' };
    }
    if (code.max_uses != null && Number(code.used_count) >= Number(code.max_uses)) {
      return { ok: false, error: 'Kód dosiahol limit použití.' };
    }

    const classId = String(code.class_id);

    const { data: access, error: accessError } = await admin
      .from('student_access_codes')
      .insert({ class_id: classId, pseudonym: value.pseudonym, code_hash: hashCode(generateCode(8)) })
      .select('id')
      .single();
    if (accessError || !access) return { ok: false, error: 'Pripojenie zlyhalo.' };

    const token = generateSessionToken();
    await admin.from('student_sessions').insert({
      student_access_code_id: (access as Record<string, unknown>).id,
      session_token_hash: hashToken(token),
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    });
    await admin
      .from('class_join_codes')
      .update({ used_count: Number(code.used_count) + 1 })
      .eq('id', code.id as string);

    return {
      ok: true,
      studentAlias: value.pseudonym,
      classId,
      sessionMode: 'pseudonymous',
      sessionToken: token,
      source: 'db',
    };
  } catch {
    return { ok: false, error: 'Pripojenie zlyhalo.' };
  }
}

async function dbVerifySession(token: string): Promise<SessionResult> {
  try {
    const { getSupabaseAdmin } = await import('../lib/supabaseAdmin');
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('student_sessions')
      .select('expires_at, student_access_codes(class_id, pseudonym)')
      .eq('session_token_hash', hashToken(token))
      .maybeSingle();

    const row = data as Record<string, unknown> | null;
    if (!row || (row.expires_at && new Date(String(row.expires_at)).getTime() < Date.now())) {
      return { valid: false, sessionMode: 'pseudonymous', source: 'db' };
    }
    const access = row.student_access_codes as Record<string, unknown> | undefined;
    return {
      valid: true,
      sessionMode: 'pseudonymous',
      studentAlias: access ? String(access.pseudonym) : undefined,
      classId: access ? String(access.class_id) : undefined,
      source: 'db',
    };
  } catch {
    return { valid: false, sessionMode: 'pseudonymous', source: 'db' };
  }
}
