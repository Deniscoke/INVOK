import { signInTeacher, signInWithMagicLink, signUpTeacher } from '../services/authService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { playLoginTransition } from '../components/LoginTransition';

export function LoginPage(): string {
  return `
  <section class="auth-page">
    <h1>Prihlásenie učiteľa</h1>
    <p class="muted">Učitelia a admini sa prihlasujú e-mailom.</p>

    ${isSupabaseConfigured ? '<p class="muted">Nový učiteľ? Najprv si vytvor účet v záložke <strong>Registrácia</strong>, potom pokračuj do <a href="#/pilot">tvorby triedy</a>.</p>' : ''}

    <div class="card stack" style="margin-bottom:var(--space-3)">
      <div role="tablist" aria-label="Spôsob prihlásenia" style="display:flex;gap:8px">
        <button class="btn btn--ghost btn--sm" type="button" id="tab-login" aria-selected="true">Prihlásenie</button>
        <button class="btn btn--ghost btn--sm" type="button" id="tab-register" aria-selected="false">Registrácia</button>
      </div>
    </div>

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

    <form id="register-form" class="card stack" novalidate hidden>
      <h3 style="margin:0">Nový učiteľský účet</h3>
      <p class="muted" style="margin:0">Po registrácii pokračuj do tvorby triedy a vytvor školu, triedu a kódy pre žiakov.</p>
      <label class="field">Zobrazované meno (pseudonym)
        <input id="register-name" type="text" maxlength="80" placeholder="napr. Učiteľka M." autocomplete="name">
      </label>
      <label class="field">E-mail
        <input id="register-email" type="email" autocomplete="email" placeholder="ucitel@skola.sk" required>
      </label>
      <label class="field">Heslo (min. 6 znakov)
        <input id="register-password" type="password" autocomplete="new-password" minlength="6" required>
      </label>
      <button class="btn btn--primary" type="submit">Vytvoriť účet</button>
      <p id="register-msg" class="muted" role="status" aria-live="polite"></p>
    </form>
  </section>`;
}

export function mountLoginPage(): void {
  const loginForm = document.querySelector<HTMLFormElement>('#login-form');
  const registerForm = document.querySelector<HTMLFormElement>('#register-form');
  const loginMsg = document.querySelector<HTMLElement>('#login-msg');
  const registerMsg = document.querySelector<HTMLElement>('#register-msg');
  const tabLogin = document.querySelector<HTMLButtonElement>('#tab-login');
  const tabRegister = document.querySelector<HTMLButtonElement>('#tab-register');

  const showLogin = (): void => {
    loginForm?.removeAttribute('hidden');
    registerForm?.setAttribute('hidden', '');
    tabLogin?.setAttribute('aria-selected', 'true');
    tabRegister?.setAttribute('aria-selected', 'false');
  };
  const showRegister = (): void => {
    registerForm?.removeAttribute('hidden');
    loginForm?.setAttribute('hidden', '');
    tabRegister?.setAttribute('aria-selected', 'true');
    tabLogin?.setAttribute('aria-selected', 'false');
  };

  tabLogin?.addEventListener('click', showLogin);
  tabRegister?.addEventListener('click', showRegister);

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = (document.querySelector('#login-email') as HTMLInputElement | null)?.value ?? '';
    const password = (document.querySelector('#login-password') as HTMLInputElement | null)?.value ?? '';
    const result = await signInTeacher(email, password);
    if (loginMsg) loginMsg.textContent = result.ok ? (result.info ?? 'Prihlásený.') : (result.error ?? 'Prihlásenie zlyhalo.');
    if (result.ok) {
      // Same colored curtain as the student join — covers, switches behind it,
      // then sweeps off to reveal the teacher dashboard.
      await playLoginTransition(() => {
        window.location.hash = '/teacher';
      });
    }
  });

  registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = (document.querySelector('#register-name') as HTMLInputElement | null)?.value ?? '';
    const email = (document.querySelector('#register-email') as HTMLInputElement | null)?.value ?? '';
    const password = (document.querySelector('#register-password') as HTMLInputElement | null)?.value ?? '';
    const result = await signUpTeacher(email, password, name);
    if (registerMsg) registerMsg.textContent = result.info ?? result.error ?? '';
    if (result.ok) window.location.hash = '/pilot';
  });

  document.querySelector('#login-magic')?.addEventListener('click', async () => {
    const email = (document.querySelector('#login-email') as HTMLInputElement | null)?.value ?? '';
    const result = await signInWithMagicLink(email);
    if (loginMsg) loginMsg.textContent = result.info ?? result.error ?? '';
  });
}
