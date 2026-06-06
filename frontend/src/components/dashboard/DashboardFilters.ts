import type { DashboardFilterParams } from '../../services/dashboardApi';

export interface ClassOption {
  id: string;
  name: string;
}

export interface DashboardFiltersOptions {
  classes: ClassOption[];
  state: DashboardFilterParams;
  onChange: (next: DashboardFilterParams) => void;
}

/** Filter bar: class, date range, submission kind. */
export function DashboardFilters(opts: DashboardFiltersOptions): string {
  const classOptions = [
    '<option value="">Všetky triedy</option>',
    ...opts.classes.map((c) => `<option value="${c.id}" ${opts.state.classId === c.id ? 'selected' : ''}>${c.name}</option>`),
  ].join('');
  const kind = opts.state.kind ?? 'all';
  return `<div class="card" style="display:flex;flex-wrap:wrap;gap:var(--space-3);align-items:flex-end">
    <label class="field" style="flex:1;min-width:160px">Trieda<select id="df-class">${classOptions}</select></label>
    <label class="field">Od<input id="df-from" type="date" value="${opts.state.from ?? ''}"></label>
    <label class="field">Do<input id="df-to" type="date" value="${opts.state.to ?? ''}"></label>
    <label class="field">Typ<select id="df-kind">
      <option value="all" ${kind === 'all' ? 'selected' : ''}>Všetko</option>
      <option value="problem_proposal" ${kind === 'problem_proposal' ? 'selected' : ''}>Návrhy problémov</option>
      <option value="solution_submission" ${kind === 'solution_submission' ? 'selected' : ''}>Riešenia</option>
    </select></label>
  </div>`;
}

function readFilters(): DashboardFilterParams {
  return {
    classId: (document.querySelector('#df-class') as HTMLSelectElement | null)?.value || undefined,
    from: (document.querySelector('#df-from') as HTMLInputElement | null)?.value || undefined,
    to: (document.querySelector('#df-to') as HTMLInputElement | null)?.value || undefined,
    kind: ((document.querySelector('#df-kind') as HTMLSelectElement | null)?.value as DashboardFilterParams['kind']) || 'all',
  };
}

export function mountDashboardFilters(onChange: (next: DashboardFilterParams) => void): void {
  for (const id of ['#df-class', '#df-from', '#df-to', '#df-kind']) {
    document.querySelector(id)?.addEventListener('change', () => onChange(readFilters()));
  }
}

export { readFilters };
