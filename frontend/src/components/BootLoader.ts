/**
 * Epic boot splash — shown once per full page load, then fades to reveal the app.
 *
 * Pure CSS animation (see styles/boot.css); this module only builds the DOM,
 * times the hold, and removes the overlay. It is fully self-cleaning and never
 * traps the UI: it auto-finishes after the hold, can be skipped by click/keypress,
 * and shortens under prefers-reduced-motion.
 *
 * Because the router is hash-based, main.ts runs once per real page load, so this
 * naturally plays on entry/refresh — not on in-app navigation.
 */
const WORD = 'INVOK';

export function mountBootLoader(): void {
  if (typeof document === 'undefined') return;

  const reduce =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const HOLD_MS = reduce ? 900 : 4200; // on-screen time before the bar completes
  const FADE_MS = 700; // must match the .invok-boot transition in boot.css

  const el = document.createElement('div');
  el.className = 'invok-boot';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', 'Načítava sa INVOK');
  el.style.setProperty('--boot-hold', `${HOLD_MS}ms`);

  const letters = WORD.split('')
    .map((c) => `<span class="ib-l"><b>${c}</b></span>`)
    .join('');
  const spheres = Array.from({ length: 7 }, (_, i) => `<span class="ib-sp ib-sp--${i + 1}"></span>`).join('');

  el.innerHTML = `
    <div class="invok-boot__grain"></div>
    <div class="invok-boot__spheres" aria-hidden="true">${spheres}</div>
    <div class="invok-boot__stage">
      <div class="invok-boot__word" aria-hidden="true">${letters}</div>
      <p class="invok-boot__tagline">Misie pre rast</p>
      <div class="invok-boot__bar" aria-hidden="true"><i></i></div>
    </div>`;

  document.body.appendChild(el);
  document.documentElement.classList.add('invok-boot-lock');

  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    el.classList.add('is-leaving');
    document.documentElement.classList.remove('invok-boot-lock');
    window.removeEventListener('keydown', finish);
    window.setTimeout(() => el.remove(), FADE_MS + 80);
  };

  // Bar finishes ~0.4s after HOLD_MS (its start delay); wait a beat past that.
  window.setTimeout(finish, HOLD_MS + 550);
  el.addEventListener('click', finish);
  window.addEventListener('keydown', finish);
}
