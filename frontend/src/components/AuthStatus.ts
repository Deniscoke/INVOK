import type { AuthSnapshot } from '../services/authService';

/**
 * Header auth area.
 *  - Logged out: two clear role entries — students join a class with a code
 *    (/join), teachers sign in with e-mail (/login). No role/section links are
 *    shown until someone is actually signed in (keeps the bar uncluttered).
 *  - Logged in: just the pseudonym/name + sign-out (role-specific sections live
 *    in the nav). A small "demo" chip signals Supabase isn't configured.
 */
export function AuthStatus(snapshot: AuthSnapshot): string {
  const demo = snapshot.mode === 'demo' ? '<span class="chip chip--muted" title="Beží bez pripojeného servera">demo</span>' : '';

  if (snapshot.user) {
    return `
    <div class="auth-status">
      ${demo}
      <span class="auth-status__name">${snapshot.user.displayName}</span>
      <button class="btn btn--ghost btn--sm" id="auth-signout" type="button">Odhlásiť</button>
    </div>`;
  }

  return `
  <div class="auth-status">
    ${demo}
    <a class="btn btn--ghost btn--sm" href="#/join">Som žiak</a>
    <a class="btn btn--primary btn--sm" href="#/login">Som učiteľ</a>
  </div>`;
}
