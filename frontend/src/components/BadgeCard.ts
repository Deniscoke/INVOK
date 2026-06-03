import type { Badge } from '../services/mockDataService';
import { icon } from './icons';

export interface BadgeCardOptions {
  earned?: boolean;
}

export function BadgeCard(badge: Badge, { earned = false }: BadgeCardOptions = {}): string {
  return `
  <article class="card badge-card ${earned ? '' : 'badge-card--locked'}">
    <div class="badge-card__icon">${icon(badge.icon, 26)}</div>
    <h3 style="margin:0 0 4px;font-size:var(--fs-md)">${badge.name}</h3>
    <p class="muted" style="margin:0;font-size:var(--fs-sm)">${badge.description}</p>
    <div style="margin-top:var(--space-3)">
      <span class="status ${earned ? 'status--done' : 'status--review'}">${earned ? 'Získaný' : 'Zamknutý'}</span>
    </div>
  </article>`;
}
