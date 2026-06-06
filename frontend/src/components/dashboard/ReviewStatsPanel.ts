import type { ReviewStats } from '../../services/dashboardApi';
import { KpiCard } from './KpiCard';

/** Teacher review decisions + AI-vs-teacher score delta. */
export function ReviewStatsPanel(data: ReviewStats): string {
  const delta = data.avgScoreDelta;
  const deltaClass = delta < 0 ? 'status--invalid' : delta > 0 ? 'status--done' : 'status--review';
  return `<div class="card">
    <div class="chip-row" style="margin-bottom:var(--space-3)">
      <span class="status status--done">Schválené ${data.approved}</span>
      <span class="status status--review">Upravené ${data.adjusted}</span>
      <span class="status status--review">Dopracovať ${data.needsRevision}</span>
      <span class="status status--invalid">Zamietnuté ${data.rejected}</span>
    </div>
    <div class="stat-row">
      ${KpiCard('Priem. AI skóre', data.avgAiScore)}
      ${KpiCard('Priem. učiteľ', data.avgTeacherScore)}
      <div class="stat">
        <div class="stat__value"><span class="status ${deltaClass}">${delta > 0 ? '+' : ''}${delta}</span></div>
        <div class="stat__label">Rozdiel (učiteľ − AI)</div>
      </div>
    </div>
  </div>`;
}
