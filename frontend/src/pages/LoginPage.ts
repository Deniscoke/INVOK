import { signInTeacher, signInWithMagicLink } from '../services/authService';

export function LoginPage(): string {
  return `
  <section class="auth-page">
    <h1>Prihlásenie</h1>
    <p class="muted">Učitelia a admini sa prihlasujú e-mailom. Žiaci sa pripájajú
      <a href="#/join">kódom triedy</a> bez e-mailu.</p>
    <form id="login-form" class="card stack" novalidate>
      <label class="field">E-mail
        <input id="login-email" type="email" autocomplete="email" placeholder="ucitel@skola.sk" required>
      </label>
      <label class="field">Heslo
        <input id="login-password" type="password" autocomplete="current-password">
      </label>
      <button class="btn btn--primary" type="submit">Prihlásiť sa</button>
      <button class="btn btn--ghost" type="button" id="login-magic">Poslať magic link</button>
      <p id="login-msg" class="muted" role="status" aria-live="polite"></p>
    </form>
  </section>`;
}

export function mountLoginPage(): void {
  const form = document.querySelector<HTMLFormElement>('#login-form');
  const msg = document.querySelector<HTMLElement>('#login-msg');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = (document.querySelector('#login-email') as HTMLInputElement | null)?.value ?? '';
    const password = (document.querySelector('#login-password') as HTMLInputElement | null)?.value ?? '';
    const result = await signInTeacher(email, password);
    if (msg) msg.textContent = result.ok ? (result.info ?? 'Prihlásený.') : (result.error ?? 'Prihlásenie zlyhalo.');
    if (result.ok) window.location.hash = '/teacher';
  });

  document.querySelector('#login-magic')?.addEventListener('click', async () => {
    const email = (document.querySelector('#login-email') as HTMLInputElement | null)?.value ?? '';
    const result = await signInWithMagicLink(email);
    if (msg) msg.textContent = result.info ?? result.error ?? '';
  });
}
