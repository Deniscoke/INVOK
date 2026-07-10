import { icon } from '../components/icons';
import { CompetencyCard } from '../components/CompetencyCard';
import { TeacherReviewPanel, mountTeacherReviewPanel } from '../components/TeacherReviewPanel';
import { getClassOverview, getCompetencyById, getMissionById, getPendingReviews } from '../services/mockDataService';
import type { SubmitReviewResult } from '../services/teacherReviewApi';
import { KpiCard } from '../components/dashboard/KpiCard';
import { CompetencyProgressGrid } from '../components/dashboard/CompetencyProgressGrid';
import { ProblemProposalSummary } from '../components/dashboard/ProblemProposalSummary';
import { ReviewStatsPanel } from '../components/dashboard/ReviewStatsPanel';
import { DashboardFilters, mountDashboardFilters } from '../components/dashboard/DashboardFilters';
import { CsvExportButton, mountCsvExportButton } from '../components/dashboard/CsvExportButton';
import {
  PendingQuestApprovalsPanel,
  mountPendingQuestApprovalsPanel,
} from '../components/dashboard/PendingQuestApprovalsPanel';
import {
  QuestionnaireGrowthPanel,
  mountQuestionnaireGrowthPanel,
} from '../components/dashboard/QuestionnaireGrowthPanel';
import {
  ClassStudentsPanel,
  mountClassStudentsPanel,
} from '../components/dashboard/ClassStudentsPanel';
import { GalleryPanel, mountGalleryPanel } from '../components/dashboard/GalleryPanel';
import {
  fetchDashboard,
  fetchClasses,
  isRealTeacherAccount,
  getCachedClasses,
  type DashboardClass,
  type DashboardData,
  type DashboardFilterParams,
} from '../services/dashboardApi';
import { getSnapshot } from '../services/authService';

function confidenceClass(confidence: number): string {
  if (confidence >= 0.8) return 'status--done';
  if (confidence >= 0.6) return 'status--review';
  return 'status--invalid';
}

function scoreBar(score: number): string {
  const cls = score >= 65 ? 'var(--color-success)' : score >= 40 ? '#f59e0b' : 'var(--color-danger)';
  return `<div class="progress" style="width:80px;display:inline-block;vertical-align:middle;margin-left:6px"><div class="progress__fill" style="width:${score}%;background:${cls}"></div></div>`;
}

function realAccountWelcome(): string {
  const user = getSnapshot().user;
  const name = user?.displayName ?? 'učiteľ';
  return `
  <section class="card" style="border-left:4px solid var(--color-success);background:var(--tint-success, #ecfdf5)">
    <div class="card-title">
      <div>
        <div class="muted">Vitaj v INVOK</div>
        <h2 style="margin:0">Ahoj, ${escapeHtml(name)} 👋</h2>
      </div>
      <span class="chip chip--accent">nový účet</span>
    </div>
    <p class="muted" style="margin-top:var(--space-3)">
      Tvoj učiteľský účet je pripravený. Zatiaľ tu nie sú žiadne triedy ani odovzdania —
      vytvor si triedu cez pilotné rozhranie a vygeneruj prístupové kódy pre žiakov.
      Hneď ako odovzdajú prvé misie, uvidíš ich tu.
    </p>
    <div style="display:flex;flex-wrap:wrap;gap:var(--space-3);margin-top:var(--space-4)">
      <a class="btn btn--primary" href="#/pilot">${icon('compass', 16)} Otvoriť pilot setup</a>
      <a class="btn btn--ghost" href="#/student">${icon('book', 16)} Pozrieť žiacke prostredie</a>
    </div>
  </section>`;
}

