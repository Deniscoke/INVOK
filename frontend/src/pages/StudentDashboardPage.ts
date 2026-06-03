import { Mascot } from '../components/Mascot';
import { icon } from '../components/icons';
import { MissionCard } from '../components/MissionCard';
import { CompetencyCard } from '../components/CompetencyCard';
import { BadgeCard } from '../components/BadgeCard';
import {
  getActiveMissions,
  getBadges,
  getCompetencyById,
  getStudent,
} from '../services/mockDataService';

export function StudentDashboardPage(): string {
  const student = getStudent();
  const currentLevelXp = 100 * (student.level - 1) ** 2;
  const span = student.nextLevelXp - currentLevelXp;
  const ratio = span > 0 ? Math.max(0, Math.min(1, (student.totalXp - currentLevelXp) / span)) : 0;

  const earned = new Set(student.earnedBadgeIds);

  const missionCards = getActiveMissions(student)
    .map((mission) => MissionCard(mission, { status: 'active' }))
    .join('');

  const competencyCards = student.competencyProgress
    .map((progress) => {
      const competency = getCompetencyById(progress.competencyId);
      return competency ? CompetencyCard(competency, { progress }) : '';
    })
    .join('');

  const badgeCards = getBadges()
    .map((badge) => BadgeCard(badge, { earned: earned.has(badge.id) }))
    .join('');

  return `
  <section class="card">
    <div class="identity">
      ${Mascot({ size: 72 })}
      <div>
        <div class="muted">Pseudonymný žiak</div>
        <div class="identity__alias">${student.alias}</div>
      </div>
    </div>
    <div style="margin-top: var(--space-5)">
      <div class="muted" style="display:flex;justify-content:space-between;font-size:var(--fs-sm)">
        <span>Úroveň ${student.level}</span>
        <span>${student.totalXp} / ${student.nextLevelXp} XP</span>
      </div>
      <div class="progress" style="margin-top:6px"><div class="progress__fill" style="width:${Math.round(ratio * 100)}%"></div></div>
    </div>
  </section>

  <div class="stat-row" style="margin-top: var(--space-5)">
    <div class="stat"><div class="stat__value">${student.level}</div><div class="stat__label">Úroveň</div></div>
    <div class="stat"><div class="stat__value">${student.totalXp}</div><div class="stat__label">Celkové XP</div></div>
    <div class="stat"><div class="stat__value">${student.earnedBadgeIds.length}</div><div class="stat__label">Odznaky</div></div>
    <div class="stat"><div class="stat__value">${student.activeMissionIds.length}</div><div class="stat__label">Aktívne misie</div></div>
  </div>

  <section style="margin-top: var(--space-7)">
    <div class="section-title"><h2>Aktívne misie</h2><a class="nav__link" href="#/">Všetky misie</a></div>
    <div class="grid grid--cards">${missionCards}</div>
  </section>

  <section style="margin-top: var(--space-7)">
    <div class="section-title"><h2>Môj rast v kompetenciách</h2></div>
    <div class="grid grid--cards">${competencyCards}</div>
  </section>

  <section style="margin-top: var(--space-7)">
    <div class="section-title"><h2>Odznaky</h2><span class="muted">za konkrétne správanie, nie za poradie</span></div>
    <div class="grid grid--cards">${badgeCards}</div>
  </section>`;
}
