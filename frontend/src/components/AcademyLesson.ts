/**
 * Akadémia lesson overlay — video player + a short quiz. On pass (>= 60%) it
 * records completion server-side and grants XP, then shows a gamified result.
 * Quiz/lesson text comes from the trusted static config and is escaped anyway.
 */
import { completeAcademyLesson } from '../services/academyApi';
import type { AcademyLesson } from '../services/academyContent';

export interface OpenLessonOptions {
  moduleId: string;
  lesson: AcademyLesson;
  onDone?: () => void;
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let overlayEl: HTMLElement | null = null;
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeLesson();
}
export function closeLesson(): void {
  if (!overlayEl) return;
  overlayEl.remove();
  overlayEl = null;
  document.removeEventListener('keydown', onKey);
}

function quizHtml(lesson: AcademyLesson): string {
  return lesson.quiz
    .map((q, qi) => {
      const opts = q.options
        .map((o, oi) => `<label class="ac-opt"><input type="radio" name="q${qi}" value="${oi}"><span>${esc(o)}</span></label>`)
        .join('');
      return `<div class="ac-q"><p class="ac-q__text">${qi + 1}. ${esc(q.q)}</p>${opts}</div>`;
    })
    .join('');
}

function panelHtml(lesson: AcademyLesson): string {
  return `
  <div class="academy-lesson__panel">
    <header class="ac-head">
      <strong>${esc(lesson.title)}</strong>
      <button type="button" class="smarta-icon-btn ac-close" aria-label="Zavrieť">✕</button>
    </header>
    <div class="ac-body">
      <video class="ac-video" controls preload="metadata" playsinline src="${esc(lesson.videoUrl ?? '')}"></video>
      <p class="ac-desc">${esc(lesson.description)}</p>
      <div class="ac-quiz">
        <h3 style="margin:0 0 var(--space-2)">Krátky kvíz</h3>
        ${quizHtml(lesson)}
        <p class="muted ac-msg" data-msg role="status" aria-live="polite"></p>
        <button class="btn btn--primary ac-submit" type="button">Vyhodnotiť kvíz (+${lesson.xp} XP)</button>
      </div>
      <div class="ac-result" data-result hidden></div>
    </div>
  </div>`;
}

function resultHtml(xp: number, alreadyDone: boolean): string {
  return `
  <div class="ac-result__card">
    <div class="ac-result__emoji">${'\u{1F389}'}</div>
    <h2 style="margin:0">Lekcia hotová!</h2>
    <div class="ac-xp">${alreadyDone ? 'Už máš túto lekciu' : `+${xp} XP`}</div>
    <p class="muted" style="margin:0">Pokračuj ďalšou lekciou alebo si vyskúšaj projektovú výzvu.</p>
    <button class="btn btn--primary ac-result__done" type="button">Super, pokračovať</button>
  </div>`;
}

export function openAcademyLesson(opts: OpenLessonOptions): void {
  if (typeof document === 'undefined') return;
  closeLesson();
  const { moduleId, lesson } = opts;

  const overlay = document.createElement('div');
  overlay.className = 'academy-lesson-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', lesson.title);
  overlay.innerHTML = panelHtml(lesson);
  document.body.appendChild(overlay);
  overlayEl = overlay;
  document.addEventListener('keydown', onKey);

  const msg = overlay.querySelector<HTMLElement>('[data-msg]');
  const submit = overlay.querySelector<HTMLButtonElement>('.ac-submit');
  const resultEl = overlay.querySelector<HTMLElement>('[data-result]');

  overlay.querySelector('.ac-close')?.addEventListener('click', () => closeLesson());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeLesson();
  });

  submit?.addEventListener('click', async () => {
    const answeredAll = lesson.quiz.every((_, qi) => overlay.querySelector(`input[name="q${qi}"]:checked`));
    if (!answeredAll) {
      if (msg) msg.textContent = 'Odpovedz prosím na všetky otázky.';
      return;
    }
    let score = 0;
    lesson.quiz.forEach((q, qi) => {
      const sel = overlay.querySelector<HTMLInputElement>(`input[name="q${qi}"]:checked`);
      if (sel && Number(sel.value) === q.correct) score += 1;
    });
    const max = lesson.quiz.length;

    submit.disabled = true;
    submit.textContent = 'Odosielam…';
    const res = await completeAcademyLesson(moduleId, lesson.id, score, max);
    submit.disabled = false;
    submit.textContent = `Vyhodnotiť kvíz (+${lesson.xp} XP)`;

    if (!res.ok) {
      if (msg) msg.textContent = res.error ?? 'Uloženie zlyhalo.';
      return;
    }
    if (!res.passed) {
      const need = Math.ceil(max * 0.6);
      if (msg) msg.textContent = `Máš ${score}/${max}. Potrebuješ aspoň ${need} — pozri video ešte raz a skús to znova. 💪`;
      return;
    }
    if (resultEl) {
      resultEl.innerHTML = resultHtml(res.xpAwarded ?? 0, res.alreadyDone ?? false);
      resultEl.hidden = false;
      resultEl.querySelector('.ac-result__done')?.addEventListener('click', () => closeLesson());
    }
    opts.onDone?.();
  });
}
