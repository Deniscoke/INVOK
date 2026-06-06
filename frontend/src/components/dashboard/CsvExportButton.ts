import { downloadDashboardCsv, type DashboardFilterParams } from '../../services/dashboardApi';

/** Button that downloads the anonymized aggregate CSV export. */
export function CsvExportButton(): string {
  return `<button class="btn btn--ghost btn--sm" id="dashboard-csv-export" type="button">⬇ Export CSV (anonymizovaný)</button>`;
}

export function mountCsvExportButton(getParams: () => DashboardFilterParams): void {
  document.querySelector('#dashboard-csv-export')?.addEventListener('click', () => {
    void downloadDashboardCsv(getParams());
  });
}
