/**
 * Inline-SVG mascot — a friendly fox ("Líška"), tying into the pseudonymous
 * student aliases. No external image is loaded.
 */
export interface MascotOptions {
  size?: number;
  className?: string;
}

export function Mascot({ size = 96, className = '' }: MascotOptions = {}): string {
  return `
  <svg class="mascot ${className}" width="${size}" height="${size}" viewBox="0 0 120 120"
       role="img" aria-label="Maskot líška">
    <defs>
      <linearGradient id="foxBody" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffb169"/>
        <stop offset="1" stop-color="#ff8a3d"/>
      </linearGradient>
    </defs>
    <path d="M26 32 L40 6 L54 36 Z" fill="#ff8a3d"/>
    <path d="M94 32 L80 6 L66 36 Z" fill="#ff8a3d"/>
    <path d="M33 30 L40 15 L47 31 Z" fill="#ffd9bd"/>
    <path d="M87 30 L80 15 L73 31 Z" fill="#ffd9bd"/>
    <path d="M60 24 C87 24 99 45 99 64 C99 87 81 101 60 101 C39 101 21 87 21 64 C21 45 33 24 60 24 Z" fill="url(#foxBody)"/>
    <path d="M60 50 C77 50 87 63 85 78 C83 91 70 97 60 97 C50 97 37 91 35 78 C33 63 43 50 60 50 Z" fill="#fff4ec"/>
    <circle cx="47" cy="60" r="5.4" fill="#2b2540"/>
    <circle cx="73" cy="60" r="5.4" fill="#2b2540"/>
    <circle cx="48.6" cy="58.2" r="1.7" fill="#fff"/>
    <circle cx="74.6" cy="58.2" r="1.7" fill="#fff"/>
    <path d="M60 74 l-7 -7 h14 z" fill="#2b2540"/>
    <path d="M53 82 q7 7 14 0" stroke="#2b2540" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  </svg>`;
}
