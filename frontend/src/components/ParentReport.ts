/**
 * "Report pre rodičov" — a warm, parent-facing printable summary of a child's
 * growth in INVOK: the headline competency growth (start → end from the pre/post
 * questionnaire), 1–5 competencies in plain language, earned badges and completed
 * projects. Carries the EU-funding line (the program is grant-funded).
 *
 * Presentation layer over existing data (no new backend). Print → PDF via an
 * isolated @media print block. All student-entered text is escaped.
 */
import { fetchMyProgress } from '../services/submissionApi';
import { listQuests, type StudentQuest } from '../services/questStore';
import { fetchMyQuestionnaires, type QuestionnaireSummary } from '../services/questionnaireApi';
import { computeModuleBadges } from '../services/moduleBadges';
import { competencyName, strengthToLevel, levelLabel } from '../services/competencyScale';
import { QUESTIONNAIRE_AREAS } from '../services/questionnaireContent';
import { euEmblem } from './brand';

export interface ParentReportOptions {
  alias: string;
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function todaySk(): string {
  try {
    return new Date().toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

let overlayEl: HTMLElement | null = null;
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeParentReport();
}
export function closeParentReport(): void {
  if (!overlayEl) return;
  overlayEl.remove();
  overlayEl = null;
  document.removeEventListener('keydown', onKey);
}

interface ReportData {
  progress: { totalXp: number; level: number; competencyProgress: { competencyId: string; mastery: number }[] };
  quests: StudentQuest[];
  questionnaires: QuestionnaireSummary[];
}

function growthSection(questionnaires: QuestionnaireSummary[]): string {
  const input = questionnaires.find((q) => q.phase === 'input');
  const output = questionnaires.find((q) => q.phase === 'output');

  if (input && output) {
    const rows = QUESTIONNAIRE_AREAS.map((a) => {
      const i = input.areaScores?.[a.id];
      const o = output.areaScores?.[a.id];
      const g = i != null && o != null && i > 0 ? Math.round(((o - i) / i) * 100) : null;
      return { title: a.title, i, o, g };
    })
      .filter((r) => r.g != null)
      .sort((x, y) => (y.g ?? 0) - (x.g ?? 0));
    const items = rows
      .map(
        (r) =>
          `<li><span>${esc(r.title)}</span><strong class="${(r.g ?? 0) > 0 ? 'pr-up' : 'pr-flat'}">${(r.g ?? 0) > 0 ? '+' : ''}${r.g} %</strong></li>`,
      )
      .join('');
    return `<section class="pr-section">
      <h3>${'\u{1F331}'} Ako Vaše dieťa narástlo</h3>
      <p class="pr-lead">Porovnanie sebahodnotenia na <strong>začiatku</strong> a po absolvovaní modulov:</p>
      <ul class="pr-growth">${items}</ul>
    </section>`;
  }

  if (input) {
    return `<section class="pr-section">
      <h3>${'\u{1F331}'} Začiatok cesty</h3>
      <p class="pr-lead">Vaše dieťa vyplnilo <strong>štartový dotazník</strong>. Rast (v %) sa zobrazí po absolvovaní modulov a vyplnení záverečného dotazníka.</p>
    </section>`;
  }
  return '';
}

function competenciesSection(progress: ReportData['progress']): string {
  if (progress.competencyProgress.length === 0) return '';
  const rows = [...progress.competencyProgress]
    .sort((a, b) => b.mastery - a.mastery)
    .map((p) => {
      const lvl = strengthToLevel(p.mastery);
      return `<li><span>${esc(competencyName(p.competencyId))}</span><strong>${lvl}/5 <span class="muted" style="font-weight:normal">(${levelLabel(lvl)})</span></strong></li>`;
    })
    .join('');
  return `<section class="pr-section"><h3>${'\u{1F3AF}'} Rozvinuté kompetencie</h3><ul class="pr-list">${rows}</ul></section>`;
}

function badgesSection(progress: ReportData['progress']): string {
  const earned = computeModuleBadges(progress).filter((s) => s.earned);
  if (earned.length === 0) return '';
  const items = earned.map((s) => `<span class="pr-badge">${s.badge.emoji} ${esc(s.badge.name)}</span>`).join('');
  return `<section class="pr-section"><h3>${'\u{1F3C5}'} Získané odznaky</h3><div class="pr-badges">${items}</div></section>`;
}

function projectsSection(quests: StudentQuest[]): string {
  const done = quests.filter((q) => q.state === 'completed' || q.state === 'submitted');
  if (done.length === 0) return '';
  const items = done.map((q) => `<li>${esc(q.title)}</li>`).join('');
  return `<section class="pr-section"><h3>${'\u{1F680}'} Dokončené projekty <span class="muted" style="font-weight:normal">(${done.length})</span></h3><ul class="pr-projects">${items}</ul></section>`;
}

function renderReport(alias: string, data: ReportData): string {
  const head = `<header class="pr-head">
    <div class="pr-head__brand"><span class="pr-head__mark">IN</span> INVOK</div>
    <h1>Report pre rodičov</h1>
    <p class="pr-head__who">Žiak: <strong>${esc(alias)}</strong> · ${todaySk()}</p>
  </header>
  <p class="pr-intro">Milí rodičia, ďakujeme, že Vaše dieťa je súčasťou programu <strong>INVOK</strong>. Tento report stručne ukazuje, ako sa počas programu rozvíjalo — v kritickom myslení, podnikavosti, tímovej spolupráci, komunikácii a digitálnych zručnostiach.</p>`;

  const footer = `<footer class="pr-foot">
    <span class="pr-foot__flag">${euEmblem(28)}</span>
    <span>Program INVOK je realizovaný vďaka podpore Európskej únie prostredníctvom programu Program Slovensko a Ministerstva práce, sociálnych vecí a rodiny SR. Súkromie žiaka je chránené — pracujeme len s pseudonymom.</span>
  </footer>`;

  return (
    head +
    growthSection(data.questionnaires) +
    competenciesSection(data.progress) +
    badgesSection(data.progress) +
    projectsSection(data.quests) +
    footer
  );
}

export async function openParentReport(opts: ParentReportOptions): Promise<void> {
  if (typeof document === 'undefined') return;
  closeParentReport();
  const alias = (opts.alias || '').trim() || 'žiak';

  const overlay = document.createElement('div');
  overlay.className = 'invok-parent-overlay invok-printable';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Report pre rodičov');

  const printBtn = document.createElement('button');
  printBtn.type = 'button';
  printBtn.className = 'btn btn--primary';
  printBtn.textContent = '🖨️ Tlačiť / Uložiť PDF';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn--ghost';
  closeBtn.textContent = 'Zavrieť';
  const bar = document.createElement('div');
  bar.className = 'invok-parent-overlay__bar';
  bar.append(printBtn, closeBtn);

  const content = document.createElement('div');
  content.className = 'invok-parent';
  content.appendChild(document.createTextNode('Načítavam report…'));

  overlay.append(bar, content);
  document.body.appendChild(overlay);
  overlayEl = overlay;
  document.addEventListener('keydown', onKey);
  printBtn.addEventListener('click', () => window.print());
  closeBtn.addEventListener('click', () => closeParentReport());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeParentReport();
  });

  const [progress, quests, questionnaires] = await Promise.all([
    fetchMyProgress(),
    listQuests(),
    fetchMyQuestionnaires(),
  ]);
  if (!overlayEl) return;
  content.innerHTML = renderReport(alias, { progress, quests, questionnaires });
}
