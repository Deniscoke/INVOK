/**
 * Auth service (frontend).
 *
 * Teachers/admins use real Supabase Auth when configured. Students join
 * pseudonymously. When Supabase is NOT configured the service runs a local
 * DEMO mode (localStorage) so the app stays fully runnable via `npm run dev`.
 *
 * This module is frontend-safe: it never imports the server-only admin
 * (service-role) client and never touches the service role key.
 */
import { isSupabaseConfigured, supabase } from './supabaseClient';

export type Role = 'admin' | 'teacher' | 'student';

export interface AuthUser {
  id: string;
  role: Role;
  displayName: string;
}

export type AuthMode = 'supabase' | 'demo';

export interface AuthSnapshot {
  mode: AuthMode;
  user: AuthUser | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  info?: string;
}

const DEMO_KEY = 'invok_demo_auth';
const STUDENT_TOKEN_KEY = 'invok_student_session';

let snapshot: AuthSnapshot = { mode: isSupabaseConfigured ? 'supabase' : 'demo', user: null };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function onAuthChange(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getSnapshot(): AuthSnapshot {
  return snapshot;
}

function loadDemoUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function saveDemoUser(user: AuthUser | null): void {
  if (user) localStorage.setItem(DEMO_KEY, JSON.stringify(user));
  else localStorage.removeItem(DEMO_KEY);
}

async function refreshFromSupabase(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    snapshot = { mode: 'supabase', user: null };
    return;
  }
  // Load role/displayName from the (RLS-protected) own profile row.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, display_name')
    .eq('id', data.user.id)
    .maybeSingle();
  const row = profile as { role?: Role; display_name?: string } | null;
  snapshot = {
    mode: 'supabase',
    user: {
      id: data.user.id,
      role: row?.role ?? 'teacher', // email login ⇒ teacher/admin
      displayName: row?.display_name ?? data.user.email ?? 'Učiteľ',
    },
  };
}

/** Initialize auth state once on app start. */
export async function init(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    await refreshFromSupabase();
    supabase.auth.onAuthStateChange(() => {
      void refreshFromSupabase().then(emit);
    });
  } else {
    snapshot = { mode: 'demo', user: loadDemoUser() };
  }
  emit();
}

export async function signInTeacher(email: string, password: string): Promise<ActionResult> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    await refreshFromSupabase();
    emit();
    return { ok: true };
  }
  // demo
  if (!email.trim()) return { ok: false, error: 'Zadaj e-mail.' };
  snapshot = { mode: 'demo', user: { id: 'demo-teacher', role: 'teacher', displayName: email.split('@')[0] || 'Demo učiteľ' } };
  saveDemoUser(snapshot.user);
  emit();
  return { ok: true, info: 'Demo režim (bez Supabase).' };
}

/** Magic-link readiness: sends an OTP link when configured; mocked in demo. */
export async function signInWithMagicLink(email: string): Promise<ActionResult> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.auth.signInWithOtp({ email });
    return error ? { ok: false, error: error.message } : { ok: true, info: 'Odoslali sme prihlasovací odkaz.' };
  }
  return { ok: true, info: 'Demo: magic link by sa odoslal na ' + email };
}

export interface JoinResult {
  ok: boolean;
  studentAlias?: string;
  classId?: string;
  sessionMode?: string;
  error?: string;
}

export async function joinAsStudent(code: string, pseudonym: string): Promise<JoinResult> {
  if (pseudonym.includes('@')) return { ok: false, error: 'Pseudonym nesmie byť e-mail.' };

  if (isSupabaseConfigured) {
    // Production path: server validates the code and issues a session token.
    try {
      const response = await fetch('/api/student/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, pseudonym }),
      });
      const data = (await response.json()) as JoinResult & { sessionToken?: string };
      if (!response.ok || !data.ok) return { ok: false, error: data.error ?? 'Pripojenie zlyhalo.' };
      if (data.sessionToken) localStorage.setItem(STUDENT_TOKEN_KEY, data.sessionToken);
      // Personal access codes carry a pre-assigned alias — prefer the server's.
      const alias = data.studentAlias ?? pseudonym ?? 'Žiak';
      snapshot = { mode: 'supabase', user: { id: 'student', role: 'student', displayName: alias } };
      emit();
      return { ok: true, studentAlias: alias, classId: data.classId, sessionMode: data.sessionMode };
    } catch {
      return { ok: false, error: 'Pripojenie zlyhalo.' };
    }
  }

  // demo
  if (code.trim().length < 4) return { ok: false, error: 'Zadaj platný kód triedy.' };
  snapshot = { mode: 'demo', user: { id: 'demo-student', role: 'student', displayName: pseudonym } };
  saveDemoUser(snapshot.user);
  emit();
  return { ok: true, studentAlias: pseudonym, classId: 'demo-class', sessionMode: 'pseudonymous' };
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured && supabase) await supabase.auth.signOut();
  saveDemoUser(null);
  localStorage.removeItem(STUDENT_TOKEN_KEY);
  snapshot = { mode: snapshot.mode, user: null };
  emit();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  return snapshot.user;
}

export async function getCurrentProfile(): Promise<AuthUser | null> {
  return snapshot.user;
}

export async function getCurrentRole(): Promise<Role | null> {
  return snapshot.user?.role ?? null;
}

export async function isTeacherOrAdmin(): Promise<boolean> {
  const role = snapshot.user?.role;
  return role === 'teacher' || role === 'admin';
}

export async function isStudent(): Promise<boolean> {
  return snapshot.user?.role === 'student';
}
