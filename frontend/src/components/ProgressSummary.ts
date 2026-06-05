import { getCompetencyById } from '../services/mockDataService';
import { icon } from './icons';

// Inline level math (mirrors backend/services/progressService — kept in sync)
function xpForLevel(level: number): number { return 100 * (Math.max(1, Math.floor(level)) - 1) ** 2; }
function levelForXp(xp: number): number { return xp <= 0 ? 1 : Math.floor(Math.sqrt(xp / 100)) + 1; }
function levelProgress(xp: number): { level: number; nextLevelXp: number; ratio: number } {
  const level = levelForXp(xp);
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = next - cur;
  return { level, nextLevelXp: next, ratio: span > 0 ? Math.min(1, (xp - cur) / span) : 0 };
}

export interface ProgressData {
  totalXp: number;
  level: number;
  competencyProgress: { competencyId: string; xp: number; level: number; mastery: number }[];
}

export function ProgressSummary(data: ProgressData): string {
  const lp = levelProgress(data.totalXp);
  const pct = Math.round(lp.ratio * 100);

  const rows = data.competencyProgress
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, 5)
    .map((p) => {
      const comp = getCompetencyById(p.competencyId);
      const name = comp?.childName ?? p.competencyId;
      const iconName = comp?.icon ?? 'star';
      return `
      <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) 0">
        <span class="card-icon" style="width:32px;height:32px;border-radius:10px">${icon(iconName, 18)}</span>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm)">
            <strong>${name}</strong><span class="muted">Úr. ${p.level}</span>
          </div>
          <div class="progress" style="margin-top:4px"><div class="progress__fill" style="width:${Math.round(p.mastery * 100)}%"></div></div>
        </div>
      </div>`;
    }).join('');

  return `
  <div class="card">
    <div style="display:flex;align-items:baseline;justify-content:space-between">
      <h3 style="margin:0">${icon('star', 18)} Môj rast</h3>
      <span class="xp-pill">${data.totalXp} XP · Úr. ${lp.level}</span>
    </div>
    <div style="margin-top:var(--space-3)">
      <div class="muted" style="display:flex;justify-content:space-between;font-size:var(--fs-sm)">
        <span>Pokrok k úrovni ${lp.level + 1}</span><span>${pct} %</span>
      </div>
      <div class="progress" style="margin-top:6px"><div class="progress__fill" style="width:${pct}%"></div></div>
    </div>
    ${rows ? `<div style="margin-top:var(--space-4)">${rows}</div>` : ''}
    <p class="muted" style="margin:var(--space-3) 0 0;font-size:var(--fs-xs)">
      Tip: XP získaš aj za <strong>kvalitný návrh problému</strong> — nielen za vyriešenie celej misie.
    </p>
  </div>`;
}
