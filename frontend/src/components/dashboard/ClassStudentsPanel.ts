/**
 * Per-student overview for the teacher dashboard. A row per pseudonymous student
 * (XP, level, questionnaire input→output, completed lessons, project challenges);
 * expand to see their 1–5 competency levels. Pseudonymous — only the alias.
 */
import { fetchClassStudents, type ClassStudent } from '../../services/teacherStatsApi';
import { competencyName, strengthToLevel, levelLabel } from '../../services/competencyScale';

export function ClassStudentsPanel(): string {
  return `<section style="margin-top:var(--space-5)">
    <div class="section-title"><h3 style="margin:0">${'\u{1F9D1}\u{200D}\u{1F393}'} Žiaci v triede</h3></div>
    <div id="dashboard-students"><p class="muted">Načítavam…</p></div>
  </section>`;
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function competencyRows(s: ClassStudent): string {
  if (s.competencies.length === 0) {
    return '<p class="muted" style="margin:8px 0 0;font-size:var(--fs-xs)">Zatiaľ žiadne namerané kompetencie.</p>';
  }
  const rows = [...s.competencies]
    .sort((a, b) => b.mastery - a.mastery)
    .map((c) => {
      const lvl = strengthToLevel(c.mastery);
      return `<li style="display:flex;justify-content:space-between;gap:var(--space-3);padding:3px 0">
        <span>${esc(competencyName(c.competencyId))}</span>
        <strong>${lvl}/5 <span class="muted" style="font-weight:normal">(${levelLabel(lvl)})</span></strong>
      </li>`;
    })
    .join('');
  return `<ul style="list-style:none;margin:8px 0 0;padding:0;font-size:var(--fs-sm)">${rows}</ul>`;
}

function studentRow(s: ClassStudent): string {
  const q = s.questionnaireInput != null || s.questionnaireOutput != null
    ? `${s.questionnaireInput ?? '—'} → ${s.questionnaireOutput ?? '—'}`
    : '—';
  const meta = `${s.totalXp} XP · úr. ${s.level} · ${'\u{1F3AC}'} ${s.academyDone} · ${'\u{1F680}'} ${s.questsCompleted}/${s.questsTotal} · ${'\u{1F4CB}'} ${q}`;
  return `<details class="card" style="padding:var(--space-3)">
    <summary style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap;list-style:none">
      <strong>${esc(s.pseudonym)}</strong>
      <span class="muted" style="font-size:var(--fs-xs)">${meta}</span>
    </summary>
    ${competencyRows(s)}
  </details>`;
}

function render(students: ClassStudent[]): string {
  if (students.length === 0) {
    return '<p class="muted">Zatiaľ žiadni žiaci. Vytvor triedu a kódy v <a href="#/pilot">pilot setupe</a>.</p>';
  }
  const legend = `<p class="muted" style="font-size:var(--fs-xs);margin:0 0 var(--space-3)">${'\u{1F3AC}'} lekcie · ${'\u{1F680}'} projektové výzvy (hotové/spolu) · ${'\u{1F4CB}'} dotazník (vstup → výstup)</p>`;
  return `${legend}<div class="stack" style="gap:8px">${students.map(studentRow).join('')}</div>`;
}

export async function mountClassStudentsPanel(classId?: string): Promise<void> {
  const slot = document.querySelector<HTMLElement>('#dashboard-students');
  if (!slot) return;
  const students = await fetchClassStudents(classId);
  slot.innerHTML = render(students);
}
