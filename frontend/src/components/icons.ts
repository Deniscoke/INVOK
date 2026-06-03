/**
 * Compact inline-SVG icon set (stroke-based, inherits `currentColor`).
 * No external assets. Used by competency / mission / badge cards.
 */
const PATHS: Record<string, string> = {
  magnifier: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5"/>',
  lightbulb: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.4 1 2.5h6c0-1.1.3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M15 19a4.2 4.2 0 0 1 5.5-2.6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  heart: '<path d="M12 20s-7-4.6-7-9.4A3.6 3.6 0 0 1 12 8a3.6 3.6 0 0 1 7 2.6C19 15.4 12 20 12 20z"/>',
  coins: '<ellipse cx="9" cy="7.5" rx="5" ry="2.6"/><path d="M4 7.5v4c0 1.4 2.2 2.6 5 2.6s5-1.2 5-2.6v-4"/><path d="M10 16.4c.9 1 2.9 1.6 5 1.6 2.8 0 5-1.2 5-2.6v-4"/>',
  leaf: '<path d="M5 19c0-8 6-13 14-13 0 8-5 14-13 14"/><path d="M5 19c3-4 6-6 9-7"/>',
  star: '<path d="M12 3l2.6 5.6 6 .7-4.4 4 1.2 6L12 16.9 6.6 19.3l1.2-6L3.4 9.3l6-.7z"/>',
  rocket: '<path d="M5 15c-1 2-1 4-1 4s2 0 4-1"/><path d="M14 5c3-1 6 2 5 5-1 3-5 6-8 7l-4-4c1-3 4-7 7-8z"/><circle cx="14.5" cy="9.5" r="1.6"/>',
  map: '<path d="M9 4L4 6v14l5-2 6 2 5-2V4l-5 2-6-2z"/><path d="M9 4v14"/><path d="M15 6v14"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  mirror: '<rect x="6" y="3" width="12" height="14" rx="6"/><path d="M12 17v4"/><path d="M9 21h6"/>',
  flame: '<path d="M12 3c1 3-2 4-2 7a3 3 0 0 0 6 0c0-1-.4-2-1-2.6C16 9 17 11 17 13a5 5 0 0 1-10 0c0-4 4-6 5-10z"/>',
  fox: '<path d="M5 6l4 4M19 6l-4 4"/><path d="M12 7c4 0 7 3 7 7s-3 6-7 6-7-2-7-6 3-7 7-7z"/><circle cx="9.5" cy="13" r="1"/><circle cx="14.5" cy="13" r="1"/>',
};

export function icon(name: string, size = 22): string {
  const path = PATHS[name] ?? PATHS.star;
  return (
    `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    'fill="none" stroke="currentColor" stroke-width="1.8" ' +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`
  );
}
