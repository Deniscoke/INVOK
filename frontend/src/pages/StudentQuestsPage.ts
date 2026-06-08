/**
 * Student Quests page — "Moje misie".
 *
 * Two creation paths:
 *   1. Navrhnúť problém (manual)  – student fills the structured form below.
 *   2. AI návrh                   – calls the (server) generator; falls back
 *                                   to a guided template until the OpenAI
 *                                   integration is enabled in production.
 *
 * Limits & lifecycle: see services/questStore.ts. Each quest moves through
 *   pending_approval → approved → submitted → completed (or rejected /
 *   changes_requested back to draft).
 */

import { getSnapshot } from '../services/authService';
import {
  QUEST_LIMITS,
  createQuest,
  deleteQuest,
  getActiveQuestCount,
  listQuests,
  type QuestState,
  type StudentQuest,
} from '../services/questStore';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface StateBadge {
  label: string;
  chipClass: string;
  hint: string;
}

const STATE_BADGES: Record<QuestState, StateBadge> = {
  draft: { label: 'Koncept', chipClass: 'chip--muted', hint: 'Ešte neodoslané učiteľovi.' },
  pending_approval: {
    label: 'Čaká na učiteľa',
    chipClass: 'chip--warm',
    hint: 'Učiteľ ešte misiu nepotvrdil. Po schválení môžeš odovzdať.',
  },
  changes_requested: {
    label: 'Učiteľ pýta úpravu',
    chipClass: 'chip--warm',
    hint: 'Pozri spätnú väzbu a uprav návrh.',
  },
  approved: {
    label: 'Schválená',
    chipClass: 'chip--accent',
    hint: 'Učiteľ schválil. Môžeš začať pracovať a odovzdať.',
  },
  submitted: {
    label: 'Odovzdaná',
    chipClass: 'chip--accent',
    hint: 'Riešenie čaká na AI a učiteľské hodnotenie.',
  },
  completed: {
    label: 'Hotovo',
    chipClass: 'chip--muted',
    hint: 'Misia dokončená a ocenená.',
  },
  rejected: {
    label: 'Zamietnutá',
    chipClass: 'chip--muted',
    hint: 'Misiu učiteľ nepotvrdil.',
  },
};

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

