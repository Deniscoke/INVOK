/**
 * Brand / EU-funding marks used in the footer (and reusable by certificates).
 *
 * The EU emblem is generated as an accurate inline SVG (12 upright gold stars on
 * Reflex Blue) so it never depends on an external asset and is always correct.
 * The partner marks (PSC n.o., Program Slovensko, Ministerstvo práce SR) render
 * as clean text wordmarks for now; drop official logos into `public/brand/` and
 * we can swap them to <img> without touching layout. See public/brand/README.md.
 *
 * EU publicity is a funding obligation (Program Slovensko 2021–2027): the emblem
 * + "Spolufinancované Európskou úniou" must be shown, the emblem at least as large
 * as any other logo.
 */

/** One upright five-pointed star centered at (cx,cy) with outer radius `ro`. */
function euStar(cx: number, cy: number, ro: number): string {
  const ri = ro * 0.382;
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? ro : ri;
    const a = ((-90 + k * 36) * Math.PI) / 180; // first point straight up
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="#FFCC00"/>`;
}

/** Accurate EU flag as inline SVG at the given pixel height. */
export function euEmblem(height = 30): string {
  const w = Math.round(height * 1.5);
  const cx = 30;
  const cy = 20;
  const ringR = 13;
  const starR = 2.4;
  let stars = '';
  for (let i = 0; i < 12; i++) {
    const phi = ((90 - i * 30) * Math.PI) / 180; // clockwise from 12 o'clock
    stars += euStar(cx + ringR * Math.cos(phi), cy - ringR * Math.sin(phi), starR);
  }
  return `<svg class="eu-emblem" viewBox="0 0 60 40" width="${w}" height="${height}" role="img" aria-label="Vlajka Európskej únie"><rect width="60" height="40" rx="2" fill="#003399"/>${stars}</svg>`;
}

/** Official funding statement (verbatim wording, Program Slovensko). */
export const FUNDING_STATEMENT =
  'Program INVOK je realizovaný vďaka podpore Európskej únie prostredníctvom programu Program Slovensko a Ministerstva práce, sociálnych vecí a rodiny Slovenskej republiky. Pre školy bez poplatkov.';

/** Partner wordmarks shown next to the EU emblem. */
export const PARTNERS: readonly string[] = [
  'PSC n.o.',
  'Program Slovensko',
  'Ministerstvo práce, sociálnych vecí a rodiny SR',
];
