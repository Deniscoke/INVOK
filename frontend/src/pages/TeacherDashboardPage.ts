import { icon } from '../components/icons';
import { CompetencyCard } from '../components/CompetencyCard';
import { getClassOverview, getCompetencyById, getMissionById, getPendingReviews } from '../services/mockDataService';

function confidenceClass(confidence: number): string {
  if (confidence >= 0.8) return 'status--done';
  if (confidence >= 0.6) return 'status--review';
  return 'status--invalid';
}

export function TeacherDashboardPage(): string {
  const overview = getClassOverview();
  const reviews = getPendingReviews();

  const reviewRows = reviews
    .map((review) => {
      const mission = getMissionById(review.missionId);
      return `
      <div class="review">
        <div>
          <strong>${review.studentAlias}</strong>
          <span class="muted"> · ${mission ? mission.title : review.missionId}</span>
          <div style="margin-top:4px" class="chip-row">
            <span class="status ${review.aiValid ? 'status--done' : 'status--invalid'}">AI: ${review.aiValid ? 'valid' : 'invalid'}</span>
            <span class="chip chip--muted">skóre ${review.aiScore}</span>
            <span class="chip ${confidenceClass(review.aiConfidence)}" style="border:0">istota ${Math.round(review.aiConfidence * 100)} %</span>
            ${review.suggestedTeacherReview ? '<span class="chip chip--warm">navrhnuté posúdenie</span>' : ''}
          </div>
        </div>
        <a class="btn btn--ghost" href="#/teacher">Skontrolovať</a>
      </div>`;
    })
    .join('');

  const coverageCards = overview.competencyCoverage
    .map((coverage) => {
      const competency = getCompetencyById(coverage.competencyId);
      if (!competency) return '';
      return `<div>
        <div class="chip chip--accent" style="margin-bottom:8px">Zvládnutie triedy: ${Math.round(coverage.classMastery * 100)} %</div>
        ${CompetencyCard(competency, { teacherHint: true })}
      </div>`;
    })
    .join('');

  return `
  <section class="card">
    <div class="card-title">
      <div><div class="muted">Trieda</div><h2 style="margin:0">${overview.name}</h2></div>
      <span class="chip chip--muted">${overview.grade}. ročník</span>
    </div>
  </section>

  <div class="stat-row" style="margin-top: var(--space-5)">
    <div class="stat"><div class="stat__value">${overview.studentCount}</div><div class="stat__label">Anonymizovaní žiaci</div></div>
    <div class="stat"><div class="stat__value">${overview.activeMissionCount}</div><div class="stat__label">Aktívne misie</div></div>
    <div class="stat"><div class="stat__value">${overview.pendingReviewCount}</div><div class="stat__label">Čaká na review</div></div>
    <div class="stat"><div class="stat__value">${Math.round(overview.averageAiConfidence * 100)} %</div><div class="stat__label">Priemerná AI istota</div></div>
  </div>

  <div class="grid grid--2" style="margin-top: var(--space-7)">
    <section class="card">
      <div class="section-title"><h2>Odovzdania na posúdenie</h2><span class="muted">učiteľ je garant</span></div>
      ${reviewRows}
    </section>
    <aside class="card" style="align-self:start">
      <h3>${icon('shield', 18)} AI ako pomocník</h3>
      <p class="muted">AI robí formatívnu validáciu — vráti skóre, istotu a dôvody. Nikdy nedáva finálnu známku. Pri nízkej istote alebo slabých dôkazoch navrhne tvoje posúdenie.</p>
    </aside>
  </div>

  <section style="margin-top: var(--space-7)">
    <div class="section-title"><h2>Prehľad kompetencií triedy</h2><span class="muted">interné mapovanie na ŠVP ZV</span></div>
    <div class="grid grid--cards">${coverageCards}</div>
  </section>`;
}
