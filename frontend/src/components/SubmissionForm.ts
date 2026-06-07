/**
 * Inline submission form for a single mission.
 * Two kinds:
 *   - 'solution_submission' (default): structured fields + optional photo note.
 *   - 'problem_proposal': structured fields for the entrepreneurial first step
 *     (notice → name → who → evidence → first idea), earning provisional XP.
 * Self-contained: renders HTML, mounts listeners, returns the result via callback.
 */
import type { Mission } from '../services/mockDataService';
import type { PhotoEvidence, SubmissionResult } from '../services/submissionApi';
import { submitProblemProposal, submitSolution } from '../services/submissionApi';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

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
    <label class="field">Foto dôkazu (voliteľné, max 5 MB)
      <input id="solution-photo-${id}" type="file" accept="image/*" capture="environment">
      <span class="muted" style="font-size:var(--fs-xs)">AI posúdi popis fotky aj rozmery; učiteľ uvidí náhľad.</span>
    </label>
    <div id="solution-photo-preview-${id}" style="display:none;margin-top:-8px">
      <img id="solution-photo-img-${id}" alt="Náhľad fotky" style="max-width:100%;max-height:220px;border-radius:8px;border:1px solid var(--color-border)">
      <p id="solution-photo-meta-${id}" class="muted" style="font-size:var(--fs-xs);margin:6px 0 0"></p>
    </div>
    <label class="field">Popis fotky (čo na nej je)
      <input id="solution-photo-note-${id}" type="text" maxlength="500"
        placeholder="napr. Fotka ukazuje plný odpadkový kôš pri vchode…">
    </label>` : ''}

    <p id="submission-msg-${id}" class="muted" role="status" aria-live="polite"></p>
    <button class="btn btn--primary" type="submit" id="submit-btn-${id}">Odovzdať</button>
  </form>`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function mountSolutionForm({ mission, classId, onResult }: SubmissionFormOptions): void {
  const id = mission.id;
  const form = document.querySelector<HTMLFormElement>(`#submission-form-${id}`);
  const msg = document.querySelector<HTMLParagraphElement>(`#submission-msg-${id}`);
  const btn = document.querySelector<HTMLButtonElement>(`#submit-btn-${id}`);
  const photoInput = document.querySelector<HTMLInputElement>(`#solution-photo-${id}`);
  const previewWrap = document.querySelector<HTMLDivElement>(`#solution-photo-preview-${id}`);
  const previewImg = document.querySelector<HTMLImageElement>(`#solution-photo-img-${id}`);
  const previewMeta = document.querySelector<HTMLParagraphElement>(`#solution-photo-meta-${id}`);
  const read = (sel: string): string =>
    (document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null)?.value.trim() ?? '';

  let photoEvidence: PhotoEvidence | null = null;

  photoInput?.addEventListener('change', async () => {
    const file = photoInput.files?.[0];
    photoEvidence = null;
    if (previewWrap) previewWrap.style.display = 'none';
    if (msg) msg.textContent = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      if (msg) msg.textContent = 'Príloha musí byť obrázok (JPG, PNG, WEBP).';
      photoInput.value = '';
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      if (msg) msg.textContent = 'Fotka je príliš veľká (max 5 MB).';
      photoInput.value = '';
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      photoEvidence = {
        fileName: file.name,
        mimeType: file.type || 'image/jpeg',
        sizeBytes: file.size,
        dataUrl,
      };
      if (previewImg) previewImg.src = dataUrl;
      if (previewMeta) {
        const sizeKb = Math.max(1, Math.round(file.size / 1024));
        previewMeta.textContent = `${file.name} · ${file.type || 'image'} · ${sizeKb} kB`;
      }
      if (previewWrap) previewWrap.style.display = 'block';
    } catch {
      if (msg) msg.textContent = 'Fotku sa nepodarilo načítať. Skús inú.';
      photoInput.value = '';
    }
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const solutionSummary = read(`#solution-summary-${id}`);
    const evidence = read(`#solution-evidence-${id}`);
    const firstStep = read(`#solution-first-step-${id}`);
    const impact = read(`#solution-impact-${id}`);
    const photoNoteRaw = read(`#solution-photo-note-${id}`);

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
    if (photoEvidence && photoNoteRaw.length < 5) {
      if (msg) msg.textContent = 'Pri fotke doplň krátky popis (min. 5 znakov), aby AI vedelo posúdiť dôkaz.';
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Odosielam…'; }
    if (msg) msg.textContent = '';

    const photo = photoEvidence
      ? { ...photoEvidence, caption: photoNoteRaw || undefined }
      : undefined;

    const result = await submitSolution({
      missionId: mission.id,
      solutionSummary,
      evidence,
      firstStep,
      impact: impact || undefined,
      photo,
      classId,
    });

    if (btn) { btn.disabled = false; btn.textContent = 'Odovzdať'; }
    if (msg) msg.textContent = result.ok
      ? (result.source === 'mock' ? 'Uložené lokálne (demo režim). Učiteľ uvidí pri pripojení servera.' : 'Odovzdané.')
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
