/**
 * Plays the full-screen colorful wipe overlay shown when a student successfully
 * joins a class. Resolves once the overlay has faded out and been removed, so
 * the caller can navigate "behind" it for a seamless reveal of the dashboard.
 *
 * Self-cleaning and pointer-events:none — even if navigation fails the overlay
 * always removes itself. Honors prefers-reduced-motion with a shorter, calmer
 * fade (the animation cycles bright colors).
 */
export function playLoginTransition(durationMs = 1900): Promise<void> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve();
      return;
    }

    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const overlay = document.createElement('div');
    overlay.className = 'invok-login-transition';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = Array.from({ length: 8 }, () => '<span></span>').join('');
    document.body.appendChild(overlay);

    const hold = reduce ? 500 : durationMs;
    window.setTimeout(() => {
      overlay.classList.add('invok-login-transition--out');
      window.setTimeout(() => {
        overlay.remove();
        resolve();
      }, 320);
    }, hold);
  });
}
