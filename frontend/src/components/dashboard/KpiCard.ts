/** A single KPI stat tile for the school dashboard. */
export function KpiCard(label: string, value: string | number, hint?: string): string {
  return `<div class="stat">
    <div class="stat__value">${value}</div>
    <div class="stat__label">${label}</div>
    ${hint ? `<div class="muted" style="font-size:var(--fs-xs);margin-top:2px">${hint}</div>` : ''}
  </div>`;
}
