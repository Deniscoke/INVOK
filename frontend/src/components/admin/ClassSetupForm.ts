/** Step 2: create a class within a school. */
export function ClassSetupForm(schoolId: string): string {
  return `
  <form id="class-form" class="card stack" novalidate>
    <h3 style="margin:0">2 · Trieda</h3>
    <label class="field">School ID
      <input id="class-school" type="text" value="${schoolId}" readonly>
    </label>
    <label class="field">Názov triedy
      <input id="class-name" type="text" maxlength="120" placeholder="Trieda 5.A" required>
    </label>
    <label class="field">Ročník (1–9, voliteľné)
      <input id="class-grade" type="number" min="1" max="9">
    </label>
    <p id="class-msg" class="muted" role="status" aria-live="polite"></p>
    <button class="btn btn--primary" type="submit">Vytvoriť triedu</button>
  </form>`;
}
