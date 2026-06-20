/**
 * Smarta's 2D avatar.
 *
 * MVP renders an inline SVG anime-style head/shoulders with a mouth element that
 * the lip-sync engine opens/closes via `setMouthOpen(0..1)`. The avatar is kept
 * behind a small abstraction so it can later be swapped for PNG layers, visemes
 * or a Live2D model WITHOUT touching the chat / TTS / lip-sync code.
 *
 * To use your own PNGs instead of the SVG:
 *   1. Drop the files in `public/smarta/` (avatar_base.png, mouth_closed.png,
 *      mouth_open.png) — see public/smarta/README.md.
 *   2. Set AVATAR_MODE = 'png' below.
 * In PNG mode `setMouthOpen` swaps mouth_closed ⇄ mouth_open at a threshold.
 */
// 'frames' = full-portrait swap closed↔open driven by voice amplitude (current).
//            Uses public/smarta/avatar_base.png (closed) + frame_open.png (open).
// 'image'  = single base PNG with a voice-reactive pulse (no mouth swap).
// 'png'    = avatar_base + cropped mouth_closed/mouth_open overlays.
// 'svg'    = built-in inline SVG (no assets needed).
const AVATAR_MODE: 'svg' | 'image' | 'png' | 'frames' = 'frames';

export interface SmartaAvatar {
  /** Root element to insert into the DOM. */
  el: HTMLElement;
  /** 0 = closed, 1 = fully open. Called every animation frame during speech. */
  setMouthOpen: (amount: number) => void;
  /** Toggles the speaking state (idle bob / glow); also resets the mouth. */
  setSpeaking: (speaking: boolean) => void;
  /** Optional: warm up heavy assets (e.g. when the panel first opens). */
  preload?: () => void;
}

// --- Lip-sync tuning (safe to tweak; see public/smarta/README.md) -----------
// setMouthOpen(0..1) is driven by a timer while Smarta speaks (see tts.ts).
// Threshold + minimum hold keep the open/closed frame swap crisp, not flickery.
const OPEN_AT = 0.22;   // open the mouth above this level
const CLOSE_AT = 0.12;  // close the mouth below this level
const MIN_HOLD_MS = 42; // don't swap frames faster than this (allows snappier talk)

const FACE_SVG = `
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M14 120 Q60 84 106 120 Z" fill="#6C5CE7"/>
  <rect x="52" y="72" width="16" height="16" rx="6" fill="#FBE0CC"/>
  <circle cx="60" cy="52" r="38" fill="#3A2E66"/>
  <ellipse cx="60" cy="56" rx="30" ry="32" fill="#FBE0CC"/>
  <path d="M30 50 Q40 22 60 21 Q80 22 90 50 Q78 35 60 35 Q42 35 30 50 Z" fill="#4A3A82"/>
  <ellipse cx="48" cy="58" rx="6.5" ry="8" fill="#fff"/>
  <ellipse cx="72" cy="58" rx="6.5" ry="8" fill="#fff"/>
  <circle cx="48" cy="60" r="4.2" fill="#2D2A45"/>
  <circle cx="72" cy="60" r="4.2" fill="#2D2A45"/>
  <circle cx="49.6" cy="58.4" r="1.4" fill="#fff"/>
  <circle cx="73.6" cy="58.4" r="1.4" fill="#fff"/>
  <circle cx="39" cy="68" r="4" fill="#F6B6C6" opacity=".7"/>
  <circle cx="81" cy="68" r="4" fill="#F6B6C6" opacity=".7"/>
  <ellipse class="smarta-avatar__mouth" cx="60" cy="74" rx="5" ry="1.2" fill="#B5455F"/>
</svg>`;

function createSvgAvatar(): SmartaAvatar {
  const el = document.createElement('div');
  el.className = 'smarta-avatar';
  el.innerHTML = FACE_SVG;
  const mouth = el.querySelector<SVGEllipseElement>('.smarta-avatar__mouth');
  return {
    el,
    setMouthOpen(amount: number): void {
      if (!mouth) return;
      const v = Math.max(0, Math.min(1, amount));
      mouth.setAttribute('ry', (0.8 + v * 6).toFixed(2));
    },
    setSpeaking(speaking: boolean): void {
      el.classList.toggle('smarta-avatar--speaking', speaking);
      if (!speaking && mouth) mouth.setAttribute('ry', '1.2');
    },
  };
}

