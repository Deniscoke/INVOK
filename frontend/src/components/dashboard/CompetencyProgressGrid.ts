import type { CompetencyItem } from '../../services/dashboardApi';

/** Anonymized per-competency progress (avg score + counts). */
export function CompetencyProgressGrid(items: CompetencyItem[]): string {
  const cards = items
    .map(
      (c) => `
    <div class="card" style="padding:var(--space-4)">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <strong>${c.childName}</strong><span class="muted">${c.avgProgress} %</span>
      </div>
      <div class="progress" style="margin-top:6px"><div class="progress__fill" style="width:${Math.max(0, Math.min(100, c.avgProgress))}%"></div></div>
      <div class="muted" style="font-size:var(--fs-sm);margin-top:6px">${c.submissionsCount} odovzdaní · ${c.reviewedCount} potvrdených</div>
    </div>`,
    )
    .join('');
  return `<div class="grid grid--cards">${cards}</div>`;
}
