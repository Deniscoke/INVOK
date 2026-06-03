import type { Competency, CompetencyProgress } from '../services/mockDataService';
import { icon } from './icons';

export interface CompetencyCardOptions {
  /** Show the internal pedagogical mapping (teacher/admin only). */
  teacherHint?: boolean;
  progress?: CompetencyProgress;
}

export function CompetencyCard(
  competency: Competency,
  { teacherHint = false, progress }: CompetencyCardOptions = {},
): string {
  const progressBar = progress
    ? `<div style="margin-top: var(--space-3)">
         <div class="muted" style="display:flex;justify-content:space-between;font-size:var(--fs-sm)">
           <span>Úroveň ${progress.level}</span><span>${Math.round(progress.mastery * 100)} %</span>
         </div>
         <div class="progress" style="margin-top:6px"><div class="progress__fill" style="width:${Math.round(progress.mastery * 100)}%"></div></div>
       </div>`
    : '';

  const hint = teacherHint
    ? `<div class="teacher-hint">
         <div class="teacher-hint__label">Interné mapovanie (učiteľ/admin)</div>
         <div>${competency.teacherDescription}</div>
         <div class="muted" style="margin-top:6px">${competency.curriculumMapping.framework} · ${competency.curriculumMapping.area}</div>
       </div>`
    : '';

  return `
  <article class="card competency">
    <div class="card-icon">${icon(competency.icon, 22)}</div>
    <div class="competency__body">
      <h3 style="margin:0 0 4px;font-size:var(--fs-lg)">${competency.childName}</h3>
      <p class="muted" style="margin:0">${competency.childDescription}</p>
      ${progressBar}
      ${hint}
    </div>
  </article>`;
}
