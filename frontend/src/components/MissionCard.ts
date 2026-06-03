import type { Mission } from '../services/mockDataService';
import { getCompetencyById } from '../services/mockDataService';
import { icon } from './icons';

export type MissionStatus = 'available' | 'active' | 'review' | 'done';

const DIFFICULTY_LABEL: Record<Mission['difficulty'], string> = {
  easy: 'Ľahká',
  medium: 'Stredná',
  hard: 'Náročná',
};

const MODE_LABEL: Record<Mission['suggestedMode'], string> = {
  individual: 'Sólo',
  team: 'Tím',
};

const STATUS_LABEL: Record<MissionStatus, string> = {
  available: 'Dostupná',
  active: 'Prebieha',
  review: 'Čaká na učiteľa',
  done: 'Hotovo',
};

const STATUS_CLASS: Record<MissionStatus, string> = {
  available: 'status--active',
  active: 'status--active',
  review: 'status--review',
  done: 'status--done',
};

export interface MissionCardOptions {
  status?: MissionStatus;
}

export function MissionCard(mission: Mission, { status = 'available' }: MissionCardOptions = {}): string {
  const competencyChips = mission.targetCompetencies
    .map((id) => {
      const competency = getCompetencyById(id);
      return `<span class="chip">${competency ? competency.childName : id}</span>`;
    })
    .join('');

  return `
  <article class="card mission">
    <div class="card-title">
      <h3>${mission.title}</h3>
      <span class="status ${STATUS_CLASS[status]}">${STATUS_LABEL[status]}</span>
    </div>
    <p class="muted">${mission.story}</p>
    <div class="mission__goal"><strong>Cieľ:</strong> ${mission.goal}</div>
    <p class="muted" style="margin-top: var(--space-3)"><strong>Dôkaz:</strong> ${mission.evidenceRequired.description}</p>
    <div class="mission__meta">
      <span class="xp-pill">${icon('star', 16)} ${mission.baseXp} XP</span>
      <span class="chip chip--muted">${DIFFICULTY_LABEL[mission.difficulty]}</span>
      <span class="chip chip--accent">${MODE_LABEL[mission.suggestedMode]}</span>
    </div>
    <div class="chip-row" style="margin-top: var(--space-3)">${competencyChips}</div>
  </article>`;
}
