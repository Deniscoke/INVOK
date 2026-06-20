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
  hasLiveStudentSession,
  listQuests,
  type QuestState,
  type StudentQuest,
} from '../services/questStore';
import { submitSolution, fetchMySubmissions, type SubmissionResult, type AiEvaluation } from '../services/submissionApi';
import { uploadQuestFile, listMyQuestFiles, ATTACH_MAX_FILES, type UploadedAttachment } from '../services/uploadApi';
import { getCompetencies } from '../services/mockDataService';

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
  const canSubmit = q.state === 'approved' || q.state === 'changes_requested';
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
    ${q.description ? `<p style="margin:var(--space-3) 0 0;white-space:pre-line">${escapeHtml(q.description)}</p>` : ''}
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
    ${canSubmit ? renderSubmitPanel(q) : ''}
    ${q.state === 'submitted' ? renderSubmittedHint() : ''}
    ${q.state === 'completed' ? renderCompletedHint() : ''}
    ${(q.state === 'submitted' || q.state === 'completed') && q.submissionId && state.evaluations[q.submissionId]
      ? renderAiFeedback(state.evaluations[q.submissionId], state.xp[q.submissionId] ?? 0)
      : ''}
    ${renderMyFiles(q)}
    ${canDelete
      ? `<div style="margin-top:var(--space-3)"><button type="button" class="btn btn--ghost btn--sm" data-action="delete-quest" data-quest-id="${escapeHtml(q.id)}">Zmazať</button></div>`
      : ''}
  </article>`;
}

function renderSubmitPanel(q: StudentQuest): string {
  return `
  <details class="card" style="margin-top:var(--space-3);background:var(--tint-success, #ecfdf5);border-left:4px solid var(--color-success);padding:var(--space-3)">
    <summary style="cursor:pointer;font-weight:600">✅ Odovzdaj riešenie tejto misie</summary>
    <form class="stack" data-submit-form="${escapeHtml(q.id)}" style="margin-top:var(--space-3)" novalidate>
      <label class="field">Tvoja odpoveď / popis riešenia
        <textarea data-submit-field="solutionSummary" rows="4" minlength="20" maxlength="3000" required
          placeholder="Opíš, čo si urobil/a alebo navrhuješ pre splnenie cieľa misie."></textarea>
      </label>
      <label class="field">Dôkaz alebo pozorovanie
        <textarea data-submit-field="evidence" rows="3" maxlength="2000" required
          placeholder="Čo si zmeral/a, videl/a alebo zistil/a?"></textarea>
      </label>
      <label class="field">Prvý konkrétny krok
        <textarea data-submit-field="firstStep" rows="2" maxlength="1000" required
          placeholder="Čo urobíš ako prvé alebo si už urobil/a?"></textarea>
      </label>
      <label class="field">Prínos / koho sa to týka (voliteľné)
        <input type="text" data-submit-field="impact" maxlength="500"
          placeholder="napr. žiaci v jedálni, susedstvo školy...">
      </label>
      <label class="field">📎 Dokumentácia projektu (voliteľné)
        <input type="file" data-submit-files multiple
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip">
        <span class="muted" style="display:block;margin-top:4px;font-size:var(--fs-xs)">
          Pridaj všetko, čím vieš ukázať svoju misiu — <strong>fotky, prezentáciu, PDF, video, dokument…</strong>
          Môžeš naraz vybrať viac súborov (max ${ATTACH_MAX_FILES}, každý do 50 MB). Učiteľ aj AI ich uvidia.
        </span>
      </label>
      <p class="muted" data-submit-msg="${escapeHtml(q.id)}" role="status" aria-live="polite" style="margin:0"></p>
      <div data-submit-result="${escapeHtml(q.id)}"></div>
      <button class="btn btn--primary" type="submit" data-submit-btn="${escapeHtml(q.id)}">Odovzdať na AI + učiteľa</button>
    </form>
  </details>`;
}

function renderSubmittedHint(): string {
  return `
  <div class="teacher-hint" style="margin-top:var(--space-3);border-left-color:var(--color-accent)">
    <div class="teacher-hint__label">Odovzdané — čaká na učiteľa</div>
    AI už misiu posúdila, učiteľ potvrdí výsledok a pridelí finálne XP.
  </div>`;
}

function renderCompletedHint(): string {
  return `
  <div class="teacher-hint" style="margin-top:var(--space-3);border-left-color:var(--color-success);background:var(--tint-success, #ecfdf5)">
    <div class="teacher-hint__label" style="color:#15803d">🏆 Misia dokončená</div>
    Učiteľ potvrdil dokončenie. XP a kompetencie sú zarátané.
  </div>`;
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
        <button class="btn btn--primary" type="submit" id="quest-ai-btn" ${dis}>Vygenerovať návrh</button>
      </form>
      <div id="quest-ai-preview" style="margin-top:var(--space-3)"></div>
    </section>
  </div>`;
}

