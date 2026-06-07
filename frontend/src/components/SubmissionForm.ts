/**
 * Inline submission form for a single mission.
 * Two kinds:
 *   - 'solution_submission' (default): structured fields + optional photo note.
 *   - 'problem_proposal': structured fields for the entrepreneurial first step
 *     (notice → name → who → evidence → first idea), earning provisional XP.
 * Self-contained: renders HTML, mounts listeners, returns the result via callback.
 */
import type { Mission } from '../services/mockDataService';
import type { SubmissionResult } from '../services/submissionApi';
import { submitProblemProposal, submitSolution } from '../services/submissionApi';

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
// Solution submission (structured)
// ---------------------------------------------------------------------------
function solutionForm({ mission }: SubmissionFormOptions): string {
  const id = mission.id;
  const acceptsImage = mission.evidenceRequired.acceptedTypes.includes('image');
  return `
  <form id="submission-form-${id}" class="card stack" novalidate>
    <h3 style="margin:0">Odovzdaj riešenie: <em>${mission.title}</em></h3>
    <div class="mission__goal"><strong>Cieľ:</strong> ${mission.goal}</div>
    <p class="muted" style="margin:0">${mission.evidenceRequired.description}</p>

    <label class="field">Tvoja odpoveď / popis riešenia
      <textarea id="solution-summary-${id}" rows="4"
        placeholder="Opíš, čo si urobil/a alebo navrhuješ…"
        maxlength="3000" required></textarea>
    </label>

    <label class="field">Dôkaz alebo pozorovanie
      <textarea id="solution-evidence-${id}" rows="3"
        placeholder="Čo si videl/a, zmeral/a alebo otestoval/a?"
        maxlength="2000" required></textarea>
    </label>

    <label class="field">Prvý konkrétny krok
      <textarea id="solution-first-step-${id}" rows="2"
        placeholder="Čo urobíš ako prvé?"
        maxlength="1000" required></textarea>
    </label>

    <label class="field">Prínos / koho sa to týka (voliteľné)
      <input id="solution-impact-${id}" type="text" maxlength="500"
        placeholder="napr. celá trieda, žiaci v jedálni…">
    </label>

    ${acceptsImage ? `
    <label class="field">Foto dôkazu (voliteľné)
      <input id="solution-photo-${id}" type="file" accept="image/*">
      <span class="muted" style="font-size:var(--fs-xs)">AI zatiaľ posúdi popis fotky — prilož krátky popis nižšie.</span>
    </label>
    <label class="field">Popis fotky (ak si pridal/a obrázok)
      <input id="solution-photo-note-${id}" type="text" maxlength="500"
        placeholder="napr. Fotka ukazuje plný odpadkový kôš pri vchode…">
    </label>` : ''}

    <p id="submission-msg-${id}" class="muted" role="status" aria-live="polite"></p>
    <button class="btn btn--primary" type="submit" id="submit-btn-${id}">Odovzdať</button>
  </form>`;
}

function mountSolutionForm({ mission, classId, onResult }: SubmissionFormOptions): void {
  const id = mission.id;
  const form = document.querySelector<HTMLFormElement>(`#submission-form-${id}`);
  const msg = document.querySelector<HTMLParagraphElement>(`#submission-msg-${id}`);
  const btn = document.querySelector<HTMLButtonElement>(`#submit-btn-${id}`);
  const read = (sel: string): string =>
    (document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null)?.value.trim() ?? '';

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const solutionSummary = read(`#solution-summary-${id}`);
    const evidence = read(`#solution-evidence-${id}`);
    const firstStep = read(`#solution-first-step-${id}`);
    const impact = read(`#solution-impact-${id}`);
    const photoInput = document.querySelector<HTMLInputElement>(`#solution-photo-${id}`);
    const photoNoteRaw = read(`#solution-photo-note-${id}`);
    const photoFile = photoInput?.files?.[0];
    const photoNote = photoFile
      ? [photoFile.name, photoNoteRaw].filter(Boolean).join(' — ')
      : photoNoteRaw;

    if (solutionSummary.length < 20) {
      if (msg) msg.textContent = 'Popis riešenia musí mať aspoň 20 znakov.';
      return;
    }
    if (evidence.length < 10) {
      if (msg) msg.textContent = 'Doplň dôkaz alebo pozorovanie (min. 10 znakov).';
      return;
    }
    if (firstStep.length < 5) {
      if (msg) msg.textContent = 'Opíš prvý konkrétny krok (min. 5 znakov).';
      return;
    }
    if (photoFile && photoNoteRaw.length < 5) {
      if (msg) msg.textContent = 'Pri fotke doplň krátky popis, aby AI vedelo posúdiť dôkaz.';
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Odosielam…'; }
    if (msg) msg.textContent = '';

    const result = await submitSolution({
      missionId: mission.id,
      solutionSummary,
      evidence,
      firstStep,
      impact: impact || undefined,
      photoNote: photoNote || undefined,
      classId,
    });

    if (btn) { btn.disabled = false; btn.textContent = 'Odovzdať'; }
    if (msg) msg.textContent = result.ok
      ? (result.source === 'mock' ? 'Uložené lokálne (demo režim).' : '')
      : (result.error ?? 'Chyba pri odovzdaní.');
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
      <input id="pp-affected-${id}" type="text" maxlength="120" placeholder="napr. žiakov 2. stupňa" required>
    </label>
    <label class="field">Čo si si všimol
      <textarea id="pp-observation-${id}" rows="2" maxlength="1000" required></textarea>
    </label>
    <label class="field">Dôkaz alebo pozorovanie
      <textarea id="pp-evidence-${id}" rows="2" maxlength="1000" placeholder="napr. tri dni som meral čas čakania…" required></textarea>
    </label>
    <label class="field">Prvý nápad na riešenie
      <textarea id="pp-idea-${id}" rows="2" maxlength="1000" required></textarea>
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
    if (affectedGroup.length < 2) {
      if (msg) msg.textContent = 'Doplň, koho sa problém týka.';
      return;
    }
    if (evidence.length < 5) {
      if (msg) msg.textContent = 'Pridaj dôkaz alebo konkrétne pozorovanie.';
      return;
    }
    if (firstIdea.length < 5) {
      if (msg) msg.textContent = 'Navrhni aspoň prvý nápad na riešenie.';
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Odosielam…'; }
    if (msg) msg.textContent = '';

    const result = await submitProblemProposal({ missionId: mission.id, title, affectedGroup, observation, evidence, firstIdea, classId });

    if (btn) { btn.disabled = false; btn.textContent = 'Odoslať návrh problému'; }
    if (msg) msg.textContent = result.ok
      ? (result.source === 'mock' ? 'Uložené lokálne (demo režim).' : '')
      : (result.error ?? 'Chyba pri odovdaní.');
    onResult(result);
  });
}
