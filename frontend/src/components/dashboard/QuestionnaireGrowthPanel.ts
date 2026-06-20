/**
 * Class-level pre/post growth panel for the teacher/director dashboard.
 * Shows engagement (joined students, input/output completion) and, per area,
 * the average START → END score with a growth %. The headline grant metric
 * ("priemerné skóre v kritickom myslení vzrástlo z 24 na 31").
 */
import { fetchQuestionnaireStats, type ClassQuestionnaireStats } from '../../services/teacherStatsApi';
import { QUESTIONNAIRE_AREAS } from '../../services/questionnaireContent';

export function QuestionnaireGrowthPanel(): string {
  return `<section style="margin-top:var(--space-5)">
    <div class="section-title"><h3 style="margin:0">${'\u{1F4C8}'} Rast kompetencií (dotazník)</h3></div>
    <div id="dashboard-growth"><p class="muted">Načítavam…</p></div>
  </section>`;
}

function growthChip(g: number | null): string {
  if (g == null) return '<span class="chip chip--muted">—</span>';
  if (g > 0) return `<span class="chip" style="background:var(--tint-success);color:#15803d">+${g} %</span>`;
  if (g < 0) return `<span class="chip" style="background:var(--tint-danger);color:#b91c1c">${g} %</span>`;
  return '<span class="chip chip--muted">0 %</span>';
}

function renderStats(stats: ClassQuestionnaireStats): string {
  const engaged = stats.totalStudents ?? 0;
  const inN = stats.inputCount ?? 0;
  const outN = stats.outputCount ?? 0;

  const kpis = `<div class="stat-row" style="margin-bottom:var(--space-4)">
    <div class="stat"><div class="stat__value">${engaged}</div><div class="stat__label">Zapojení žiaci</div></div>
    <div class="stat"><div class="stat__value">${inN}</div><div class="stat__label">Štartový dotazník</div></div>
    <div class="stat"><div class="stat__value">${outN}</div><div class="stat__label">Záverečný dotazník</div></div>
    <div class="stat"><div class="stat__value">${stats.avgInputTotal ?? '—'}${stats.avgOutputTotal != null ? ` → ${stats.avgOutputTotal}` : ''}</div><div class="stat__label">Priemer spolu /240</div></div>
  </div>`;

  const rows = QUESTIONNAIRE_AREAS.map((area) => {
    const s = stats.areas?.find((a) => a.id === area.id);
    const inp = s?.avgInput;
    const out = s?.avgOutput;
    const inpTxt = inp == null ? '—' : String(inp);
    const outTxt = out == null ? '—' : String(out);
    return `<div style="display:flex;align-items:center;gap:var(--space-3);padding:8px 0;border-bottom:1px solid var(--color-border)">
      <span style="flex:1;min-width:0">${area.id} · ${area.title}</span>
      <span class="muted" style="font-variant-numeric:tabular-nums">${inpTxt} → <strong style="color:var(--color-text)">${outTxt}</strong> <span style="font-size:var(--fs-xs)">/40</span></span>
      ${growthChip(s?.growthPct ?? null)}
    </div>`;
  }).join('');

  const note = outN === 0
    ? '<p class="muted" style="font-size:var(--fs-xs);margin:var(--space-3) 0 0">Výstupné hodnoty a rast (%) sa doplnia, keď žiaci po absolvovaní modulov vyplnia záverečný dotazník.</p>'
    : '';

  return `<div class="card">${kpis}<div>${rows}</div>${note}</div>`;
}

export async function mountQuestionnaireGrowthPanel(classId?: string): Promise<void> {
  const slot = document.querySelector<HTMLElement>('#dashboard-growth');
  if (!slot) return;
  const stats = await fetchQuestionnaireStats(classId);
  if (!stats || !stats.ok) {
    slot.innerHTML = '<p class="muted">Štatistiky dotazníka sa nepodarilo načítať.</p>';
    return;
  }
  slot.innerHTML = renderStats(stats);
}