interface PageState {
  loaded: boolean;
  loading: boolean;
  quests: StudentQuest[];
  /** AI evaluation per submission id (so the student keeps seeing the feedback). */
  evaluations: Record<string, AiEvaluation>;
  /** Provisional XP per submission id. */
  xp: Record<string, number>;
  error?: string;
}

let state: PageState = { loaded: false, loading: false, quests: [], evaluations: {}, xp: {} };

function competencyName(id: string): string {
  return getCompetencies().find((c) => c.id === id)?.childName ?? id;
}

/** Persistent AI feedback card shown on a submitted/completed quest. */
function renderAiFeedback(ev: AiEvaluation, xp: number): string {
  const conf = Math.round(ev.confidence * 100);
  const learned = (ev.detectedCompetencies ?? [])
    .map((d) => competencyName(d.id))
    .filter(Boolean);
  const reasons = (ev.reasons ?? []).slice(0, 5).map((r) => {
    const chip = r.result === 'met' ? 'chip--accent' : r.result === 'partial' ? 'chip--warm' : 'chip--muted';
    return `<li style="margin:4px 0"><strong>${escapeHtml(r.criterion)}</strong>: ${escapeHtml(r.explanation)}
      <span class="chip ${chip}" style="margin-left:4px">${escapeHtml(r.result)}</span></li>`;
  }).join('');
  return `
  <div class="card" style="margin-top:var(--space-3);border-left:4px solid ${ev.valid ? 'var(--color-success)' : '#f59e0b'}">
    <div class="muted" style="font-size:var(--fs-xs)">🤖 Čo si o tvojej odpovedi myslí AI (${escapeHtml(ev.model)})</div>
    <h4 style="margin:4px 0 0">Skóre ${ev.score} / 100 · istota ${conf} %
      <span class="chip ${ev.valid ? 'chip--accent' : 'chip--warm'}" style="margin-left:6px">${ev.valid ? 'vyzerá dobre' : 'na doladenie'}</span></h4>
    ${xp ? `<p class="muted" style="margin:8px 0 0">Predbežné XP: <strong>${xp}</strong> (učiteľ potvrdí).</p>` : ''}
    ${learned.length ? `<p style="margin:8px 0 0"><strong>Čo si preukázal/a:</strong> ${learned.map(escapeHtml).join(', ')}</p>` : ''}
    ${reasons ? `<ul style="margin:var(--space-3) 0 0;padding-left:18px">${reasons}</ul>` : ''}
    <p class="muted" style="margin:8px 0 0;font-size:var(--fs-sm)">Toto je <strong>návrh AI</strong> — finálne hodnotenie a XP potvrdí tvoj učiteľ.</p>
  </div>`;
}

/** Button + slot to (lazily) show the student's own uploaded files for a quest. */
function renderMyFiles(q: StudentQuest): string {
  if (q.state === 'pending_approval' || q.state === 'draft' || q.state === 'rejected') return '';
  return `
  <div style="margin-top:var(--space-3)">
    <button type="button" class="btn btn--ghost btn--sm" data-myfiles-btn="${escapeHtml(q.id)}">📎 Moje nahraté súbory</button>
    <div data-myfiles-slot="${escapeHtml(q.id)}" style="margin-top:var(--space-2)"></div>
  </div>`;
}

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
    bindSubmitForms();
    bindMyFilesButtons();
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

  ${!hasLiveStudentSession() ? `
  <section class="card" style="margin-top:var(--space-4);border-left:4px solid var(--color-warm);background:#fffbeb">
    <strong>Si v demo režime 🧪</strong>
    <p class="muted" style="margin:6px 0 0">AI návrhy sú zatiaľ ukážkové. Pre <strong>živé AI</strong> sa
      odhlás a prihlás cez <strong>„Som žiak"</strong> s kódom triedy od učiteľa
      (na vyskúšanie funguje kód <code>DEMO-2026</code>).</p>
  </section>` : ''}

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
    // Load my submissions so the AI feedback persists on submitted/completed quests.
    try {
      const subs = await fetchMySubmissions();
      const evaluations: Record<string, AiEvaluation> = {};
      const xp: Record<string, number> = {};
      for (const s of subs) {
        if (s.evaluation) evaluations[s.id] = s.evaluation;
        xp[s.id] = s.xpAwarded;
      }
      state.evaluations = evaluations;
      state.xp = xp;
    } catch {
      /* feedback is best-effort */
    }
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

