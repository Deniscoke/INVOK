/**
 * Inline submission form for a single mission.
 * Two kinds:
 *   - 'solution_submission' (default): a single response textarea.
 *   - 'problem_proposal': structured fields for the entrepreneurial first step
 *     (notice → name → who → evidence → first idea), earning provisional XP.
 * Self-contained: renders HTML, mounts listeners, returns the result via callback.
 */
import type { Mission } from '../services/mockDataService';
import type { SubmissionResult } from '../services/submissionApi';
import { submitMission, submitProblemProposal } from '../services/submissionApi';

export type SubmissionFormKind = 'solution_submission' | 'problem_proposal';

export interface SubmissionFormOptions {
  mission: Mission;
  classId?: string;
  kind?: SubmissionFormKind;
  onResult: (result: SubmissionResult) => void;
}

export function SubmissionForm(options: SubmissionFormOptions): string {
  return options.kind === 'problem_proposal' ? proposalForm(options) : solutionForm(options);
}

export function mountSubmissionForm(options: SubmissionFormOptions): void {
  if (options.kind === 'problem_proposal') {
    mountProposalForm(options);
    return;
  }
  mountSolutionForm(options);
}

// ---------------------------------------------------------------------------
// Solution submission (default)
// ---------------------------------------------------------------------------
function solutionForm({ mission }: SubmissionFormOptions): string {
  const minChars = 20;
  const maxChars = 5000;
  return `
  <form id="submission-form-${mission.id}" class="card stack" novalidate>
    <h3 style="margin:0">Odovzdaj riešenie: <em>${mission.title}</em></h3>
    <div class="mission__goal"><strong>Cieľ:</strong> ${mission.goal}</div>
    <label class="field">Tvoja odpoveď
      <textarea id="response-${mission.id}" rows="5"
        placeholder="Napíš aspoň ${minChars} znakov..."
        maxlength="${maxChars}" required></textarea>
      <span id="counter-${mission.id}" class="muted" style="font-size:var(--fs-xs);text-align:right">0 / ${maxChars}</span>
    </label>
    <p id="submission-msg-${mission.id}" class="muted" role="status" aria-live="polite"></p>
    <button class="btn btn--primary" type="submit" id="submit-btn-${mission.id}">Odovzdať</button>
  </form>`;
}

function mountSolutionForm({ mission, classId, onResult }: SubmissionFormOptions): void {
  const form = document.querySelector<HTMLFormElement>(`#submission-form-${mission.id}`);
  const textarea = document.querySelector<HTMLTextAreaElement>(`#response-${mission.id}`);
  const counter = document.querySelector<HTMLSpanElement>(`#counter-${mission.id}`);
  const msg = document.querySelector<HTMLParagraphElement>(`#submission-msg-${mission.id}`);
  const btn = document.querySelector<HTMLButtonElement>(`#submit-btn-${mission.id}`);

  textarea?.addEventListener('input', () => {
    if (counter) counter.textContent = `${textarea.value.length} / 5000`;
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const response = textarea?.value.trim() ?? '';
    if (response.length < 20) {
      if (msg) msg.textContent = 'Odpoveď musí mať aspoň 20 znakov.';
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Odosielam…'; }
    if (msg) msg.textContent = '';

    const result = await submitMission({
      missionId: mission.id,
      studentResponse: response,
      evidenceText: response,
      evidenceType: 'text',
      classId,
    });

    if (btn) { btn.disabled = false; btn.textContent = 'Odovzdať'; }
    if (msg) msg.textContent = result.ok ? '' : (result.error ?? 'Chyba pri odovzdaní.');
    onResult(result);
  });
}

// ---------------------------------------------------------------------------
// Problem proposal (entrepreneurial first step)
// ---------------------------------------------------------------------------
function proposalForm({ mission }: SubmissionFormOptions): string {
  const id = mission.id;
  return `
  <form id="pp-form-${id}" class="card stack" novalidate style="border-left:4px solid var(--color-accent)">
    <h3 style="margin:0">Navrhni problém <span class="chip chip--accent">podnikavý krok</span></h3>
    <p class="muted">Všimni si problém a kvalitne ho pomenuj. Aj za dobrý návrh získaš <strong>predbežné XP</strong> — učiteľ ho potvrdí.</p>
    <label class="field">Názov problému
      <input id="pp-title-${id}" type="text" maxlength="120" placeholder="napr. Dlhé rady v jedálni" required>
    </label>
    <label class="field">Koho sa týka
      <input id="pp-affected-${id}" type="text" maxlength="120" placeholder="napr. žiakov 2. stupňa">
    </label>
    <label class="field">Čo si si všimol
      <textarea id="pp-observation-${id}" rows="2" maxlength="1000"></textarea>
    </label>
    <label class="field">Dôkaz alebo pozorovanie
      <textarea id="pp-evidence-${id}" rows="2" maxlength="1000" placeholder="napr. tri dni som meral čas čakania…"></textarea>
    </label>
    <label class="field">Prvý nápad na riešenie
      <textarea id="pp-idea-${id}" rows="2" maxlength="1000"></textarea>
    </label>
    <p id="pp-msg-${id}" class="muted" role="status" aria-live="polite"></p>
    <button class="btn btn--primary" type="submit" id="pp-btn-${id}">Odoslať návrh problému</button>
  </form>`;
}

function mountProposalForm({ mission, classId, onResult }: SubmissionFormOptions): void {
  const id = mission.id;
  const form = document.querySelector<HTMLFormElement>(`#pp-form-${id}`);
  const msg = document.querySelector<HTMLElement>(`#pp-msg-${id}`);
  const btn = document.querySelector<HTMLButtonElement>(`#pp-btn-${id}`);
  const read = (sel: string): string =>
    (document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null)?.value.trim() ?? '';

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = read(`#pp-title-${id}`);
    const affectedGroup = read(`#pp-affected-${id}`);
    const observation = read(`#pp-observation-${id}`);
    const evidence = read(`#pp-evidence-${id}`);
    const firstIdea = read(`#pp-idea-${id}`);

    if (title.length < 3 || observation.length < 5) {
      if (msg) msg.textContent = 'Pomenuj problém a napíš, čo si si všimol.';
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Odosielam…'; }
    if (msg) msg.textContent = '';

    const result = await submitProblemProposal({ missionId: mission.id, title, affectedGroup, observation, evidence, firstIdea, classId });

    if (btn) { btn.disabled = false; btn.textContent = 'Odoslať návrh problému'; }
    if (msg) msg.textContent = result.ok ? '' : (result.error ?? 'Chyba pri odoslaní.');
    onResult(result);
  });
}
