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
import { fetchMyProgress, type SubmissionResult } from '../services/submissionApi';
import { listQuests, type StudentQuest } from '../services/questStore';
import { competencyName, strengthToLevel, levelLabel } from '../services/competencyScale';
import { openCertificate } from '../components/Certificate';
import { openPortfolio } from '../components/Portfolio';
import { computeModuleBadges, earnedBadgeCount } from '../services/moduleBadges';
import { openQuestionnaire } from '../components/Questionnaire';
import { fetchMyQuestionnaires } from '../services/questionnaireApi';

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

function profileCard(alias: string, certUnlocked: boolean): string {
  const portfolioBtn = `<button type="button" class="btn btn--ghost btn--sm" data-portfolio-btn>${'\u{1F5C2}\u{FE0F}'} Portfólio</button>`;
  const certBtn = certUnlocked
    ? `<button type="button" class="btn btn--ghost btn--sm" data-cert-btn>${'\u{1F393}'} Certifikát</button>`
    : `<button type="button" class="btn btn--ghost btn--sm" disabled title="Odomkne sa po vyplnení záverečného dotazníka" style="opacity:.55">${'\u{1F512}'} Certifikát</button>`;
  return `
  <section class="card">
    <div class="identity">
      ${Mascot({ size: 72 })}
      <div>
        <div class="muted">Pseudonymný žiak</div>
        <div class="identity__alias">${escapeHtml(alias)}</div>
      </div>
      <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">${portfolioBtn}${certBtn}</div>
    </div>
  </section>`;
}

/** Start/finish questionnaire tiles — input is always open; output unlocks after
 *  all 4 badges; completing output then unlocks the certificate. */
function renderQuestionnaireSection(hasInput: boolean, hasOutput: boolean, badgesEarned: number): string {
  const tile = (inner: string, locked = false): string =>
    `<div style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-3)${locked ? ';opacity:.6' : ''}">${inner}</div>`;

  const inputTile = hasInput
    ? tile(`<strong>${'\u{1F680}'} Štartový dotazník</strong><div style="margin-top:8px"><span class="chip chip--accent">hotový ✓</span></div>`)
    : tile(`<strong>${'\u{1F680}'} Štartový dotazník</strong>
        <p class="muted" style="font-size:var(--fs-xs);margin:6px 0 10px">Spoznaj sa na začiatku cesty.</p>
        <button type="button" class="btn btn--primary btn--sm" data-q-input>Vyplniť (+50 XP)</button>`);

  let outputTile: string;
  if (hasOutput) {
    outputTile = tile(`<strong>${'\u{1F3C6}'} Záverečný dotazník</strong><div style="margin-top:8px"><span class="chip chip--accent">hotový ✓</span></div>`);
  } else if (badgesEarned >= 4) {
    outputTile = tile(`<strong>${'\u{1F3C6}'} Záverečný dotazník</strong>
        <p class="muted" style="font-size:var(--fs-xs);margin:6px 0 10px">Odomknuté — ukáž svoj rast!</p>
        <button type="button" class="btn btn--primary btn--sm" data-q-output>Vyplniť (+80 XP)</button>`);
  } else {
    outputTile = tile(
      `<strong>${'\u{1F512}'} Záverečný dotazník</strong>
        <p class="muted" style="font-size:var(--fs-xs);margin:6px 0 0">Odomkne sa po získaní všetkých 4 odznakov (máš ${badgesEarned}/4).</p>`,
      true,
    );
  }

  return `<div class="card">
    <div class="card-title"><h3 style="margin:0">${'\u{1F4CB}'} Dotazníky</h3></div>
    <p class="muted" style="margin:6px 0 var(--space-3)">Na štarte aj na konci programu vyplníš krátky dotazník (6 oblastí). Porovnáme ich a uvidíš svoj rast.</p>
    <div class="grid grid--2" style="gap:var(--space-3)">${inputTile}${outputTile}</div>
  </div>`;
}

const JOURNEY_STATE_LABEL: Record<string, { label: string; cls: string }> = {
  pending_approval: { label: 'čaká na učiteľa', cls: 'chip--warm' },
  changes_requested: { label: 'na úpravu', cls: 'chip--warm' },
  approved: { label: 'môžeš odovzdať', cls: 'chip--accent' },
  submitted: { label: 'odovzdané', cls: 'chip--accent' },
  completed: { label: 'hotovo \u{1F3C6}', cls: 'chip--muted' },
};

/** Per-competency 1–5 levels — the measurable, child-friendly view. */
function renderCompetencyLevels(progress: { competencyProgress: { competencyId: string; mastery: number }[] }): string {
  if (progress.competencyProgress.length === 0) return '';
  const rows = [...progress.competencyProgress]
    .sort((a, b) => b.mastery - a.mastery)
    .map((p) => {
      const lvl = strengthToLevel(p.mastery);
      return `<li style="display:flex;justify-content:space-between;gap:var(--space-3);padding:4px 0">
        <span>${escapeHtml(competencyName(p.competencyId))}</span>
        <strong>${lvl}/5 <span class="muted" style="font-weight:normal">(${levelLabel(lvl)})</span></strong></li>`;
    })
    .join('');
  return `<div class="card"><h3 style="margin-top:0">${'\u{1F3AF}'} Tvoje kompetencie (1–5)</h3><ul style="list-style:none;margin:0;padding:0">${rows}</ul></div>`;
}