function myClassesCard(classes: DashboardClass[]): string {
  if (classes.length === 0) return '';
  const rows = classes
    .map((c) => {
      return `
      <li style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-3) 0;border-top:1px solid var(--color-border)">
        <div>
          <strong>${escapeHtml(c.name)}</strong>
          <div class="muted" style="font-size:var(--fs-xs)">${escapeHtml(c.id)}</div>
        </div>
        <a class="btn btn--ghost btn--sm" href="#/pilot">Spravovať</a>
      </li>`;
    })
    .join('');
  return `
  <section class="card" style="margin-top:var(--space-5)">
    <div class="section-title"><h2 style="margin:0">Moje triedy</h2><span class="chip chip--muted">${classes.length}</span></div>
    <ul style="list-style:none;padding:0;margin:0">${rows}</ul>
    <p class="muted" style="font-size:var(--fs-xs);margin-top:var(--space-3)">
      Triedy vytvorené v pilot setupe. Reálny prehľad odovzdaní sa zobrazí po pripojení Supabase backendu.
    </p>
  </section>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function TeacherDashboardPage(): string {
  const realAccount = isRealTeacherAccount();

  // For real teacher accounts, the lower half of the page (class overview,
  // pending reviews, competency coverage) is hidden until we have actual data
  // for that teacher. Showing the legacy demo class would falsely imply they
  // already have students and submissions, which confuses first-time users.
  if (realAccount) {
    const cachedClasses = getCachedClasses();
    return `
  <section style="margin-bottom: var(--space-6)">
    <div class="section-title">
      <h2>Školský dashboard</h2>
      <span id="dashboard-export"></span>
    </div>
    <p class="muted" style="margin-top:0">Anonymizovaný prehľad pre pedagogické rozhodovanie a grantový reporting.</p>
    <div id="dashboard-filters"></div>
    <div id="dashboard-kpis" style="margin-top:var(--space-4)"><p class="muted">Načítavam prehľad…</p></div>
    <div style="margin-top:var(--space-5)">
      <div class="section-title"><h3 style="margin:0">Návrhy problémov</h3></div>
      <div id="dashboard-proposals"></div>
    </div>
    <div style="margin-top:var(--space-5)">
      <div class="section-title"><h3 style="margin:0">Učiteľské hodnotenia</h3></div>
      <div id="dashboard-reviews"></div>
    </div>
    <div style="margin-top:var(--space-5)">
      <div class="section-title"><h3 style="margin:0">Kompetenčný progres</h3></div>
      <div id="dashboard-competencies"></div>
    </div>
    ${QuestionnaireGrowthPanel()}
    ${ClassStudentsPanel()}
    ${GalleryPanel()}
  </section>

  <div style="margin-top:var(--space-6)">${realAccountWelcome()}</div>
  ${myClassesCard(cachedClasses)}
  ${PendingQuestApprovalsPanel()}`;
  }

  const overview = getClassOverview();
  const reviews = getPendingReviews();

  const reviewRows = reviews
    .map((review) => {
      const mission = getMissionById(review.missionId);
      return `
      <div>
        <div class="review">
          <div>
            <strong>${review.studentAlias}</strong>
            <span class="muted"> · ${mission ? mission.title : review.missionId}</span>
            <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">
              <span class="status ${review.aiValid ? 'status--done' : 'status--invalid'}">AI: ${review.aiValid ? 'valid' : 'invalid'}</span>
              <span class="muted" style="font-size:var(--fs-sm)">skóre ${review.aiScore}${scoreBar(review.aiScore)}</span>
              <span class="chip ${confidenceClass(review.aiConfidence)}" style="border:0">istota ${Math.round(review.aiConfidence * 100)} %</span>
              ${review.suggestedTeacherReview ? `<span class="chip chip--warm">${icon('shield', 12)} navrhnuté posúdenie</span>` : ''}
            </div>
          </div>
          <button class="btn btn--ghost btn--sm" type="button" data-review-open="${review.submissionId}">Posúdiť</button>
        </div>
        <div id="review-slot-${review.submissionId}"></div>
      </div>`;
    })
    .join('');

  const coverageCards = overview.competencyCoverage
    .map((coverage) => {
      const competency = getCompetencyById(coverage.competencyId);
      if (!competency) return '';
      return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span class="chip chip--accent">Zvládnutie triedy</span>
          <strong>${Math.round(coverage.classMastery * 100)} %</strong>
        </div>
        ${CompetencyCard(competency, { teacherHint: true })}
      </div>`;
    })
    .join('');

  return `
  <section style="margin-bottom: var(--space-6)">
    <div class="section-title">
      <h2>Školský dashboard</h2>
      <span id="dashboard-export"></span>
    </div>
    <p class="muted" style="margin-top:0">Anonymizovaný prehľad pre pedagogické rozhodovanie a grantový reporting.</p>
    <div id="dashboard-filters"></div>
    <div id="dashboard-kpis" style="margin-top:var(--space-4)"><p class="muted">Načítavam prehľad…</p></div>
    <div style="margin-top:var(--space-5)">
      <div class="section-title"><h3 style="margin:0">Návrhy problémov</h3></div>
      <div id="dashboard-proposals"></div>
    </div>
    <div style="margin-top:var(--space-5)">
      <div class="section-title"><h3 style="margin:0">Učiteľské hodnotenia</h3></div>
      <div id="dashboard-reviews"></div>
    </div>
    <div style="margin-top:var(--space-5)">
      <div class="section-title"><h3 style="margin:0">Kompetenčný progres</h3></div>
      <div id="dashboard-competencies"></div>
    </div>
  </section>

  <section class="card">
    <div class="card-title">
      <div><div class="muted">Trieda</div><h2 style="margin:0">${overview.name}</h2></div>
      <span class="chip chip--muted">${overview.grade}. ročník</span>
    </div>
  </section>

  <div class="stat-row" style="margin-top: var(--space-5)">
    <div class="stat"><div class="stat__value">${overview.studentCount}</div><div class="stat__label">Žiaci (anonymizovaní)</div></div>
    <div class="stat"><div class="stat__value">${overview.activeMissionCount}</div><div class="stat__label">Aktívne misie</div></div>
    <div class="stat"><div class="stat__value">${overview.pendingReviewCount}</div><div class="stat__label">Čaká na review</div></div>
    <div class="stat"><div class="stat__value">${Math.round(overview.averageAiConfidence * 100)} %</div><div class="stat__label">AI istota (priemer)</div></div>
  </div>

  <div class="grid grid--2" style="margin-top: var(--space-7)">
    <section class="card">
      <div class="section-title"><h2>Odovzdania na posúdenie</h2><span class="chip chip--muted">read-only · Phase 3</span></div>
      ${reviewRows || '<p class="muted">Žiadne odovzdania nečakajú na review.</p>'}
    </section>
    <aside class="card" style="align-self:start">
      <h3>${icon('shield', 18)} Rola učiteľa</h3>
      <p class="muted">AI robí <strong>formatívnu</strong> validáciu — vracia skóre, istotu a dôvody. <strong>Učiteľ je vždy finálny garant.</strong> Pri nízkej istote (pod 75 %) AI vždy odporúča posúdenie.</p>
      <div class="teacher-hint" style="margin-top:var(--space-4)">
        <div class="teacher-hint__label">Mock dáta (Phase 3)</div>
        Dashboard ukazuje demo dáta. Reálne odovzdania z triedy budú po pripojení Supabase.
      </div>
    </aside>
  </div>

  <section style="margin-top: var(--space-7)">
    <div class="section-title"><h2>Kompetencie triedy</h2><span class="muted">interné mapovanie na ŠVP ZV</span></div>
    <div class="grid grid--cards">${coverageCards}</div>
  </section>`;
}

