import type { AuthSnapshot } from '../services/authService';
import { RoleBadge } from './RoleBadge';

/**
 * Header auth indicator. Shows the current role + name and a sign-out button,
 * or a login link. A small "demo" chip signals that Supabase is not configured.
 */
export function AuthStatus(snapshot: AuthSnapshot): string {
  const demo = snapshot.mode === 'demo' ? '<span class="chip chip--muted">demo</span>' : '';

  if (snapshot.user) {
    return `
    <div class="auth-status">
      ${demo}
      ${RoleBadge(snapshot.user.role)}
      <span class="auth-status__name">${snapshot.user.displayName}</span>
      <button class="btn btn--ghost btn--sm" id="auth-signout" type="button">Odhlásiť</button>
    </div>`;
  }

  return `
  <div class="auth-status">
    ${demo}
    <a class="btn btn--ghost btn--sm" href="#/login">Prihlásiť</a>
  </div>`;
}
