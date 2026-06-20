import { Mascot } from '../components/Mascot';
import { joinAsStudent } from '../services/authService';

/**
 * Parse query params from the hash route (e.g. `#/join?code=XXX&alias=YYY`).
 * Returns an empty object when the hash carries no query.
 */
function joinQueryParams(): { code?: string; alias?: string } {
  if (typeof window === 'undefined') return {};
  const hash = window.location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return {};
  const params = new URLSearchParams(hash.slice(qIdx + 1));
  return {
    code: params.get('code') ?? undefined,
    alias: params.get('alias') ?? undefined,
  };
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function StudentJoinPage(): string {
  const { code, alias } = joinQueryParams();
  const codeAttr = code ? ` value="${escapeAttr(code)}"` : '';
  const aliasAttr = alias ? ` value="${escapeAttr(alias)}"` : '';
  const autoHint = code && alias
    ? '<p class="muted" style="font-size:var(--fs-sm)">Údaje sme predvyplnili z linku — stačí kliknúť na <strong>Pripojiť sa</strong>.</p>'
    : '';
  return `
  <section class="auth-page">
    <div style="text-align:center">${Mascot({ size: 96 })}</div>
    <h1>Pripoj sa do triedy</h1>
    <p class="muted">Zadaj kód od učiteľa. Nepotrebuješ e-mail. Ak máš osobný kód,
      prezývku už máš pridelenú — pole nechaj prázdne.</p>
    ${autoHint}
    <form id="join-form" class="card stack" novalidate>
      <label class="field">Kód <span class="muted" style="font-weight:normal;font-size:var(--fs-xs)">(8 znakov, napr. 8M5XDUSN)</span>
        <input id="join-code" type="text" autocomplete="off" inputmode="latin" placeholder="napr. 8M5XDUSN" required maxlength="32" style="text-transform:uppercase;letter-spacing:.06em"${codeAttr}>
      </label>
      <label class="field">Prezývka <span class="muted" style="font-weight:normal;font-size:var(--fs-xs)">(presne ako v tabuľke, napr. Hej-01)</span>
        <input id="join-pseudonym" type="text" autocomplete="off" placeholder="napr. Hej-01"${aliasAttr}>
      </label>
      <button class="btn btn--primary" type="submit">Pripojiť sa</button>
      <p id="join-msg" class="muted" role="status" aria-live="polite"></p>
    </form>
    <p class="muted" style="margin-top:var(--space-3);font-size:var(--fs-sm)">
      Si učiteľ/admin? Prejdi na <a href="#/login">prihlásenie e-mailom</a>.
    </p>
  </section>`;
}

async function attemptJoin(): Promise<void> {
  const msg = document.querySelector<HTMLElement>('#join-msg');
  const code = (document.querySelector('#join-code') as HTMLInputElement | null)?.value ?? '';
  const pseudonym = (document.querySelector('#join-pseudonym') as HTMLInputElement | null)?.value ?? '';
  const result = await joinAsStudent(code, pseudonym);
  if (msg) msg.textContent = result.ok ? `Vitaj, ${result.studentAlias}!` : (result.error ?? 'Pripojenie zlyhalo.');
  if (result.ok) {
    // Clear sensitive code from the URL before redirecting.
    window.history.replaceState(null, '', '/#/join');
    window.location.hash = '/student';
  }
}

export function mountStudentJoinPage(): void {
  const form = document.querySelector<HTMLFormElement>('#join-form');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await attemptJoin();
  });
}