/** Wire the "Posúdiť" buttons to open/close an inline review panel. */
export function mountTeacherDashboard(): void {
  void loadSchoolDashboard();
  // The pending-quests panel is only rendered for real (Supabase) teacher
  // accounts. The mount call is safe in either branch — it short-circuits
  // when the container doesn't exist.
  mountPendingQuestApprovalsPanel();
  void mountQuestionnaireGrowthPanel(dashboardState.classId);
  void mountClassStudentsPanel(dashboardState.classId);
  void mountGalleryPanel(dashboardState.classId);
  const reviews = getPendingReviews();
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-review-open]'))) {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-review-open');
      if (!id) return;
      const slot = document.querySelector<HTMLDivElement>(`#review-slot-${id}`);
      if (!slot) return;

      // Toggle: if already open, close it.
      if (slot.innerHTML.trim().length > 0) {
        slot.innerHTML = '';
        button.textContent = 'Posúdiť';
        return;
      }

      const review = reviews.find((r) => r.submissionId === id);
      if (!review) return;
      button.textContent = 'Zavrieť';

      const onResult = (result: SubmitReviewResult): void => {
        if (!result.ok) return;
        const decision = result.review?.decision ?? 'approved';
        slot.innerHTML = `<div class="teacher-hint" style="border-left-color:var(--color-success);background:var(--tint-success)">
          <div class="teacher-hint__label" style="color:#15803d">Hodnotenie uložené</div>
          Rozhodnutie: <strong>${decision}</strong> · finálne XP: <strong>${result.finalXp ?? 0}</strong>
          ${result.source === 'mock' ? ' <span class="chip chip--muted">demo</span>' : ''}
        </div>`;
        button.textContent = 'Hotovo';
        button.disabled = true;
      };

      const panelOptions = { submissionId: id, aiScore: review.aiScore, aiValid: review.aiValid, onResult };
      slot.innerHTML = TeacherReviewPanel(panelOptions);
      mountTeacherReviewPanel(panelOptions);
    });
  }
}