function createPngAvatar(): SmartaAvatar {
  const el = document.createElement('div');
  el.className = 'smarta-avatar smarta-avatar--png';
  el.innerHTML = `
    <img class="smarta-avatar__base" src="/smarta/avatar_base.png" alt="Smarta">
    <img class="smarta-avatar__mouth-img" src="/smarta/mouth_closed.png" alt="" data-closed="/smarta/mouth_closed.png" data-open="/smarta/mouth_open.png">`;
  const mouthImg = el.querySelector<HTMLImageElement>('.smarta-avatar__mouth-img');
  let openState = false;
  const setMouthOpen = (amount: number): void => {
    if (!mouthImg) return;
    const shouldOpen = amount > 0.18;
    if (shouldOpen === openState) return;
    openState = shouldOpen;
    mouthImg.src = shouldOpen ? mouthImg.dataset.open ?? '' : mouthImg.dataset.closed ?? '';
  };
  return {
    el,
    setMouthOpen,
    setSpeaking(speaking: boolean): void {
      el.classList.toggle('smarta-avatar--speaking', speaking);
      if (!speaking) setMouthOpen(0);
    },
  };
}

/**
 * Single base image (no mouth frames). Until cropped mouth_closed/mouth_open
 * art exists, we give "speaking" feedback via a subtle voice-reactive pulse +
 * the idle bob. Swap to AVATAR_MODE 'png' once mouth frames are added.
 */
function createImageAvatar(): SmartaAvatar {
  const el = document.createElement('div');
  el.className = 'smarta-avatar smarta-avatar--img';
  el.innerHTML = '<img class="smarta-avatar__base" src="/smarta/avatar_base.png" alt="Smarta">';
  const img = el.querySelector<HTMLImageElement>('img');
  return {
    el,
    setMouthOpen(amount: number): void {
      if (!img) return;
      const v = Math.max(0, Math.min(1, amount));
      img.style.transform = `scale(${(1 + v * 0.045).toFixed(3)})`;
    },
    setSpeaking(speaking: boolean): void {
      el.classList.toggle('smarta-avatar--speaking', speaking);
      if (!speaking && img) img.style.transform = '';
    },
  };
}

/**
 * Frame-swap avatar: two full portraits (closed + open) stacked; the open frame
 * fades in/out based on the (smoothed, hysteresis-gated) voice loudness. Chosen
 * frames must share the same framing — see SMARTA classification in the docs.
 * The open frame is heavy, so it's lazy-loaded on first speak / preload().
 */
function createFramesAvatar(): SmartaAvatar {
  const el = document.createElement('div');
  el.className = 'smarta-avatar smarta-avatar--frames';
  el.innerHTML =
    '<img class="smarta-frame smarta-frame--closed" src="/smarta/avatar_base.png" alt="Smarta">' +
    '<img class="smarta-frame smarta-frame--open" alt="" data-src="/smarta/frame_open.png">';
  const openImg = el.querySelector<HTMLImageElement>('.smarta-frame--open');

  let openShown = false;
  let lastSwap = 0;

  function ensureOpenLoaded(): void {
    if (openImg && !openImg.getAttribute('src') && openImg.dataset.src) {
      openImg.src = openImg.dataset.src;
    }
  }
  function apply(open: boolean): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (open === openShown || now - lastSwap < MIN_HOLD_MS) return;
    openShown = open;
    lastSwap = now;
    el.classList.toggle('is-open', open);
  }

  return {
    el,
    preload: ensureOpenLoaded,
    setMouthOpen(amount: number): void {
      const v = Math.max(0, Math.min(1, amount));
      if (v > OPEN_AT) apply(true);
      else if (v < CLOSE_AT) apply(false);
    },
    setSpeaking(speaking: boolean): void {
      el.classList.toggle('smarta-avatar--speaking', speaking);
      if (speaking) {
        ensureOpenLoaded();
      } else {
        openShown = false;
        el.classList.remove('is-open');
      }
    },
  };
}

export function createAvatar(): SmartaAvatar {
  if (AVATAR_MODE === 'frames') return createFramesAvatar();
  if (AVATAR_MODE === 'png') return createPngAvatar();
  if (AVATAR_MODE === 'image') return createImageAvatar();
  return createSvgAvatar();
}
