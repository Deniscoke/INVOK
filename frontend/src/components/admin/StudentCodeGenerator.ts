import type { GeneratedCode } from '../../services/pilotSetupApi';

/** Step 3: generate pseudonymous student access codes. */
export function StudentCodeGenerator(classId: string): string {
  return `
  <form id="codes-form" class="card stack" novalidate>
    <h3 style="margin:0">3 · Žiacke kódy</h3>
    <label class="field">Class ID
      <input id="codes-class" type="text" value="${classId}" readonly>
    </label>
    <label class="field">Počet kódov (1–40)
      <input id="codes-count" type="number" min="1" max="40" value="24">
    </label>
    <label class="field">Prefix prezývky
      <input id="codes-prefix" type="text" maxlength="40" value="Líška">
    </label>
    <p id="codes-msg" class="muted" role="status" aria-live="polite"></p>
    <button class="btn btn--primary" type="submit">Vygenerovať kódy</button>
  </form>
  <div id="codes-output"></div>`;
}

/** One-time view of plaintext codes (never shown again). */
export function renderGeneratedCodes(codes: GeneratedCode[]): string {
  const rows = codes.map((c) => `<tr><td>${c.pseudonym}</td><td><code>${c.code}</code></td></tr>`).join('');
  return `
  <div class="card" style="margin-top:var(--space-3);border-left:4px solid var(--color-warm)">
    <div class="teacher-hint__label" style="color:#b45309">⚠ Kódy sa zobrazia IBA RAZ — vytlač alebo skopíruj ich teraz</div>
    <p class="muted" style="font-size:var(--fs-sm)">Do databázy sa ukladá len ich hash. Plaintext sa už nedá zobraziť.</p>
    <div style="display:flex;gap:var(--space-2);margin:var(--space-3) 0">
      <button class="btn btn--ghost btn--sm" id="codes-copy" type="button">Kopírovať</button>
      <button class="btn btn--ghost btn--sm" id="codes-print" type="button">Tlačiť</button>
    </div>
    <table class="codes-table"><thead><tr><th>Prezývka</th><th>Kód</th></tr></thead><tbody>${rows}</tbody></table>
  </div>`;
}
