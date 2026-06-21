/**
 * Akadémia — student video-course section. Module cards → lessons; a lesson opens
 * the player + quiz overlay. Completion (✓) comes from the server.
 */
import { ACADEMY_MODULES, findLesson } from '../services/academyContent';
import { fetchMyAcademy } from '../services/academyApi';
import { openAcademyLesson } from '../components/AcademyLesson';

let pendingMount: (() => void) | null = null;
let completed = new Set<string>();

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function moduleCard(module: (typeof ACADEMY_MODULES)[number]): string {
  const total = module.lessons.length;
  const done = module.lessons.filter((l) => completed.has(l.id)).length;
  const counter = total > 0 ? `<span class="chip chip--muted">${done}/${total}</span>` : '<span class="chip chip--muted">čoskoro</span>';
  const lessons =
    total > 0
      ? module.lessons
          .map((l) => {
            const isDone = completed.has(l.id);
            const locked = !l.videoUrl;
            const action = locked
              ? '<span class="chip chip--muted">pripravujeme</span>'
              : isDone
                ? `<button class="btn btn--ghost btn--sm" data-lesson="${esc(l.id)}">${'✅'} Pozrieť znova</button>`
                : `<button class="btn btn--primary btn--sm" data-lesson="${esc(l.id)}">Spustiť (+${l.xp} XP)</button>`;
            return `<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:10px 12px">
              <span style="min-width:0"><span style="margin-right:6px">${'\u{1F3AC}'}</span>${esc(l.title)} <span class="muted" style="font-size:var(--fs-xs)">· ${esc(l.durationLabel)}</span></span>
              ${action}
            </div>`;
          })
          .join('')
      : '<p class="muted" style="margin:6px 0 0">Lekcie tohto modulu pripravujeme — čoskoro pribudnú.</p>';
  return `<section class="card">
    <div class="card-title"><h3 style="margin:0">${module.emoji} ${esc(module.title)}</h3>${counter}</div>
    <div class="stack" style="gap:8px;margin-top:var(--space-3)">${lessons}</div>
  </section>`;
}

function render(): string {
  const cards = ACADEMY_MODULES.map(moduleCard).join('');
  return `
  <section>
    <div class="section-title"><h2 style="margin:0">${'\u{1F393}'} Akadémia</h2></div>
    <p class="muted" style="margin-top:0">Video lekcie podľa modulov. Pozri video, vyplň krátky kvíz a získaš XP. 🦊</p>
    <div class="stack" style="margin-top:var(--space-4)">${cards}</div>
  </section>`;
}

async function load(): Promise<void> {
  const slot = document.querySelector<HTMLElement>('#academy-slot');
  if (!slot) return;
  completed = new Set(await fetchMyAcademy());
  slot.innerHTML = render();
  for (const btn of Array.from(slot.querySelectorAll<HTMLButtonElement>('[data-lesson]'))) {
    btn.addEventListener('click', () => {
      const found = findLesson(btn.getAttribute('data-lesson') ?? '');
      if (found) openAcademyLesson({ moduleId: found.module.id, lesson: found.lesson, onDone: () => void load() });
    });
  }
}

export function AcademyPage(): string {
  pendingMount = () => {
    void load();
  };
  return `<div id="academy-slot"><p class="muted">Načítavam Akadémiu…</p></div>`;
}

export function mountAcademyPage(): void {
  pendingMount?.();
}
