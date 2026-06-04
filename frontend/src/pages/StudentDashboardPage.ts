import { Mascot } from '../components/Mascot';
import { MissionCard } from '../components/MissionCard';
import { BadgeCard } from '../components/BadgeCard';
import { SubmissionForm, mountSubmissionForm } from '../components/SubmissionForm';
import { AiEvaluationCard } from '../components/AiEvaluationCard';
import { ProgressSummary } from '../components/ProgressSummary';
import {
  getBadges,
  getMissions,
  getStudent,
} from '../services/mockDataService';
import { getSnapshot } from '../services/authService';
import type { SubmissionResult } from '../services/submissionApi';

let pendingMount: (() => void) | null = null;

export function StudentDashboardPage(): string {
  const authUser = getSnapshot().user;
  const student = getStudent();
  const alias = authUser?.displayName ?? student.alias;
  const earned = new Set(student.earnedBadgeIds);
  const missions = getMissions().slice(0, 4);
  const activeId = missions[0]?.id;

  const missionCards = missions
    .map((mission) => {
      const isActive = mission.id === activeId;
      return `
      <div>
        ${MissionCard(mission, { status: isActive ? 'active' : 'available' })}
        ${isActive ? `<div id="form-slot-${mission.id}" style="margin-top:var(--space-3)"></div><div id="eval-slot-${mission.id}"></div>` : ''}
      </div>`;
    })
    .join('');

  const badgeCards = getBadges()
    .slice(0, 4)
    .map((badge) => BadgeCard(badge, { earned: earned.has(badge.id) }))
    .join('');

  const progressData = {
    totalXp: student.totalXp,
    level: student.level,
    competencyProgress: student.competencyProgress,
  };

  // Schedule form mount after render
  if (activeId) {
    const activeMission = missions[0];
    pendingMount = () => {
      const slot = document.querySelector(`#form-slot-${activeMission.id}`);
      if (!slot) return;
      slot.innerHTML = SubmissionForm({ mission: activeMission, onResult: () => {} });
      mountSubmissionForm({
        mission: activeMission,
        onResult: (result: SubmissionResult) => {
          const evalSlot = document.querySelector(`#eval-slot-${activeMission.id}`);
          if (!evalSlot) return;
          if (result.ok && result.evaluation) {
            evalSlot.innerHTML = `<div style="margin-top:var(--space-3)">${AiEvaluationCard(result.evaluation, result.xpAwarded ?? 0)}</div>`;
          } else if (!result.ok) {
            evalSlot.innerHTML = `<p class="muted" style="color:var(--color-danger)">${result.error}</p>`;
          }
        },
      });
    };
  }

  return `
  <section class="card">
    <div class="identity">
      ${Mascot({ size: 72 })}
      <div>
        <div class="muted">Pseudonymný žiak</div>
        <div class="identity__alias">${alias}</div>
      </div>
    </div>
  </section>

  <div class="grid grid--2" style="margin-top:var(--space-5)">
    <div class="stack">
      ${ProgressSummary(progressData)}

      <section>
        <div class="section-title"><h2>Misie</h2></div>
        <div class="grid grid--cards">${missionCards}</div>
      </section>
    </div>

    <div class="stack">
      <section>
        <div class="section-title"><h2>Odznaky</h2></div>
        <div class="grid" style="grid-template-columns:repeat(2,1fr)">${badgeCards}</div>
      </section>
    </div>
  </div>`;
}

export function mountStudentDashboard(): void {
  pendingMount?.();
  pendingMount = null;
}