function bindMyFilesButtons(): void {
  for (const btn of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-myfiles-btn]'))) {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-myfiles-btn');
      const slot = id ? document.querySelector<HTMLElement>(`[data-myfiles-slot="${id}"]`) : null;
      if (!id || !slot) return;
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = 'Načítavam…';
      const files = await listMyQuestFiles(id);
      btn.disabled = false;
      btn.textContent = original;
      if (files.length === 0) {
        slot.innerHTML = '<p class="muted" style="font-size:var(--fs-sm)">Zatiaľ si k tejto misii nenahral/a žiadne súbory.</p>';
        return;
      }
      slot.innerHTML =
        '<ul style="margin:0;padding-left:18px">' +
        files
          .map((f) => {
            const kb = Math.max(1, Math.round(f.sizeBytes / 1024));
            const size = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} kB`;
            return `<li style="margin:2px 0"><a href="${escapeHtml(f.url)}" target="_blank" rel="noopener">${escapeHtml(f.name)}</a> <span class="muted" style="font-size:var(--fs-xs)">(${size})</span></li>`;
          })
          .join('') +
        '</ul>';
    });
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

type AiDraft = NonNullable<Awaited<ReturnType<typeof generateQuestDraft>>['draft']>;

/** Fold the student-facing "Čo sa naučíš" points into the persisted description. */
function composeQuestDescription(d: AiDraft): string {
  const base = (d.description ?? '').trim();
  const outcomes = Array.isArray(d.learningOutcomes) ? d.learningOutcomes.filter((o) => o && o.trim()) : [];
  if (outcomes.length === 0) return base;
  return `${base}\n\nČo sa naučíš:\n${outcomes.map((o) => `• ${o.trim()}`).join('\n')}`;
}

function renderAiPreview(d: AiDraft, source: 'openai' | 'mock' | undefined): string {
  const outcomes = Array.isArray(d.learningOutcomes) ? d.learningOutcomes.filter(Boolean) : [];
  const sourceLabel = source === 'openai'
    ? `🤖 AI návrh (${escapeHtml(d.aiModel ?? 'openai')})`
    : 'Ukážkový návrh (demo režim — bez pripojenia do triedy)';
  return `
  <div class="card" style="border-left:4px solid var(--color-accent);background:var(--tint-accent, #eef2ff)">
    <div class="muted" style="font-size:var(--fs-xs)">${sourceLabel} · skontroluj a pošli, alebo skús iný návrh</div>
    <h3 style="margin:6px 0 0">${escapeHtml(d.title)}</h3>
    ${d.description ? `<p style="margin:var(--space-3) 0 0">${escapeHtml(d.description)}</p>` : ''}
    ${d.goal ? `<div class="mission__goal" style="margin-top:var(--space-3)"><strong>Cieľ:</strong> ${escapeHtml(d.goal)}</div>` : ''}
    ${outcomes.length ? `<div style="margin-top:var(--space-3)"><strong>Čo sa naučíš:</strong>
      <ul style="margin:6px 0 0;padding-left:18px">${outcomes.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ul></div>` : ''}
    ${d.affectedGroup ? `<p class="muted" style="margin:8px 0 0;font-size:var(--fs-sm)"><strong>Koho sa týka:</strong> ${escapeHtml(d.affectedGroup)}</p>` : ''}
    ${d.evidence ? `<p class="muted" style="margin:6px 0 0;font-size:var(--fs-sm)"><strong>Dôkaz:</strong> ${escapeHtml(d.evidence)}</p>` : ''}
    ${d.firstIdea ? `<p class="muted" style="margin:6px 0 0;font-size:var(--fs-sm)"><strong>Prvý nápad:</strong> ${escapeHtml(d.firstIdea)}</p>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:var(--space-3);margin-top:var(--space-4)">
      <button type="button" class="btn btn--primary" data-action="quest-ai-confirm">Poslať učiteľovi ✓</button>
      <button type="button" class="btn btn--ghost" data-action="quest-ai-retry">Skúsiť iný návrh</button>
    </div>
  </div>`;
}

// Holds the draft currently shown in the preview (awaiting the student's confirm).
let stagedDraft: { draft: AiDraft; deadline?: string; source: 'openai' | 'mock' | undefined } | null = null;

function bindAiForm(): void {
  const form = document.querySelector<HTMLFormElement>('#quest-ai-form');
  const msg = document.querySelector<HTMLParagraphElement>('#quest-ai-msg');
  const btn = document.querySelector<HTMLButtonElement>('#quest-ai-btn');
  const preview = document.querySelector<HTMLElement>('#quest-ai-preview');
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
    if (btn) { btn.disabled = false; btn.textContent = 'Vygenerovať návrh'; }

    if (!draft.ok || !draft.draft) {
      if (msg) msg.textContent = draft.error ?? 'AI návrh sa nepodarilo vygenerovať.';
      return;
    }

    // Stage the draft for review — do NOT auto-send to the teacher.
    stagedDraft = { draft: draft.draft, deadline, source: draft.source };
    if (preview) {
      preview.innerHTML = renderAiPreview(draft.draft, draft.source);
      bindAiPreviewActions();
    }
    if (msg) msg.textContent = 'Skontroluj návrh nižšie. Ak sa ti páči, pošli ho učiteľovi.';
  });
}

