/**
 * Student Quests page — "Moje misie".
 *
 * Two creation paths:
 *   1. Navrhnúť problém (manual)  – student fills the structured form.
 *   2. AI návrh                   – calls /api/student/quests/generate
 *                                   (OpenAI-backed when configured), then
 *                                   stages the draft so the student can
 *                                   review + tweak before sending to the
 *                                   teacher.
 *
 * Limits & lifecycle live in services/questStore.ts. Each quest moves
 * through pending_approval → approved → submitted → completed (or
 * rejected / changes_requested back to draft).
 */

import { getSnapshot } from '../services/authService';
import {
  QUEST_LIMITS,
  countActive,
  createQuest,
  deleteQuest,
  generateQuestDraft,
  listQuests,
  type QuestState,
  type StudentQuest,
} from '../services/questStore';

let pendingMount: (() => void) | null = null;

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
  pending_approval: { label: 'Čaká na učiteľa', chipClass: 'chip--warm', hint: 'Učiteľ misiu ešte nepotvrdil.' },
  changes_requested: { label: 'Učiteľ pýta úpravu', chipClass: 'chip--warm', hint: 'Pozri spätnú väzbu a uprav návrh.' },
  approved: { label: 'Schválená', chipClass: 'chip--accent', hint: 'Učiteľ schválil. Môžeš odovzdať riešenie.' },
  submitted: { label: 'Odovzdaná', chipClass: 'chip--accent', hint: 'Riešenie čaká na AI a učiteľské hodnotenie.' },
  completed: { label: 'Hotovo', chipClass: 'chip--muted', hint: 'Misia dokončená a ocenená.' },
  rejected: { label: 'Zamietnutá', chipClass: 'chip--muted', hint: 'Misiu učiteľ nepotvrdil.' },
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
  const badge = STATE_BADGES[q.state] ?? STATE_BADGES.draft;
  const canDelete = q.state !== 'approved' && q.state !== 'submitted' && q.state !== 'completed';
  return `
  <article class="card" data-quest-id="${escapeHtml(q.id)}" style="border-left:4px solid var(--color-accent, #6366f1)">
    <div class="card-title">
      <div>
        <div class="muted" style="font-size:var(--fs-xs)">
          ${q.source === 'ai' ? '🤖 AI návrh' : '✨ Tvoj návrh'} · vytvorené ${formatDate(q.createdAt)}
        </div>
        <h3 style="margin:4px 0 0">${escapeHtml(q.title)}</h3>
      </div>
      <span class="chip ${badge.chipClass}" title="${escapeHtml(badge.hint)}">${badge.label}</span>
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
      ${q.aiModel ? `<span class="muted" style="font-size:var(--fs-xs)">model: ${escapeHtml(q.aiModel)}</span>` : ''}
    </div>
    ${q.teacherFeedback ? `<div class="teacher-hint" style="margin-top:var(--space-3)">
      <div class="teacher-hint__label">Spätná väzba učiteľa</div>${escapeHtml(q.teacherFeedback)}
    </div>` : ''}
    ${canDelete
      ? `<div style="margin-top:var(--space-3)"><button type="button" class="btn btn--ghost btn--sm" data-action="delete-quest" data-quest-id="${escapeHtml(q.id)}">Zmazať</button></div>`
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

function creationPanels(disabled: boolean): string {
  const dis = disabled ? 'disabled' : '';
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return `
  <div class="grid grid--2" style="gap:var(--space-4)">
    <section class="card" style="border-left:4px solid var(--color-success)">
      <h3 style="margin-top:0">✨ Navrhni vlastný problém</h3>
      <p class="muted" style="font-size:var(--fs-sm)">Všimni si problém vo svojej škole / komunite a pomenuj ho.</p>
      <form id="quest-propose-form" class="stack" novalidate>
        <label class="field">Názov misie
          <input id="q-title" type="text" maxlength="120" required placeholder="napr. Dlhé rady v jedálni" ${dis}>
        </label>
        <label class="field">Cieľ – čo chceš dosiahnuť
          <textarea id="q-goal" rows="2" maxlength="500" required placeholder="napr. Skrátiť čakanie o polovicu pomocou nového rozvrhu" ${dis}></textarea>
        </label>
        <div class="grid grid--2" style="gap:var(--space-3)">
          <label class="field">Koho sa týka
            <input id="q-affected" type="text" maxlength="120" required placeholder="napr. žiaci 2. stupňa" ${dis}>
          </label>
          <label class="field">Termín (môj návrh)
            <input id="q-deadline" type="date" min="${tomorrow}" ${dis}>
          </label>
        </div>
        <label class="field">Dôkaz / čo si si všimol
          <textarea id="q-evidence" rows="2" maxlength="800" required placeholder="napr. 3 dni som meral čas v rade…" ${dis}></textarea>
        </label>
        <label class="field">Prvý nápad na riešenie
          <textarea id="q-firstidea" rows="2" maxlength="800" required placeholder="napr. dva výdajné pulty cez 12:00…" ${dis}></textarea>
        </label>
        <p id="quest-propose-msg" class="muted" role="status" aria-live="polite"></p>
        <button class="btn btn--primary" type="submit" id="quest-propose-btn" ${dis}>Poslať návrh učiteľovi</button>
      </form>
    </section>

    <section class="card" style="border-left:4px solid var(--color-accent)">
      <h3 style="margin-top:0">🤖 AI návrh misie</h3>
      <p class="muted" style="font-size:var(--fs-sm)">Napíš oblasť záujmu a AI ti pripraví celý návrh — cieľ, dôkaz aj prvý krok — v súlade s INVOK + ŠVP ZV.</p>
      <form id="quest-ai-form" class="stack" novalidate>
        <label class="field">Oblasť záujmu
          <input id="q-ai-topic" type="text" maxlength="200" placeholder="napr. triedenie odpadu v triede" required ${dis}>
        </label>
        <div class="grid grid--2" style="gap:var(--space-3)">
          <label class="field">Ročník (voliteľné)
            <input id="q-ai-grade" type="number" min="1" max="9" placeholder="napr. 7" ${dis}>
          </label>
          <label class="field">Termín (môj návrh)
            <input id="q-ai-deadline" type="date" min="${tomorrow}" ${dis}>
          </label>
        </div>
        <p id="quest-ai-msg" class="muted" role="status" aria-live="polite"></p>
        <button class="btn btn--primary" type="submit" id="quest-ai-btn" ${dis}>Vygenerovať a poslať</button>
      </form>
      <div id="quest-ai-preview" style="margin-top:var(--space-3)"></div>
    </section>
  </div>`;
}

interface PageState {
  loaded: boolean;
  loading: boolean;
  quests: StudentQuest[];
  error?: string;
}

let state: PageState = { loaded: false, loading: false, quests: [] };

function renderListSection(): string {
  if (state.loading) {
    return `<p class="muted">Načítavam misie…</p>`;
  }
  if (state.error) {
    return `<p class="muted" style="color:var(--color-danger)">${escapeHtml(state.error)}</p>`;
  }
  if (state.quests.length === 0) {
    return emptyStateCard();
  }
  return `<div class="stack" style="gap:var(--space-4)">${state.quests.map(questCard).join('')}</div>`;
}

export function StudentQuestsPage(): string {
  const user = getSnapshot().user;
  const alias = user?.displayName ?? 'žiak';
  const active = countActive(state.quests);
  const overLimit = active >= QUEST_LIMITS.MAX_ACTIVE;

  pendingMount = () => {
    if (!state.loaded && !state.loading) {
      void refreshQuests();
    }
    bindDelete();
    bindProposeForm();
    bindAiForm();
  };

  return `
  <section class="card">
    <div class="card-title">
      <div>
        <div class="muted">Moje misie</div>
        <h2 style="margin:0">${escapeHtml(alias)}</h2>
      </div>
      <div>
        <span class="chip ${overLimit ? 'chip--warm' : 'chip--muted'}">
          ${active} / ${QUEST_LIMITS.MAX_ACTIVE} aktívnych
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
    <div id="quest-list">${renderListSection()}</div>
  </section>

  <section style="margin-top:var(--space-6)">
    <div class="section-title"><h2 style="margin:0">Pridaj novú misiu</h2></div>
    ${creationPanels(overLimit)}
  </section>`;
}

function readVal(selector: string): string {
  const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
  return el?.value.trim() ?? '';
}

function reRenderPage(): void {
  const app = document.querySelector<HTMLElement>('#app .container');
  if (!app) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  app.innerHTML = StudentQuestsPage();
  pendingMount?.();
}

function updateListDom(): void {
  const slot = document.querySelector<HTMLElement>('#quest-list');
  if (slot) slot.innerHTML = renderListSection();
  // Update active-count chip without full re-render so forms keep their state.
  // (Cheap re-render of the whole page is simpler and we already do it after
  // mutations, so this is a no-op fallback.)
}

async function refreshQuests(): Promise<void> {
  state.loading = true;
  state.error = undefined;
  updateListDom();
  try {
    const list = await listQuests();
    state.quests = list;
    state.loaded = true;
    state.loading = false;
    // Full re-render so the "active count" chip + limit banner reflect reality.
    reRenderPage();
  } catch (err) {
    state.loading = false;
    state.error = err instanceof Error ? err.message : 'Nepodarilo sa načítať misie.';
    updateListDom();
  }
}

function bindDelete(): void {
  for (const btn of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action="delete-quest"]'))) {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-quest-id');
      if (!id) return;
      const confirmed = window.confirm('Naozaj zmazať túto misiu?');
      if (!confirmed) return;
      btn.disabled = true;
      const res = await deleteQuest(id);
      btn.disabled = false;
      if (!res.ok) {
        window.alert(res.error ?? 'Nepodarilo sa zmazať.');
        return;
      }
      await refreshQuests();
    });
  }
}

function bindProposeForm(): void {
  const form = document.querySelector<HTMLFormElement>('#quest-propose-form');
  const msg = document.querySelector<HTMLParagraphElement>('#quest-propose-msg');
  const btn = document.querySelector<HTMLButtonElement>('#quest-propose-btn');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
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
    const result = await createQuest(input);
    if (btn) { btn.disabled = false; btn.textContent = 'Poslať návrh učiteľovi'; }

    if (!result.ok) {
      if (msg) msg.textContent = result.error ?? 'Nepodarilo sa uložiť.';
      return;
    }
    if (msg) {
      msg.textContent = result.source === 'db'
        ? 'Návrh poslaný učiteľovi. Po schválení môžeš odovzdať riešenie.'
        : 'Návrh uložený lokálne (demo režim).';
    }
    await refreshQuests();
  });
}

function bindAiForm(): void {
  const form = document.querySelector<HTMLFormElement>('#quest-ai-form');
  const msg = document.querySelector<HTMLParagraphElement>('#quest-ai-msg');
  const btn = document.querySelector<HTMLButtonElement>('#quest-ai-btn');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (msg) msg.textContent = '';

    const topic = readVal('#q-ai-topic');
    const gradeRaw = readVal('#q-ai-grade');
    const grade = gradeRaw ? Number(gradeRaw) : undefined;
    const deadline = readVal('#q-ai-deadline') || undefined;

    if (topic.length < 3) {
      if (msg) msg.textContent = 'Napíš aspoň krátku oblasť záujmu.';
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Generujem…'; }
    const draft = await generateQuestDraft({ topic, grade, proposedDeadline: deadline });
    if (btn) { btn.disabled = false; btn.textContent = 'Vygenerovať a poslať'; }

    if (!draft.ok || !draft.draft) {
      if (msg) msg.textContent = draft.error ?? 'AI návrh sa nepodarilo vygenerovať.';
      return;
    }

    const d = draft.draft;
    const result = await createQuest({
      title: d.title,
      description: d.description,
      goal: d.goal,
      affectedGroup: d.affectedGroup,
      evidence: d.evidence,
      firstIdea: d.firstIdea,
      proposedDeadline: deadline,
      source: 'ai',
      aiModel: d.aiModel,
      aiPrompt: undefined,
    });
    if (!result.ok) {
      if (msg) msg.textContent = result.error ?? 'Návrh sa nepodarilo uložiť.';
      return;
    }
    if (msg) {
      const modelLabel = draft.source === 'openai' ? `AI (${escapeHtml(d.aiModel ?? 'openai')})` : 'demo šablóna';
      msg.textContent = `Návrh vygenerovaný (${modelLabel}) a poslaný učiteľovi.`;
    }
    await refreshQuests();
  });
}

export function mountStudentQuestsPage(): void {
  pendingMount?.();
}
