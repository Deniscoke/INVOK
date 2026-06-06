import type { StudentCodeItem } from '../../services/pilotSetupApi';

/** Existing codes — pseudonym + status only. NEVER the plaintext code or hash. */
export function StudentCodeList(codes: StudentCodeItem[]): string {
  if (codes.length === 0) return '<p class="muted">Žiadne kódy.</p>';
  const rows = codes
    .map(
      (c) => `<tr>
      <td>${c.pseudonym}</td>
      <td><span class="status ${c.isActive ? 'status--done' : 'status--invalid'}">${c.isActive ? 'aktívny' : 'neaktívny'}</span></td>
      <td>${c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleDateString('sk') : '—'}</td>
      <td>${c.isActive ? `<button class="btn btn--ghost btn--sm" data-deactivate="${c.id}" type="button">Deaktivovať</button>` : ''}</td>
    </tr>`,
    )
    .join('');
  return `<table class="codes-table"><thead><tr><th>Prezývka</th><th>Stav</th><th>Naposledy</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}
