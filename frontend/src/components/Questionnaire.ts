/**
 * INVOK input/output questionnaire modal.
 *
 * Renders the 6 areas × 8 Likert statements (1–5) + 4 open questions, tracks
 * completion, submits to the server and shows a gamified result (XP + area
 * scores). Self-contained overlay; nothing else in the app is touched.
 *
 * Built entirely with safe DOM APIs (createElement + textContent) — no innerHTML,
 * so no content path can become an XSS vector.
 */
import {
  QUESTIONNAIRE_AREAS,
  OPEN_QUESTIONS,
  SCALE_LABELS,
  TOTAL_ITEMS,
} from '../services/questionnaireContent';
import { submitQuestionnaire, type QuestionnairePhase, type QuestionnaireResult } from '../services/questionnaireApi';

export interface QuestionnaireOpenOptions {
  phase: QuestionnairePhase;
  /** Called after a successful submit (e.g. to refresh the journey). */
  onDone?: () => void;
}

const PHASE_META: Record<QuestionnairePhase, { title: string; lead: string; emoji: string }> = {
  input: {
    title: 'Štartový dotazník',
    lead: 'Spoznaj sa na začiatku cesty. Nie sú správne ani zlé odpovede — odpovedaj úprimne.',
    emoji: '\u{1F680}',
  },
  output: {
    title: 'Záverečný dotazník',
    lead: 'Ukáž, ako si narástol/-la po absolvovaní modulov. Porovnáme to so štartom.',
    emoji: '\u{1F3C6}',
  },
};

type Child = Node | string;

function el(tag: string, attrs?: Record<string, string>, ...children: Child[]): HTMLElement {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else node.setAttribute(k, v);
    }
  }
  for (const child of children) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}

let overlayEl: HTMLElement | null = null;

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeQuestionnaire();
}

export function closeQuestionnaire(): void {
  if (!overlayEl) return;
  overlayEl.remove();
  overlayEl = null;
  document.removeEventListener('keydown', onKey);
}

function buildBody(): HTMLElement {
  const body = el('div', { class: 'q-body' });
  for (const area of QUESTIONNAIRE_AREAS) {
    const section = el('section', { class: 'q-area' }, el('h3', {}, `${area.id} · ${area.title}`));
    area.statements.forEach((statement, i) => {
      const key = `${area.id}${i + 1}`;
      const scale = el('div', { class: 'q-scale', role: 'radiogroup', 'aria-label': statement });
      for (const n of [1, 2, 3, 4, 5]) {
        const input = el('input', { type: 'radio', name: key, value: String(n) });
        scale.appendChild(el('label', { class: 'q-opt', title: SCALE_LABELS[n] }, input, el('span', {}, String(n))));
      }
      section.appendChild(el('div', { class: 'q-item' }, el('p', { class: 'q-stmt' }, statement), scale));
    });
    body.appendChild(section);
  }
  const openHead = el('h3', {}, 'Otvorené otázky ');
  openHead.appendChild(el('span', { class: 'muted', style: 'font-weight:normal' }, '(nepovinné)'));
  const openSec = el('section', { class: 'q-area' }, openHead);
  for (const q of OPEN_QUESTIONS) {
    const ta = el('textarea', { 'data-open': q.id, rows: '2', maxlength: '1000', placeholder: 'Napíš pár slov…' });
    openSec.appendChild(el('label', { class: 'q-open' }, el('span', {}, q.text), ta));
  }
  body.appendChild(openSec);
  return body;
}