/** Collectible INVOK module badges, unlocked from real competency progress. */
function renderModuleBadges(progress: { competencyProgress: { competencyId: string; mastery: number }[] }): string {
  const states = computeModuleBadges(progress);
  const earned = states.filter((s) => s.earned).length;
  const cards = states
    .map((s) => {
      const locked = !s.earned;
      const icon = locked ? '\u{1F512}' : s.badge.emoji;
      const status = s.earned
        ? '<span class="chip chip--accent" style="margin-top:8px">získaný ✓</span>'
        : `<span class="chip chip--muted" style="margin-top:8px">${s.level}/5 · zamknutý</span>
           <span class="muted" style="display:block;margin-top:6px;font-size:var(--fs-xs)">${escapeHtml(s.badge.unlockHint)}</span>`;
      return `<div class="card badge-card${locked ? ' badge-card--locked' : ''}">
        <div class="badge-card__icon" style="font-size:26px">${icon}</div>
        <strong style="display:block">${escapeHtml(s.badge.name)}</strong>
        <span class="muted" style="display:block;font-size:var(--fs-xs)">${escapeHtml(s.badge.module)}</span>
        ${status}
      </div>`;
    })
    .join('');
  return `<div class="card">
    <div class="card-title"><h3 style="margin:0">${'\u{1F3C5}'} Odznaky <span class="muted" style="font-weight:normal">(${earned}/4)</span></h3></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--space-3);margin-top:var(--space-3)">${cards}</div>
  </div>`;
}

function renderMyMissions(quests: StudentQuest[]): string {
  const relevant = quests.filter((q) => q.state !== 'draft' && q.state !== 'rejected');
  const rows = relevant
    .map((q) => {
      const badge = JOURNEY_STATE_LABEL[q.state] ?? { label: q.state, cls: 'chip--muted' };
      return `<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3)">
        <strong style="min-width:0">${escapeHtml(q.title)}</strong>
        <span class="chip ${badge.cls}">${badge.label}</span></div>`;
    })
    .join('');
  return `<section><div class="section-title"><h2 style="margin:0">Tvoje misie</h2><a class="muted" href="#/quests">všetky &rsaquo;</a></div>
    <div class="stack" style="gap:var(--space-3)">${rows || '<p class="muted">Zatiaľ žiadne. <a href="#/quests">Začni misiou</a>.</p>'}</div></section>`;
}

async function loadJourney(alias: string): Promise<void> {
  const slot = document.querySelector<HTMLElement>('#journey-slot');
  if (!slot) return;
  const [progress, quests, questionnaires] = await Promise.all([
    fetchMyProgress(),
    listQuests(),
    fetchMyQuestionnaires(),
  ]);
  const hasInput = questionnaires.some((q) => q.phase === 'input');
  const hasOutput = questionnaires.some((q) => q.phase === 'output');
  const badges = earnedBadgeCount(progress);
  const started = quests.filter((q) => q.state !== 'draft' && q.state !== 'rejected');
  const hasAnything =
    progress.totalXp > 0 ||
    progress.competencyProgress.length > 0 ||
    started.length > 0 ||
    questionnaires.length > 0;

  const main = hasAnything
    ? `${profileCard(alias, hasOutput)}
      <div class="grid grid--2" style="margin-top:var(--space-5);gap:var(--space-4)">
        <div class="stack">
          ${ProgressSummary(progress)}
          ${renderCompetencyLevels(progress)}
        </div>
        <div class="stack">
          ${renderMyMissions(quests)}
        </div>
      </div>
      <div style="margin-top:var(--space-4)">${renderModuleBadges(progress)}</div>`
    : realStudentEmptyState(alias);

  slot.innerHTML = `${main}<div style="margin-top:var(--space-4)">${renderQuestionnaireSection(hasInput, hasOutput, badges)}</div>`;

  const reload = (): void => {
    void loadJourney(alias);
  };
  slot.querySelector<HTMLButtonElement>('[data-cert-btn]')?.addEventListener('click', () => openCertificate({ alias }));
  slot.querySelector<HTMLButtonElement>('[data-portfolio-btn]')?.addEventListener('click', () => void openPortfolio({ alias }));
  slot
    .querySelector<HTMLButtonElement>('[data-q-input]')
    ?.addEventListener('click', () => openQuestionnaire({ phase: 'input', onDone: reload }));
  slot
    .querySelector<HTMLButtonElement>('[data-q-output]')
    ?.addEventListener('click', () => openQuestionnaire({ phase: 'output', onDone: reload }));
}

export function StudentDashboardPage(): string {
  const authUser = getSnapshot().user;
  const realStudent = isRealStudentAccount();

  if (realStudent) {
    const alias = authUser?.displayName ?? 'žiak';
    pendingMount = () => { void loadJourney(alias); };
    return `<div id="journey-slot"><p class="muted">Načítavam tvoju cestu…</p></div>`;
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