function bindAiPreviewActions(): void {
  const msg = document.querySelector<HTMLParagraphElement>('#quest-ai-msg');
  const preview = document.querySelector<HTMLElement>('#quest-ai-preview');

  preview?.querySelector<HTMLButtonElement>('[data-action="quest-ai-retry"]')?.addEventListener('click', () => {
    stagedDraft = null;
    if (preview) preview.innerHTML = '';
    if (msg) msg.textContent = 'Uprav oblasť záujmu (alebo ročník) a vygeneruj nový návrh.';
    document.querySelector<HTMLInputElement>('#q-ai-topic')?.focus();
  });

  preview?.querySelector<HTMLButtonElement>('[data-action="quest-ai-confirm"]')?.addEventListener('click', async (event) => {
    if (!stagedDraft) return;
    const confirmBtn = event.currentTarget as HTMLButtonElement;
    const { draft: d, deadline, source } = stagedDraft;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Odosielam…';

    const result = await createQuest({
      title: d.title,
      description: composeQuestDescription(d),
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
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Poslať učiteľovi ✓';
      if (msg) msg.textContent = result.error ?? 'Návrh sa nepodarilo uložiť.';
      return;
    }
    stagedDraft = null;
    if (msg) {
      const modelLabel = source === 'openai' ? `AI (${escapeHtml(d.aiModel ?? 'openai')})` : 'demo šablóna';
      msg.textContent = `Návrh (${modelLabel}) poslaný učiteľovi.`;
    }
    await refreshQuests();
  });
}

function readSubmitField(form: HTMLFormElement, name: string): string {
  const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-submit-field="${name}"]`);
  return el?.value.trim() ?? '';
}

function renderSubmitResult(slot: HTMLElement, result: SubmissionResult): void {
  if (!result.ok) {
    slot.innerHTML = `<div class="teacher-hint" style="border-left-color:var(--color-danger)">
      <div class="teacher-hint__label" style="color:var(--color-danger)">Odovzdanie zlyhalo</div>
      ${escapeHtml(result.error ?? 'Skús to znova.')}
    </div>`;
    return;
  }
  const ev = result.evaluation;
  if (!ev) {
    slot.innerHTML = `<div class="teacher-hint" style="border-left-color:var(--color-success)">
      <div class="teacher-hint__label" style="color:#15803d">Odovzdané</div>
      Učiteľ potvrdí výsledok a pridelí finálne XP.
    </div>`;
    return;
  }
  const conf = Math.round(ev.confidence * 100);
  const reasonRows = (ev.reasons ?? []).slice(0, 6).map((r) => `
    <li style="margin:4px 0">
      <strong>${escapeHtml(r.criterion)}</strong>: ${escapeHtml(r.explanation)}
      <span class="chip ${r.result === 'met' ? 'chip--accent' : r.result === 'partial' ? 'chip--warm' : 'chip--muted'}" style="margin-left:6px">${r.result}</span>
    </li>`).join('');
  slot.innerHTML = `
  <div class="card" style="margin-top:var(--space-3);border-left:4px solid ${ev.valid ? 'var(--color-success)' : '#f59e0b'}">
    <div class="card-title">
      <div><div class="muted" style="font-size:var(--fs-xs)">AI spätná väzba (${escapeHtml(ev.model)})</div>
        <h4 style="margin:4px 0 0">Skóre ${ev.score} / 100 · istota ${conf} %</h4></div>
      <span class="chip ${ev.valid ? 'chip--accent' : 'chip--warm'}">${ev.valid ? 'platné' : 'na úpravu'}</span>
    </div>
    ${result.xpAwarded ? `<p class="muted" style="margin:8px 0 0">Predbežné XP: <strong>${result.xpAwarded}</strong> (učiteľ potvrdí).</p>` : ''}
    ${reasonRows ? `<ul style="margin:var(--space-3) 0 0;padding-left:18px">${reasonRows}</ul>` : ''}
    ${ev.suggestedTeacherReview ? `<p class="muted" style="margin:8px 0 0;font-size:var(--fs-sm)">AI navrhuje, aby výsledok ešte posúdil učiteľ.</p>` : ''}
  </div>`;
}

function bindSubmitForms(): void {
  for (const form of Array.from(document.querySelectorAll<HTMLFormElement>('form[data-submit-form]'))) {
    const questId = form.getAttribute('data-submit-form') ?? '';
    const msg = document.querySelector<HTMLElement>(`[data-submit-msg="${questId}"]`);
    const slot = document.querySelector<HTMLElement>(`[data-submit-result="${questId}"]`);
    const btn = document.querySelector<HTMLButtonElement>(`[data-submit-btn="${questId}"]`);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (msg) msg.textContent = '';
      const quest = state.quests.find((q) => q.id === questId);
      if (!quest) return;

      const solutionSummary = readSubmitField(form, 'solutionSummary');
      const evidence = readSubmitField(form, 'evidence');
      const firstStep = readSubmitField(form, 'firstStep');
      const impact = readSubmitField(form, 'impact');

      if (solutionSummary.length < 20) {
        if (msg) msg.textContent = 'Popis riešenia musí mať aspoň 20 znakov.';
        return;
      }
      if (evidence.length < 5) {
        if (msg) msg.textContent = 'Doplň dôkaz alebo pozorovanie (min. 5 znakov).';
        return;
      }
      if (firstStep.length < 5) {
        if (msg) msg.textContent = 'Napíš konkrétny prvý krok (min. 5 znakov).';
        return;
      }

      // Upload any attached documentation first (straight to Storage).
      const fileInput = form.querySelector<HTMLInputElement>('[data-submit-files]');
      const files = fileInput?.files ? Array.from(fileInput.files) : [];
      if (files.length > ATTACH_MAX_FILES) {
        if (msg) msg.textContent = `Naraz môžeš nahrať najviac ${ATTACH_MAX_FILES} súborov.`;
        return;
      }
      if (btn) { btn.disabled = true; btn.textContent = 'Odosielam…'; }

      let attachments: UploadedAttachment[] = [];
      if (files.length > 0) {
        try {
          attachments = [];
          for (let i = 0; i < files.length; i += 1) {
            if (msg) msg.textContent = `Nahrávam súbory (${i + 1}/${files.length})…`;
            attachments.push(await uploadQuestFile(questId, files[i]));
          }
        } catch (err) {
          if (msg) msg.textContent = err instanceof Error ? err.message : 'Nahrávanie súborov zlyhalo.';
          if (btn) { btn.disabled = false; btn.textContent = 'Odovzdať na AI + učiteľa'; }
          return;
        }
      }

      if (msg) msg.textContent = 'Odosielam…';
      const result = await submitSolution({
        missionId: quest.title.slice(0, 60),
        solutionSummary,
        evidence,
        firstStep,
        impact: impact || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        studentQuestId: questId,
      });
      if (btn) { btn.disabled = false; btn.textContent = 'Odovzdať na AI + učiteľa'; }
      if (msg) msg.textContent = '';

      if (slot) renderSubmitResult(slot, result);

      if (result.ok) {
        // Quest moved to `submitted` server-side — refresh to reflect the new
        // state badge + the post-submit hint card.
        setTimeout(() => { void refreshQuests(); }, 1200);
      }
    });
  }
}

export function mountStudentQuestsPage(): void {
  pendingMount?.();
}