function buildResult(result: QuestionnaireResult): HTMLElement {
  const list = el('ul', { class: 'q-result__areas' });
  for (const a of QUESTIONNAIRE_AREAS) {
    const score = result.areaScores?.[a.id] ?? 0;
    list.appendChild(el('li', {}, el('span', {}, a.title), el('strong', {}, `${score}/40`)));
  }
  const done = el('button', { class: 'btn btn--primary q-result__done', type: 'button' }, 'Super, pokračovať');
  const card = el(
    'div',
    { class: 'q-result__card' },
    el('div', { class: 'q-result__emoji' }, '\u{1F389}'),
    el('h2', { style: 'margin:0' }, 'Hotovo, super práca!'),
    el('div', { class: 'q-xp' }, `+${result.xpAwarded ?? 0} XP`),
    el('p', { class: 'muted', style: 'margin:0' }, `Celkové skóre: ${result.totalScore ?? 0}/${result.maxScore ?? 240}`),
    list,
    done,
  );
  done.addEventListener('click', () => closeQuestionnaire());
  return card;
}

export function openQuestionnaire(opts: QuestionnaireOpenOptions): void {
  if (typeof document === 'undefined') return;
  closeQuestionnaire();

  const m = PHASE_META[opts.phase];

  const closeBtn = el('button', { type: 'button', class: 'smarta-icon-btn q-close', 'aria-label': 'Zavrieť' }, '✕');
  const head = el(
    'header',
    { class: 'q-head' },
    el(
      'div',
      {},
      el('div', { class: 'q-head__kicker' }, `${m.emoji} INVOK dotazník`),
      el('h2', {}, m.title),
      el('p', { class: 'muted', style: 'margin:4px 0 0' }, m.lead),
    ),
    closeBtn,
  );

  const legend = el('div', { class: 'q-legend' });
  for (const [n, label] of Object.entries(SCALE_LABELS)) {
    legend.appendChild(el('span', { class: 'q-legend__item' }, el('b', {}, n), ` ${label}`));
  }

  const countEl = el('b', { 'data-q-count': '' }, '0');
  const msg = el('span', { class: 'muted q-msg', role: 'status', 'aria-live': 'polite' });
  const submit = el('button', { class: 'btn btn--primary q-submit', type: 'button' }, 'Odoslať dotazník') as HTMLButtonElement;
  submit.disabled = true;
  const foot = el(
    'footer',
    { class: 'q-foot' },
    el('span', { class: 'q-progress' }, countEl, `/${TOTAL_ITEMS} zodpovedaných`),
    msg,
    submit,
  );

  const resultSlot = el('div', { class: 'q-result' });
  resultSlot.hidden = true;

  const body = buildBody();
  const panel = el('div', { class: 'q-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': m.title }, head, legend, body, foot, resultSlot);

  const overlay = el('div', { class: 'q-overlay' }, panel);
  document.body.appendChild(overlay);
  overlayEl = overlay;
  document.addEventListener('keydown', onKey);

  const recount = (): void => {
    const answered = overlay.querySelectorAll('.q-scale input:checked').length;
    countEl.textContent = String(answered);
    submit.disabled = answered < TOTAL_ITEMS;
  };
  overlay.addEventListener('change', recount);
  closeBtn.addEventListener('click', () => closeQuestionnaire());
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeQuestionnaire();
  });

  submit.addEventListener('click', async () => {
    const answers: Record<string, number> = {};
    overlay.querySelectorAll<HTMLInputElement>('.q-scale input:checked').forEach((input) => {
      answers[input.name] = Number(input.value);
    });
    if (Object.keys(answers).length < TOTAL_ITEMS) {
      msg.textContent = 'Odpovedz prosím na všetky otázky.';
      return;
    }
    const openAnswers: Record<string, string> = {};
    overlay.querySelectorAll<HTMLTextAreaElement>('[data-open]').forEach((ta) => {
      const value = ta.value.trim();
      const id = ta.getAttribute('data-open');
      if (value && id) openAnswers[id] = value;
    });

    submit.disabled = true;
    submit.textContent = 'Odosielam…';
    msg.textContent = '';
    const result = await submitQuestionnaire(opts.phase, answers, openAnswers);
    submit.textContent = 'Odoslať dotazník';
    if (!result.ok) {
      msg.textContent = result.error ?? 'Uloženie zlyhalo.';
      submit.disabled = false;
      return;
    }
    resultSlot.replaceChildren(buildResult(result));
    resultSlot.hidden = false;
    opts.onDone?.();
  });
}
