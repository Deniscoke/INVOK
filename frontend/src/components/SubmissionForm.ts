/**
 * Inline submission form for a single mission.
 * Self-contained: renders HTML, mounts event listener, returns evaluation via callback.
 */
import type { Mission } from '../services/mockDataService';
import type { SubmissionResult } from '../services/submissionApi';
import { submitMission } from '../services/submissionApi';

export interface SubmissionFormOptions {
  mission: Mission;
  classId?: string;
  onResult: (result: SubmissionResult) => void;
}

export function SubmissionForm({ mission }: SubmissionFormOptions): string {
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

export function mountSubmissionForm({ mission, classId, onResult }: SubmissionFormOptions): void {
  const form = document.querySelector<HTMLFormElement>(`#submission-form-${mission.id}`);
  const textarea = document.querySelector<HTMLTextAreaElement>(`#response-${mission.id}`);
  const counter = document.querySelector<HTMLSpanElement>(`#counter-${mission.id}`);
  const msg = document.querySelector<HTMLParagraphElement>(`#submission-msg-${mission.id}`);
  const btn = document.querySelector<HTMLButtonElement>(`#submit-btn-${mission.id}`);

  textarea?.addEventListener('input', () => {
    const len = textarea.value.length;
    if (counter) counter.textContent = `${len} / 5000`;
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
