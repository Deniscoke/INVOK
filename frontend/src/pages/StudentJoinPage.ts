import { Mascot } from '../components/Mascot';
import { joinAsStudent } from '../services/authService';

export function StudentJoinPage(): string {
  return `
  <section class="auth-page">
    <div style="text-align:center">${Mascot({ size: 96 })}</div>
    <h1>Pripoj sa do triedy</h1>
    <p class="muted">Zadaj kód od učiteľa. Nepotrebuješ e-mail. Ak máš osobný kód,
      prezývku už máš pridelenú — pole nechaj prázdne.</p>
    <form id="join-form" class="card stack" novalidate>
      <label class="field">Kód
        <input id="join-code" type="text" autocomplete="off" inputmode="latin" placeholder="napr. ABC123" required>
      </label>
      <label class="field">Prezývka (len pri kóde triedy)
        <input id="join-pseudonym" type="text" autocomplete="off" placeholder="napr. Líška-07">
      </label>
      <button class="btn btn--primary" type="submit">Pripojiť sa</button>
      <p id="join-msg" class="muted" role="status" aria-live="polite"></p>
    </form>
  </section>`;
}

export function mountStudentJoinPage(): void {
  const form = document.querySelector<HTMLFormElement>('#join-form');
  const msg = document.querySelector<HTMLElement>('#join-msg');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = (document.querySelector('#join-code') as HTMLInputElement | null)?.value ?? '';
    const pseudonym = (document.querySelector('#join-pseudonym') as HTMLInputElement | null)?.value ?? '';
    const result = await joinAsStudent(code, pseudonym);
    if (msg) msg.textContent = result.ok ? `Vitaj, ${result.studentAlias}!` : (result.error ?? 'Pripojenie zlyhalo.');
    if (result.ok) window.location.hash = '/student';
  });
}
