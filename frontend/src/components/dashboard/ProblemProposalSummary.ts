import type { ProblemProposalSummary as ProposalData } from '../../services/dashboardApi';
import { KpiCard } from './KpiCard';

/** Aggregate summary of problem proposals (entrepreneurial first step). */
export function ProblemProposalSummary(data: ProposalData): string {
  return `<div class="stat-row">
    ${KpiCard('Návrhy problémov', data.count)}
    ${KpiCard('Priem. kvalita', `${data.avgProblemQualityScore} / 100`)}
    ${KpiCard('Predbežné XP', data.avgProvisionalXp)}
    ${KpiCard('Finálne XP', data.avgFinalXp)}
    ${KpiCard('Čaká na učiteľa', data.needsTeacherReview)}
  </div>`;
}
