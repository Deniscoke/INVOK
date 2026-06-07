/**
 * Frontend pilot setup API client.
 * Sends the Supabase JWT when available; falls back to a SAFE demo mode (no
 * real secrets, no PII) when the API is unavailable. Plaintext student codes
 * are returned by the server only ONCE and are never stored client-side.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getSnapshot } from './authService';
import { rememberClass } from './dashboardApi';

export interface EntityResult {
  ok: boolean;
  id?: string;
  name?: string;
  status?: string;
  message?: string;
  error?: string;
  source: 'api' | 'mock';
}

export interface GeneratedCode {
  pseudonym: string;
  code: string;
}

export interface GenerateCodesResult {
  ok: boolean;
  classId?: string;
  codes?: GeneratedCode[];
  source: 'api' | 'mock';
  error?: string;
}

export interface StudentCodeItem {
  id: string;
  pseudonym: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body) });
  const data = (await res.json()) as T & { ok?: boolean };
  if (!res.ok) throw new Error('request failed');
  return data;
}

export async function createSchool(input: { schoolName: string; region?: string }): Promise<EntityResult> {
  try {
    return { ...(await post<EntityResult>('/api/admin/schools', input)), source: 'api' };
  } catch {
    if (isSupabaseConfigured && !getSnapshot().user) {
      return { ok: false, error: 'Najprv sa prihlás alebo zaregistruj ako učiteľ.', source: 'mock' };
    }
    return { ok: true, id: 'demo-school', name: input.schoolName, source: 'mock' };
  }
}

export async function createClass(input: { schoolId: string; className: string; grade?: number }): Promise<EntityResult> {
  try {
    const result = { ...(await post<EntityResult>('/api/admin/classes', input)), source: 'api' as const };
    if (result.ok && result.id) rememberClass({ id: result.id, name: result.name ?? input.className });
    return result;
  } catch {
    if (isSupabaseConfigured && !getSnapshot().user) {
      return { ok: false, error: 'Najprv sa prihlás alebo zaregistruj ako učiteľ.', source: 'mock' };
    }
    const fallback: EntityResult = { ok: true, id: `demo-class-${Date.now()}`, name: input.className, source: 'mock' };
    // Even in the mock path remember the class locally so the dashboard can
    // surface it for the logged-in teacher until the real API comes back.
    if (fallback.id) rememberClass({ id: fallback.id, name: fallback.name ?? input.className });
    return fallback;
  }
}

export async function generateStudentCodes(input: { classId: string; count: number; pseudonymPrefix: string }): Promise<GenerateCodesResult> {
  try {
    const data = await post<GenerateCodesResult>('/api/admin/student-codes', input);
    if (!data.ok) return { ok: false, source: 'api', error: data.error };
    return { ...data, source: 'api' };
  } catch {
    if (isSupabaseConfigured && !getSnapshot().user) {
      return { ok: false, source: 'mock', error: 'Najprv sa prihlás alebo zaregistruj ako učiteľ.' };
    }
    return { ok: true, classId: input.classId, source: 'mock', codes: demoCodes(input.count, input.pseudonymPrefix) };
  }
}

export async function listStudentCodes(classId: string): Promise<StudentCodeItem[]> {
  try {
    const res = await fetch(`/api/admin/student-codes?classId=${encodeURIComponent(classId)}`, { headers: await authHeaders() });
    if (!res.ok) throw new Error();
    const data = (await res.json()) as { codes: StudentCodeItem[] };
    return data.codes;
  } catch {
    return [
      { id: 'demo-1', pseudonym: 'Líška-01', isActive: true, createdAt: new Date().toISOString(), lastUsedAt: null },
      { id: 'demo-2', pseudonym: 'Líška-02', isActive: false, createdAt: new Date().toISOString(), lastUsedAt: null },
    ];
  }
}

export async function deactivateStudentCode(id: string): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`/api/admin/student-codes/${encodeURIComponent(id)}`, { method: 'DELETE', headers: await authHeaders() });
    if (!res.ok) throw new Error();
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

// Demo-only client codes (no real secrets). Server codes are authoritative.
function demoCodes(count: number, prefix: string): GeneratedCode[] {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const n = Math.max(1, Math.min(40, Math.floor(count)));
  return Array.from({ length: n }, (_, i) => {
    let code = '';
    for (let k = 0; k < 8; k += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    return { pseudonym: `${prefix}-${String(i + 1).padStart(2, '0')}`, code };
  });
}
