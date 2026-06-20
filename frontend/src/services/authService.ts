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
import { findCachedStudent } from './studentCodeCache';

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

/** True when two snapshots represent the same signed-in identity. */
function sameUser(a: AuthUser | null, b: AuthUser | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.id === b.id && a.role === b.role && a.displayName === b.displayName;
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
    // Supabase fires this on token refresh / tab focus too. Re-render only when
    // the actual identity changes — otherwise an in-progress page (e.g. pilot
    // setup with generated codes) would reset to the top on a background refresh.
    supabase.auth.onAuthStateChange(() => {
      const before = snapshot.user;
      void refreshFromSupabase().then(() => {
        if (!sameUser(before, snapshot.user)) emit();
      });
    });
  } else {
    snapshot = { mode: 'demo', user: loadDemoUser() };
  }
  emit();
}

export async function signInTeacher(email: string, password: string): Promise<ActionResult> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const lower = error.message.toLowerCase();
      const hint = lower.includes('not confirmed') || lower.includes('email not confirmed')
        ? ' Účet ešte nie je potvrdený. Klikni na potvrdzovací e-mail, alebo v Supabase vypni „Confirm email" (Authentication → Providers → Email) pre okamžité prihlásenie.'
        : lower.includes('invalid')
          ? ' Skontroluj e-mail a heslo, alebo si najprv vytvor účet.'
          : '';
      return { ok: false, error: error.message + hint };
    }
    await refreshFromSupabase();
    if (!snapshot.user) {
      return { ok: false, error: 'Prihlásenie prebehlo, ale chýba profil učiteľa. Skús registráciu znova alebo kontaktuj podporu.' };
    }
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

/**
 * Register a teacher account (Supabase) or enter demo mode locally.
 *
 * We rely on the `handle_new_auth_user` DB trigger (migration 006) to create
 * the matching `profiles` row — that way registration works even when no
 * session exists yet (email-confirmation flows) and we don't depend on RLS
 * accepting a client-side INSERT.
 *
 * `emailRedirectTo` overrides Supabase's default Site URL (which is often
 * `http://localhost:3000` until configured), so confirmation links point
 * back to the deployed app.
 */
export async function signUpTeacher(email: string, password: string, displayName: string): Promise<ActionResult> {
  if (!email.trim()) return { ok: false, error: 'Zadaj e-mail.' };
  if (password.length < 6) return { ok: false, error: 'Heslo musí mať aspoň 6 znakov.' };

  if (isSupabaseConfigured && supabase) {
    const name = displayName.trim() || email.split('@')[0] || 'Učiteľ';
    const redirectTo =
      (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined)?.trim() ||
      (typeof window !== 'undefined' ? `${window.location.origin}/` : undefined);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { role: 'teacher', display_name: name },
        emailRedirectTo: redirectTo,
      },
    });
    if (error) {
      const lower = error.message.toLowerCase();
      const hint = lower.includes('already registered') || lower.includes('user already')
        ? ' Skús sa prihlásiť.'
        : lower.includes('profiles')
          ? ' Vyzerá to, že v Supabase nie sú aplikované migrácie — pozri docs/SUPABASE_AUTH_SETUP.md.'
          : '';
      return { ok: false, error: error.message + hint };
    }
    if (!data.user) return { ok: false, error: 'Registrácia zlyhala.' };

    if (data.session) {
      // Trigger created the profile; load it.
      await refreshFromSupabase();
      emit();
      if (!snapshot.user) {
        return {
          ok: false,
          error:
            'Účet bol vytvorený, ale chýba profil učiteľa. V Supabase aplikuj migrácie (006_auto_create_profile.sql) a skús znova.',
        };
      }
      return { ok: true, info: 'Účet vytvorený. Môžeš pokračovať do pilot setupu.' };
    }

    return {
      ok: true,
      info:
        'Účet vytvorený. Supabase ti poslal potvrdzovací e-mail — klikni naň a potom sa prihlás. ' +
        'Ak link smeruje na localhost, treba v Supabase nastaviť Site URL na adresu aplikácie (docs/SUPABASE_AUTH_SETUP.md).',
    };
  }

  snapshot = { mode: 'demo', user: { id: 'demo-teacher', role: 'teacher', displayName: displayName.trim() || email.split('@')[0] || 'Demo učiteľ' } };
  saveDemoUser(snapshot.user);
  emit();
  return { ok: true, info: 'Demo režim — účet uložený lokálne.' };
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
  const trimmedCode = code.trim();
  if (trimmedCode.length < 4) return { ok: false, error: 'Zadaj platný kód triedy.' };

  if (isSupabaseConfigured) {
    // Production path: server validates the code and issues a session token.
    try {
      const response = await fetch('/api/student/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: trimmedCode, pseudonym }),
      });
      const data = (await response.json()) as JoinResult & { sessionToken?: string };
      if (response.ok && data.ok) {
        if (data.sessionToken) localStorage.setItem(STUDENT_TOKEN_KEY, data.sessionToken);
        const alias = data.studentAlias ?? pseudonym ?? 'Žiak';
        snapshot = { mode: 'supabase', user: { id: 'student', role: 'student', displayName: alias } };
        emit();
        return { ok: true, studentAlias: alias, classId: data.classId, sessionMode: data.sessionMode };
      }
      // API responded but rejected the code — fall through to the local
      // cache fallback so that pilot demos still work end-to-end even if
      // the API hasn't been able to persist the codes yet.
    } catch {
      // Network / runtime failure: fall through to local fallback.
    }

    const cached = findCachedStudent(trimmedCode, pseudonym);
    if (cached) {
      const alias = cached.pseudonym;
      snapshot = { mode: 'supabase', user: { id: `student:${cached.pseudonym}`, role: 'student', displayName: alias } };
      emit();
      return { ok: true, studentAlias: alias, classId: cached.classId, sessionMode: 'local-fallback' };
    }
    return {
      ok: false,
      error:
        'Kód nesedí (alebo bol vygenerovaný v inom prehliadači). Skontroluj kód a prezývku, alebo si nech učiteľ vygeneruje nové kódy v pilot setupe.',
    };
  }

  // demo (no Supabase configured) — accept any well-formed code.
  snapshot = { mode: 'demo', user: { id: 'demo-student', role: 'student', displayName: pseudonym || 'Žiak' } };
  saveDemoUser(snapshot.user);
  emit();
  return { ok: true, studentAlias: pseudonym || 'Žiak', classId: 'demo-class', sessionMode: 'pseudonymous' };
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured && supabase) await supabase.auth.signOut();
  saveDemoUser(null);
  localStorage.removeItem(STUDENT_TOKEN_KEY);
  // Lazy import to avoid a top-level circular dependency
  // (dashboardApi → authService.getSnapshot()).
  try {
    const { clearCachedClasses } = await import('./dashboardApi');
    clearCachedClasses();
  } catch {
    /* ignore — cache is best-effort */
  }
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
