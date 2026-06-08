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
import { isRealStudentAccount } from '../services/dashboardApi';
import type { SubmissionResult } from '../services/submissionApi';

let pendingMount: (() => void) | null = null;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Clean welcome view for a newly-joined real student. Hides the demo XP /
 * badges / preset missions until the student proposes a quest or a teacher
 * assigns one — otherwise a fresh account looks like it already earned XP.
 */
function realStudentEmptyState(alias: string): string {
  const safeAlias = escapeHtml(alias);
  return `
  <section class="card">
    <div class="identity">
      ${Mascot({ size: 72 })}
      <div>
        <div class="muted">Pseudonymný žiak</div>
        <div class="identity__alias">${safeAlias}</div>
      </div>
    </div>
  </section>

  <section class="card" style="margin-top:var(--space-5);border-left:4px solid var(--color-accent, #6366f1);background:var(--tint-accent, #eef2ff)">
    <div class="card-title">
      <div>
        <div class="muted">Vitaj v INVOK</div>
        <h2 style="margin:0">Ahoj, ${safeAlias} 👋</h2>
      </div>
      <span class="chip chip--accent">nový účet</span>
    </div>
    <p class="muted" style="margin-top:var(--space-3)">
      Tu zatiaľ nemáš žiadne XP, odznaky ani aktívne misie — všetko sa odomyká postupne,
      keď navrhneš alebo splníš misiu schválenú učiteľom.
    </p>

    <div class="grid grid--2" style="margin-top:var(--space-4);gap:var(--space-4)">
      <div class="card" style="background:var(--color-surface, #fff);border-left:3px solid var(--color-success)">
        <h3 style="margin-top:0">${'\u2728'} Navrhni si misiu</h3>
        <p class="muted" style="font-size:var(--fs-sm)">
          Popíš problém vo svojej škole / komunite a navrhni krok, ktorý urobíš.
          Učiteľ ti návrh potvrdí a získaš predbežné XP.
        </p>
        <a class="btn btn--primary" href="#/quests">Otvoriť návrhy misií</a>
      </div>
      <div class="card" style="background:var(--color-surface, #fff);border-left:3px solid var(--color-accent)">
        <h3 style="margin-top:0">${'\u{1F916}'} Nechaj AI vygenerovať misiu</h3>
        <p class="muted" style="font-size:var(--fs-sm)">
          AI ti pripraví návrh misie v súlade s INVOK cieľmi a ŠVP ZV. Učiteľ ho potvrdí
          alebo upraví, a potom môžeš odovzdať.
        </p>
        <a class="btn btn--ghost" href="#/quests?source=ai">Vyžiadať návrh od AI</a>
      </div>
    </div>

    <p class="muted" style="margin-top:var(--space-4);font-size:var(--fs-xs)">
      Limit: max <strong>5 aktívnych misií</strong> naraz. Nepoužité môžeš zmazať.
    </p>
  </section>`;
}

export function StudentDashboardPage(): string {
  const authUser = getSnapshot().user;
  const realStudent = isRealStudentAccount();

  if (realStudent) {
    pendingMount = null;
    return realStudentEmptyState(authUser?.displayName ?? 'žiak');
  }

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

      // Problem proposal form (entrepreneurial first step → provisional reward)
      const proposalSlot = document.querySelector('#proposal-slot');
      if (proposalSlot) {
        const proposalOptions = {
          mission: activeMission,
          kind: 'problem_proposal' as const,
          onResult: (result: SubmissionResult) => {
            const evalSlot = document.querySelector('#proposal-eval-slot');
            if (!evalSlot) return;
            if (result.ok && result.evaluation) {
              evalSlot.innerHTML = `<div style="margin-top:var(--space-3)">${AiEvaluationCard(result.evaluation, result.xpAwarded ?? 0, null, result.provisional ?? true)}</div>`;
            } else if (!result.ok) {
              evalSlot.innerHTML = `<p class="muted" style="color:var(--color-danger)">${result.error}</p>`;
            }
          },
        };
        proposalSlot.innerHTML = SubmissionForm(proposalOptions);
        mountSubmissionForm(proposalOptions);
      }
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

      <section>
        <div class="section-title"><h2>Podnikavý krok</h2><span class="muted">odmena za návrh problému</span></div>
        <div id="proposal-slot"></div>
        <div id="proposal-eval-slot"></div>
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
