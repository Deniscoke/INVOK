import type { AiEvaluation } from '../services/submissionApi';
import { icon } from './icons';

export interface ReviewView {
  decision: 'approved' | 'adjusted' | 'needs_revision' | 'rejected';
  finalScore: number;
  finalValid: boolean;
  feedbackText: string | null;
  adjustmentReason: string | null;
}

const DECISION_LABEL: Record<ReviewView['decision'], string> = {
  approved: 'Učiteľ schválil ✓',
  adjusted: 'Učiteľ upravil hodnotenie',
  needs_revision: 'Učiteľ ťa prosí dopracovať',
  rejected: 'Učiteľ vrátil – skús to inak',
};

const DECISION_CLASS: Record<ReviewView['decision'], string> = {
  approved: 'status--done',
  adjusted: 'status--review',
  needs_revision: 'status--review',
  rejected: 'status--invalid',
};

/** Final teacher-review block, or a "waiting for teacher" note. */
function reviewBlock(evaluation: AiEvaluation, review: ReviewView | null): string {
  if (review) {
    return `
    <div class="teacher-hint" style="border-left-color:var(--color-primary);background:var(--tint-primary)">
      <div class="teacher-hint__label" style="color:var(--color-primary-strong)">Finálne hodnotenie učiteľa</div>
      <div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap;margin:6px 0">
        <span class="status ${DECISION_CLASS[review.decision]}">${DECISION_LABEL[review.decision]}</span>
        <span class="chip chip--muted">finálne skóre ${Math.round(review.finalScore)}</span>
      </div>
      ${review.feedbackText ? `<div>${review.feedbackText}</div>` : ''}
      ${review.adjustmentReason ? `<div class="muted" style="font-size:var(--fs-sm);margin-top:4px">Dôvod úpravy: ${review.adjustmentReason}</div>` : ''}
    </div>`;
  }
  if (evaluation.suggestedTeacherReview) {
    return `<div class="teacher-hint"><div class="teacher-hint__label">${icon('shield', 14)} Čaká na učiteľské potvrdenie</div>Tvoja AI spätná väzba je pripravená. Učiteľ ju ešte potvrdí – on je finálny garant.</div>`;
  }
  return '';
}

export function AiEvaluationCard(
  evaluation: AiEvaluation,
  xpAwarded = 0,
  review: ReviewView | null = null,
  provisional = false,
): string {
  const scoreColor = evaluation.score >= 65 ? 'status--done' : evaluation.score >= 40 ? 'status--review' : 'status--invalid';
  const confPct = Math.round(evaluation.confidence * 100);

  const reasonRows = evaluation.reasons.map((r) => {
    const cls = r.result === 'met' ? 'status--done' : r.result === 'partial' ? 'status--review' : 'status--invalid';
    return `<div style="display:flex;gap:var(--space-3);align-items:flex-start;padding:var(--space-2) 0;border-bottom:1px solid var(--color-border)">
      <span class="status ${cls}" style="flex-shrink:0">${r.result === 'met' ? '✓' : r.result === 'partial' ? '~' : '✗'} ${r.criterion}</span>
      <span class="muted" style="font-size:var(--fs-sm)">${r.explanation}</span>
    </div>`;
  }).join('');

  const competencyChips = evaluation.detectedCompetencies
    .filter((d) => d.strength >= 0.3)
    .map((d) => `<span class="chip">${d.id} (${Math.round(d.strength * 100)} %)</span>`)
    .join('');

  const teacherFlag = reviewBlock(evaluation, review);

  return `
  <div class="card" style="border-left:4px solid var(--color-${evaluation.valid ? 'success' : 'danger'})">
    <div class="card-title">
      <h3 style="margin:0">${icon('star', 18)} Spätná väzba AI</h3>
      <span class="chip chip--muted">${evaluation.model}</span>
    </div>
    <div class="stat-row" style="margin-top:var(--space-4)">
      <div class="stat"><div class="stat__value"><span class="status ${scoreColor}">${evaluation.score}</span></div><div class="stat__label">Skóre / 100</div></div>
      <div class="stat"><div class="stat__value">${confPct} %</div><div class="stat__label">Istota AI</div></div>
      <div class="stat"><div class="stat__value">${evaluation.valid ? '✓' : '✗'}</div><div class="stat__label">Platné</div></div>
      <div class="stat"><div class="stat__value xp-pill">${xpAwarded} XP</div><div class="stat__label">${provisional ? 'Predbežné XP' : 'Získané XP'}</div></div>
    </div>
    ${provisional && !review ? '<div class="chip chip--warm" style="margin-top:var(--space-3)">🎁 Predbežná odmena za návrh problému — čaká na potvrdenie učiteľom</div>' : ''}
    ${reasonRows ? `<div style="margin-top:var(--space-4)">${reasonRows}</div>` : ''}
    ${competencyChips ? `<div class="chip-row" style="margin-top:var(--space-3)">${competencyChips}</div>` : ''}
    ${teacherFlag}
  </div>`;
}
