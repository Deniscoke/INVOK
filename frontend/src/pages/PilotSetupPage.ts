import { SchoolSetupForm } from '../components/admin/SchoolSetupForm';
import { ClassSetupForm } from '../components/admin/ClassSetupForm';
import { StudentCodeGenerator, renderGeneratedCodes } from '../components/admin/StudentCodeGenerator';
import { StudentCodeList } from '../components/admin/StudentCodeList';
import {
  createSchool,
  createClass,
  generateStudentCodes,
  listStudentCodes,
  deactivateStudentCode,
  type GeneratedCode,
} from '../services/pilotSetupApi';

export function PilotSetupPage(): string {
  return `
  <section class="auth-page" style="max-width:760px">
    <h1>Pilot setup</h1>
    <p class="muted">Vytvor školu, triedu a pseudonymné žiacke kódy. Žiadne osobné údaje.
      Bez pripojeného API beží v bezpečnom <strong>demo</strong> režime.</p>
    <div id="setup-school">${SchoolSetupForm()}</div>
    <div id="setup-class" style="margin-top:var(--space-4)"></div>
    <div id="setup-codes" style="margin-top:var(--space-4)"></div>
    <section style="margin-top:var(--space-5)">
      <div class="section-title"><h3 style="margin:0">Existujúce kódy</h3><span class="muted">bez plaintextu</span></div>
      <div id="setup-list-body"><p class="muted">Najprv vytvor triedu.</p></div>
    </section>
  </section>`;
}

let setupSchoolId = '';
let setupClassId = '';

export function mountPilotSetup(): void {
  setupSchoolId = '';
  setupClassId = '';
  wireSchoolForm();
}

function setMessage(selector: string, text: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  if (el) el.textContent = text;
}

function wireSchoolForm(): void {
  document.querySelector<HTMLFormElement>('#school-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = (document.querySelector('#school-name') as HTMLInputElement).value.trim();
    const region = (document.querySelector('#school-region') as HTMLInputElement).value.trim() || undefined;
    if (name.length < 2) return setMessage('#school-msg', 'Zadaj názov školy.');
    const result = await createSchool({ schoolName: name, region });
    if (!result.ok || !result.id) return setMessage('#school-msg', result.error ?? 'Vytvorenie zlyhalo.');
    setupSchoolId = result.id;
    setMessage('#school-msg', `Škola vytvorená${result.source === 'mock' ? ' (demo)' : ''}.`);
    const slot = document.querySelector('#setup-class');
    if (slot) {
      slot.innerHTML = ClassSetupForm(setupSchoolId);
      wireClassForm();
    }
  });
}

function wireClassForm(): void {
  document.querySelector<HTMLFormElement>('#class-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = (document.querySelector('#class-name') as HTMLInputElement).value.trim();
    const gradeRaw = (document.querySelector('#class-grade') as HTMLInputElement).value;
    if (name.length < 2) return setMessage('#class-msg', 'Zadaj názov triedy.');
    const result = await createClass({ schoolId: setupSchoolId, className: name, grade: gradeRaw ? Number(gradeRaw) : undefined });
    if (!result.ok || !result.id) return setMessage('#class-msg', result.error ?? 'Vytvorenie zlyhalo.');
    setupClassId = result.id;
    setMessage('#class-msg', `Trieda vytvorená${result.source === 'mock' ? ' (demo)' : ''}.`);
    const slot = document.querySelector('#setup-codes');
    if (slot) {
      slot.innerHTML = StudentCodeGenerator(setupClassId);
      wireCodesForm();
    }
    await refreshList();
  });
}

function wireCodesForm(): void {
  document.querySelector<HTMLFormElement>('#codes-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const count = Number((document.querySelector('#codes-count') as HTMLInputElement).value);
    const prefix = (document.querySelector('#codes-prefix') as HTMLInputElement).value.trim();
    const result = await generateStudentCodes({ classId: setupClassId, count, pseudonymPrefix: prefix });
    if (!result.ok || !result.codes) return setMessage('#codes-msg', result.error ?? 'Generovanie zlyhalo.');
    setMessage('#codes-msg', `${result.codes.length} kódov${result.source === 'mock' ? ' (demo)' : ''}.`);
    const out = document.querySelector('#codes-output');
    if (out) {
      out.innerHTML = renderGeneratedCodes(result.codes);
      wireCodesActions(result.codes);
    }
    await refreshList();
  });
}

function wireCodesActions(codes: GeneratedCode[]): void {
  document.querySelector('#codes-copy')?.addEventListener('click', () => {
    const text = codes.map((c) => `${c.pseudonym}\t${c.code}`).join('\n');
    void navigator.clipboard?.writeText(text);
  });
  document.querySelector('#codes-print')?.addEventListener('click', () => window.print());
}

async function refreshList(): Promise<void> {
  if (!setupClassId) return;
  const body = document.querySelector('#setup-list-body');
  if (!body) return;
  body.innerHTML = StudentCodeList(await listStudentCodes(setupClassId));
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-deactivate]'))) {
    button.addEventListener('click', async () => {
      const id = button.getAttribute('data-deactivate');
      if (!id) return;
      await deactivateStudentCode(id);
      await refreshList();
    });
  }
}
