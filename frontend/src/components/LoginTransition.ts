/**
 * Student login curtain — see styles/login-transition.css.
 *
 * Sequence:
 *   1. Overlay appears and colored columns rise to COVER the screen.
 *   2. Once covered, `onCovered()` fires → caller switches to the dashboard
 *      *behind* the cover (no flash of page-switching).
 *   3. Columns sweep off the top, REVEALING the dashboard. Promise resolves
 *      after the overlay is removed.
 *
 * Self-cleaning + pointer-events:none, so it can never trap the UI. Honors
 * prefers-reduced-motion with a faster, calmer version.
 */
export function playLoginTransition(onCovered?: () => void): Promise<void> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      onCovered?.();
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
    overlay.innerHTML = Array.from({ length: 6 }, () => '<span></span>').join('');
    document.body.appendChild(overlay);

    // Must stay in sync with the keyframes in login-transition.css.
    const COVER_MS = reduce ? 220 : 700; // screen fully covered → switch page now
    const TOTAL_MS = reduce ? 560 : 1450; // columns gone → remove overlay

    let switched = false;
    const doSwitch = (): void => {
      if (switched) return;
      switched = true;
      onCovered?.();
    };

    window.setTimeout(doSwitch, COVER_MS);
    window.setTimeout(() => {
      doSwitch(); // safety: ensure the page switched even if a timer was throttled
      overlay.remove();
      resolve();
    }, TOTAL_MS);
  });
}
