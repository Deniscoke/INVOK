/** Step 1: create a pilot school. */
export function SchoolSetupForm(): string {
  return `
  <form id="school-form" class="card stack" novalidate>
    <h3 style="margin:0">1 · Škola</h3>
    <label class="field">Názov školy
      <input id="school-name" type="text" maxlength="120" placeholder="ZŠ Príklad" required>
    </label>
    <label class="field">Región (voliteľné)
      <input id="school-region" type="text" maxlength="120">
    </label>
    <p id="school-msg" class="muted" role="status" aria-live="polite"></p>
    <button class="btn btn--primary" type="submit">Vytvoriť školu</button>
  </form>`;
}
