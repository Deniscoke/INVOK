/**
 * Inline teacher review form for one submission.
 * The teacher confirms or adjusts the AI proposal. Self-contained: render + mount.
 */
import type { ReviewDecision, SubmitReviewResult } from '../services/teacherReviewApi';
import { submitReview } from '../services/teacherReviewApi';

export interface TeacherReviewPanelOptions {
  submissionId: string;
  aiEvaluationId?: string;
  aiScore: number;
  aiValid: boolean;
  onResult: (result: SubmitReviewResult) => void;
}

export function TeacherReviewPanel(opts: TeacherReviewPanelOptions): string {
  const id = opts.submissionId;
  return `
  <form id="review-form-${id}" class="card stack" style="margin-top:var(--space-3);border-left:4px solid var(--color-primary)">
    <h4 style="margin:0">Učiteľské hodnotenie <span class="chip chip--muted">AI je len návrh</span></h4>
    <label class="field">Rozhodnutie
      <select id="review-decision-${id}">
        <option value="approved">Schváliť AI návrh</option>
        <option value="adjusted">Upraviť skóre</option>
        <option value="needs_revision">Vrátiť na dopracovanie</option>
        <option value="rejected">Zamietnuť</option>
      </select>
    </label>
    <label class="field">Finálne skóre (0–100)
      <input id="review-score-${id}" type="number" min="0" max="100" value="${opts.aiScore}">
    </label>
    <label class="field" style="flex-direction:row;align-items:center;gap:8px">
      <input id="review-valid-${id}" type="checkbox" ${opts.aiValid ? 'checked' : ''}> Platné odovzdanie
    </label>
    <label class="field">Spätná väzba pre žiaka
      <textarea id="review-feedback-${id}" rows="2" maxlength="1500" placeholder="Formatívna a povzbudzujúca…"></textarea>
    </label>
    <label class="field">Dôvod úpravy (povinné pri „Upraviť")
      <textarea id="review-reason-${id}" rows="2" maxlength="1000"></textarea>
    </label>
    <p id="review-msg-${id}" class="muted" role="status" aria-live="polite"></p>
    <button class="btn btn--primary" type="submit">Uložiť hodnotenie</button>
  </form>`;
}

export function mountTeacherReviewPanel(opts: TeacherReviewPanelOptions): void {
  const id = opts.submissionId;
  const form = document.querySelector<HTMLFormElement>(`#review-form-${id}`);
  const msg = document.querySelector<HTMLElement>(`#review-msg-${id}`);

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const decision = (document.querySelector(`#review-decision-${id}`) as HTMLSelectElement).value as ReviewDecision;
    const finalScore = Number((document.querySelector(`#review-score-${id}`) as HTMLInputElement).value);
    const finalValid = (document.querySelector(`#review-valid-${id}`) as HTMLInputElement).checked;
    const feedbackText = (document.querySelector(`#review-feedback-${id}`) as HTMLTextAreaElement).value.trim();
    const adjustmentReason = (document.querySelector(`#review-reason-${id}`) as HTMLTextAreaElement).value.trim();

    if (decision === 'adjusted' && !adjustmentReason) {
      if (msg) msg.textContent = 'Pri úprave skóre zadaj dôvod úpravy.';
      return;
    }
    if ((decision === 'needs_revision' || decision === 'rejected') && !feedbackText) {
      if (msg) msg.textContent = 'Pri vrátení alebo zamietnutí zadaj spätnú väzbu.';
      return;
    }

    const result = await submitReview({
      submissionId: id,
      aiEvaluationId: opts.aiEvaluationId,
      decision,
      finalValid,
      finalScore,
      feedbackText: feedbackText || undefined,
      adjustmentReason: adjustmentReason || undefined,
    });

    if (msg) msg.textContent = result.ok ? '' : (result.error ?? 'Hodnotenie zlyhalo.');
    opts.onResult(result);
  });
}
