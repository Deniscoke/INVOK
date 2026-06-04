import type { AiEvaluation } from '../services/submissionApi';
import { icon } from './icons';

export function AiEvaluationCard(evaluation: AiEvaluation, xpAwarded = 0): string {
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

  const teacherFlag = evaluation.suggestedTeacherReview
    ? `<div class="teacher-hint"><div class="teacher-hint__label">${icon('shield', 14)} AI navrhuje učiteľské posúdenie</div>Učiteľ je finálny garant. Toto je len prvá formatívna spätná väzba.</div>`
    : '';

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
      <div class="stat"><div class="stat__value xp-pill">${xpAwarded} XP</div><div class="stat__label">Získané XP</div></div>
    </div>
    ${reasonRows ? `<div style="margin-top:var(--space-4)">${reasonRows}</div>` : ''}
    ${competencyChips ? `<div class="chip-row" style="margin-top:var(--space-3)">${competencyChips}</div>` : ''}
    ${teacherFlag}
  </div>`;
}