function questCard(q: StudentQuest): string {
  const badge = STATE_BADGES[q.state];
  const canDelete = q.state !== 'approved' && q.state !== 'submitted';
  return `
  <article class="card" data-quest-id="${q.id}" style="border-left:4px solid var(--color-accent, #6366f1)">
    <div class="card-title">
      <div>
        <div class="muted" style="font-size:var(--fs-xs)">
          ${q.source === 'ai' ? '🤖 AI návrh' : '✨ Tvoj návrh'} · vytvorené ${formatDate(q.createdAt)}
        </div>
        <h3 style="margin:4px 0 0">${escapeHtml(q.title)}</h3>
      </div>
      <span class="chip ${badge.chipClass}" title="${badge.hint}">${badge.label}</span>
    </div>
    ${q.goal ? `<div class="mission__goal" style="margin-top:var(--space-3)"><strong>Cieľ:</strong> ${escapeHtml(q.goal)}</div>` : ''}
    ${q.affectedGroup ? `<p class="muted" style="margin:8px 0 0;font-size:var(--fs-sm)"><strong>Koho sa týka:</strong> ${escapeHtml(q.affectedGroup)}</p>` : ''}
    ${q.evidence ? `<p class="muted" style="margin:6px 0 0;font-size:var(--fs-sm)"><strong>Dôkaz:</strong> ${escapeHtml(q.evidence)}</p>` : ''}
    ${q.firstIdea ? `<p class="muted" style="margin:6px 0 0;font-size:var(--fs-sm)"><strong>Prvý nápad:</strong> ${escapeHtml(q.firstIdea)}</p>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:var(--space-3);align-items:center;margin-top:var(--space-3)">
      <span class="muted" style="font-size:var(--fs-xs)">
        <strong>Navrhnutý termín:</strong> ${formatDate(q.proposedDeadline)}
        ${q.approvedDeadline ? ` · <strong>schválený:</strong> ${formatDate(q.approvedDeadline)}` : ''}
      </span>
      ${q.teacherFeedback ? `<span class="chip chip--warm" title="${escapeHtml(q.teacherFeedback)}">spätná väzba učiteľa</span>` : ''}
    </div>
    ${canDelete
      ? `<div style="margin-top:var(--space-3)"><button type="button" class="btn btn--ghost btn--sm" data-action="delete-quest" data-quest-id="${q.id}">Zmazať</button></div>`
      : ''}
  </article>`;
}

function emptyStateCard(): string {
  return `
  <section class="card" style="text-align:center">
    <h3 style="margin-top:0">Žiadne misie zatiaľ</h3>
    <p class="muted">Vyber si jednu z dvoch ciest nižšie — buď navrhni vlastný problém,
      alebo nechaj AI pripraviť návrh v súlade s INVOK cieľmi a ŠVP ZV.
      Učiteľ misiu potvrdí a potom môžeš začať pracovať.</p>
  </section>`;
}

function creationPanels(): string {
  return `
  <div class="grid grid--2" style="gap:var(--space-4)">
    <section class="card" style="border-left:4px solid var(--color-success)">
      <h3 style="margin-top:0">✨ Navrhni vlastný problém</h3>
      <p class="muted" style="font-size:var(--fs-sm)">Všimni si problém vo svojej škole / komunite a pomenuj ho.</p>
      <form id="quest-propose-form" class="stack" novalidate>
        <label class="field">Názov misie
          <input id="q-title" type="text" maxlength="120" required placeholder="napr. Dlhé rady v jedálni">
        </label>
        <label class="field">Cieľ – čo chceš dosiahnuť
          <textarea id="q-goal" rows="2" maxlength="500" required placeholder="napr. Skrátiť čakanie o polovicu pomocou nového rozvrhu"></textarea>
        </label>
        <div class="grid grid--2" style="gap:var(--space-3)">
          <label class="field">Koho sa týka
            <input id="q-affected" type="text" maxlength="120" required placeholder="napr. žiaci 2. stupňa">
          </label>
          <label class="field">Termín (môj návrh)
            <input id="q-deadline" type="date">
          </label>
        </div>
        <label class="field">Dôkaz / čo si si všimol
          <textarea id="q-evidence" rows="2" maxlength="800" required placeholder="napr. 3 dni som meral čas v rade…"></textarea>
        </label>
        <label class="field">Prvý nápad na riešenie
          <textarea id="q-firstidea" rows="2" maxlength="800" required placeholder="napr. dva výdajné pulty cez 12:00…"></textarea>
        </label>
        <p id="quest-propose-msg" class="muted" role="status" aria-live="polite"></p>
        <button class="btn btn--primary" type="submit" id="quest-propose-btn">Poslať návrh učiteľovi</button>
      </form>
    </section>

    <section class="card" style="border-left:4px solid var(--color-accent)">
      <h3 style="margin-top:0">🤖 AI návrh misie</h3>
      <p class="muted" style="font-size:var(--fs-sm)">Napíš oblasť záujmu (napr. „triedenie odpadu“) a AI ti pripraví návrh v súlade s INVOK cieľmi a ŠVP ZV.</p>
      <form id="quest-ai-form" class="stack" novalidate>
        <label class="field">Oblasť záujmu
          <input id="q-ai-topic" type="text" maxlength="160" placeholder="napr. triedenie odpadu v triede" required>
        </label>
        <label class="field">Termín (môj návrh)
          <input id="q-ai-deadline" type="date">
        </label>
        <p id="quest-ai-msg" class="muted" role="status" aria-live="polite"></p>
        <button class="btn btn--primary" type="submit" id="quest-ai-btn">Vygenerovať návrh</button>
        <p class="muted" style="font-size:var(--fs-xs);margin:0">
          Pozn.: AI generátor cez OpenAI sa zapne v ďalšej iterácii. Zatiaľ ti pripravíme
          kostru misie, ktorú si môžeš upraviť a poslať učiteľovi.
        </p>
      </form>
    </section>
  </div>`;
}

export function StudentQuestsPage(): string {
  const user = getSnapshot().user;
  const alias = user?.displayName ?? 'žiak';
  const quests = listQuests();
  const activeCount = quests.filter((q) => q.state !== 'completed' && q.state !== 'rejected').length;
  const overLimit = activeCount >= QUEST_LIMITS.MAX_ACTIVE;

  return `
  <section class="card">
    <div class="card-title">
      <div>
        <div class="muted">Moje misie</div>
        <h2 style="margin:0">${escapeHtml(alias)}</h2>
      </div>
      <div>
        <span class="chip ${overLimit ? 'chip--warm' : 'chip--muted'}">
          ${activeCount} / ${QUEST_LIMITS.MAX_ACTIVE} aktívnych
        </span>
      </div>
    </div>
    <p class="muted" style="margin-top:var(--space-3)">
      Misie navrhuješ ty alebo AI v súlade s cieľmi INVOK a ŠVP ZV.
      <strong>Učiteľ ich schvaľuje pred odovzdaním</strong> a po odovzdaní hodnotí spolu s AI.
    </p>
  </section>

  ${overLimit ? `
  <section class="card" style="margin-top:var(--space-4);border-left:4px solid var(--color-danger);background:#fef2f2">
    <strong>Dosiahol si limit ${QUEST_LIMITS.MAX_ACTIVE} aktívnych misií.</strong>
    <p class="muted" style="margin:6px 0 0">Najprv zruš alebo dokonči nejakú misiu, potom môžeš pridať novú.</p>
  </section>` : ''}

  <section style="margin-top:var(--space-5)">
    <div class="section-title"><h2 style="margin:0">Aktuálne misie</h2></div>
    ${quests.length === 0 ? emptyStateCard() : `<div class="stack" style="gap:var(--space-4)">${quests.map(questCard).join('')}</div>`}
  </section>

  <section style="margin-top:var(--space-6)">
    <div class="section-title"><h2 style="margin:0">Pridaj novú misiu</h2></div>
    ${overLimit
      ? '<p class="muted">Pridávanie misií je deaktivované — najprv zruš alebo dokonči existujúcu.</p>'
      : creationPanels()}
  </section>`;
}

function readVal(selector: string): string {
  const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
  return el?.value.trim() ?? '';
}

function refresh(): void {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function bindDelete(): void {
  for (const btn of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action="delete-quest"]'))) {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-quest-id');
      if (!id) return;
      const confirmed = window.confirm('Naozaj zmazať túto misiu?');
      if (!confirmed) return;
      const res = deleteQuest(id);
      if (!res.ok) {
        window.alert(res.error ?? 'Nepodarilo sa zmazať.');
        return;
      }
      refresh();
    });
  }
}

function bindProposeForm(): void {
  const form = document.querySelector<HTMLFormElement>('#quest-propose-form');
  const msg = document.querySelector<HTMLParagraphElement>('#quest-propose-msg');
  const btn = document.querySelector<HTMLButtonElement>('#quest-propose-btn');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (msg) msg.textContent = '';

    const input = {
      title: readVal('#q-title'),
      goal: readVal('#q-goal'),
      affectedGroup: readVal('#q-affected'),
      evidence: readVal('#q-evidence'),
      firstIdea: readVal('#q-firstidea'),
      proposedDeadline: readVal('#q-deadline') || undefined,
      source: 'student' as const,
    };

    if (input.title.length < 3) {
      if (msg) msg.textContent = 'Daj misii krátky názov (min. 3 znaky).';
      return;
    }
    if (input.goal.length < 10) {
      if (msg) msg.textContent = 'Popíš cieľ misie (min. 10 znakov).';
      return;
    }
    if (input.evidence.length < 5 || input.firstIdea.length < 5) {
      if (msg) msg.textContent = 'Doplň dôkaz aj prvý nápad (min. 5 znakov).';
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Odosielam…'; }
    const result = createQuest(input);
    if (btn) { btn.disabled = false; btn.textContent = 'Poslať návrh učiteľovi'; }

    if (!result.ok) {
      if (msg) msg.textContent = result.error ?? 'Nepodarilo sa uložiť.';
      return;
    }
    if (msg) msg.textContent = 'Návrh poslaný učiteľovi. Po schválení môžeš odovzdať riešenie.';
    setTimeout(refresh, 350);
  });
}

function bindAiForm(): void {
  const form = document.querySelector<HTMLFormElement>('#quest-ai-form');
  const msg = document.querySelector<HTMLParagraphElement>('#quest-ai-msg');
  const btn = document.querySelector<HTMLButtonElement>('#quest-ai-btn');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (msg) msg.textContent = '';

    const topic = readVal('#q-ai-topic');
    const deadline = readVal('#q-ai-deadline') || undefined;

    if (topic.length < 3) {
      if (msg) msg.textContent = 'Napíš aspoň krátku oblasť záujmu.';
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Generujem…'; }
    // Phase A: scaffold a credible template that the student then refines.
    // Phase B will replace this with a real call to /api/student/quests/generate
    // backed by OpenAI (gpt-5.x).
    const template = scaffoldFromTopic(topic);
    const result = createQuest({
      title: template.title,
      goal: template.goal,
      affectedGroup: template.affectedGroup,
      evidence: template.evidence,
      firstIdea: template.firstIdea,
      proposedDeadline: deadline,
      source: 'ai',
    });
    if (btn) { btn.disabled = false; btn.textContent = 'Vygenerovať návrh'; }

    if (!result.ok) {
      if (msg) msg.textContent = result.error ?? 'Nepodarilo sa uložiť.';
      return;
    }
    if (msg) {
      msg.textContent =
        'Návrh pripravený a poslaný učiteľovi (offline šablóna). Plné AI generovanie z OpenAI sa zapne v ďalšej iterácii.';
    }
    setTimeout(refresh, 600);
  });
}

function scaffoldFromTopic(topic: string): {
  title: string;
  goal: string;
  affectedGroup: string;
  evidence: string;
  firstIdea: string;
} {
  const cleanTopic = topic.replace(/^./, (c) => c.toLowerCase());
  return {
    title: `Misia: ${topic.charAt(0).toUpperCase()}${topic.slice(1)}`,
    goal: `Urobiť jeden konkrétny krok, ktorý zlepší situáciu v oblasti „${cleanTopic}“ v našej triede / škole.`,
    affectedGroup: 'naša trieda',
    evidence: `Zmapovať aktuálny stav v oblasti „${cleanTopic}“ — pozorovanie, krátky rozhovor alebo merania (3–5 dní).`,
    firstIdea: `Navrhnúť 1 konkrétne zlepšenie v oblasti „${cleanTopic}“ a otestovať ho v malom (napr. jeden týždeň).`,
  };
}

export function mountStudentQuestsPage(): void {
  bindDelete();
  bindProposeForm();
  bindAiForm();
}