// ---------------------------------------------------------------------------
// School dashboard (anonymized reporting)
// ---------------------------------------------------------------------------
let dashboardState: DashboardFilterParams = { kind: 'all' };

function sourceNote(source: DashboardData['source']): string {
  if (source === 'mock') {
    return '<p class="muted" style="font-size:var(--fs-xs);margin-top:6px">Demo (anonymizované) dáta — pripoj Supabase pre reálne čísla.</p>';
  }
  if (source === 'empty') {
    return '<p class="muted" style="font-size:var(--fs-xs);margin-top:6px">Tvoj účet zatiaľ nemá žiadne dáta. Vytvor triedu a žiakov v <a href="#/pilot">pilot setupe</a>.</p>';
  }
  return '';
}

function renderDashboard(data: DashboardData): void {
  const kpis = document.querySelector('#dashboard-kpis');
  if (kpis) {
    const s = data.summary;
    kpis.innerHTML = `<div class="stat-row">
      ${KpiCard('Žiaci', s.studentsCount)}
      ${KpiCard('Triedy', s.classesCount)}
      ${KpiCard('Misie', s.missionsCount)}
      ${KpiCard('Odovzdania', s.submissionsCount)}
      ${KpiCard('Potvrdené', s.reviewedCount)}
      ${KpiCard('Čaká na review', s.pendingReviewCount)}
      ${KpiCard('Návrhy', s.problemProposalsCount)}
      ${KpiCard('Finálne XP', s.totalFinalXp)}
    </div>${sourceNote(data.source)}`;
  }
  const proposals = document.querySelector('#dashboard-proposals');
  if (proposals) proposals.innerHTML = ProblemProposalSummary(data.proposals);
  const reviews = document.querySelector('#dashboard-reviews');
  if (reviews) reviews.innerHTML = ReviewStatsPanel(data.reviews);
  const competencies = document.querySelector('#dashboard-competencies');
  if (competencies) competencies.innerHTML = CompetencyProgressGrid(data.competencies);
}

async function loadSchoolDashboard(): Promise<void> {
  const classes = await fetchClasses();
  const filtersSlot = document.querySelector('#dashboard-filters');
  if (filtersSlot) {
    filtersSlot.innerHTML = DashboardFilters({ classes, state: dashboardState, onChange: () => {} });
    mountDashboardFilters(async (next) => {
      dashboardState = next;
      renderDashboard(await fetchDashboard(dashboardState));
      void mountQuestionnaireGrowthPanel(dashboardState.classId);
      void mountClassStudentsPanel(dashboardState.classId);
      void mountGalleryPanel(dashboardState.classId);
    });
  }
  const exportSlot = document.querySelector('#dashboard-export');
  if (exportSlot) {
    exportSlot.innerHTML = CsvExportButton();
    mountCsvExportButton(() => dashboardState);
  }
  renderDashboard(await fetchDashboard(dashboardState));
}
