/**
 * "Moje INVOK portfólio" — a consolidated, printable showcase of a student's
 * whole journey: projects (quests) + their documentation, earned badges, 1–5
 * competencies and the questionnaire growth (start → end).
 *
 * Purely a presentation layer over data we already have (no new backend). Opens
 * as a scrollable overlay with a print → PDF option. All student-entered text
 * (quest titles/goals, file names) is escaped before it reaches innerHTML.
 */
import { fetchMyProgress } from '../services/submissionApi';
import { listQuests, type StudentQuest } from '../services/questStore';
import { fetchMyQuestionnaires, type QuestionnaireSummary } from '../services/questionnaireApi';
import { listMyQuestFiles, type TeacherFile } from '../services/uploadApi';
import { computeModuleBadges } from '../services/moduleBadges';
import { competencyName, strengthToLevel, levelLabel } from '../services/competencyScale';
import { QUESTIONNAIRE_AREAS } from '../services/questionnaireContent';

export interface PortfolioOptions {
  alias: string;
}

const PROJECT_STATES: Record<string, { label: string; cls: string }> = {
  pending_approval: { label: 'čaká na učiteľa', cls: 'chip--warm' },
  changes_requested: { label: 'na úpravu', cls: 'chip--warm' },
  approved: { label: 'schválené', cls: 'chip--accent' },
  submitted: { label: 'odovzdané', cls: 'chip--accent' },
  completed: { label: 'dokončené \u{1F3C6}', cls: 'chip--muted' },
};

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
  if (e.key === 'Escape') closePortfolio();
}
export function closePortfolio(): void {
  if (!overlayEl) return;
  overlayEl.remove();
  overlayEl = null;
  document.removeEventListener('keydown', onKey);
}

interface PortfolioData {
  progress: { totalXp: number; level: number; competencyProgress: { competencyId: string; mastery: number }[] };
  quests: StudentQuest[];
  questionnaires: QuestionnaireSummary[];
  filesByQuest: Record<string, TeacherFile[]>;
}

function badgesHtml(progress: PortfolioData['progress']): string {
  const states = computeModuleBadges(progress);
  const cards = states
    .map((s) => {
      const locked = !s.earned;
      return `<div class="pf-badge${locked ? ' pf-badge--locked' : ''}">
        <span class="pf-badge__icon">${locked ? '\u{1F512}' : s.badge.emoji}</span>
        <strong>${esc(s.badge.name)}</strong>
        <span class="muted">${locked ? `${s.level}/5` : 'získaný ✓'}</span>
      </div>`;
    })
    .join('');
  return `<section class="pf-section"><h3>${'\u{1F3C5}'} Odznaky</h3><div class="pf-badges">${cards}</div></section>`;
}

function competenciesHtml(progress: PortfolioData['progress']): string {
  if (progress.competencyProgress.length === 0) return '';
  const rows = [...progress.competencyProgress]
    .sort((a, b) => b.mastery - a.mastery)
    .map((p) => {
      const lvl = strengthToLevel(p.mastery);
      return `<li><span>${esc(competencyName(p.competencyId))}</span><strong>${lvl}/5 <span class="muted" style="font-weight:normal">(${levelLabel(lvl)})</span></strong></li>`;
    })
    .join('');
  return `<section class="pf-section"><h3>${'\u{1F3AF}'} Kompetencie (1–5)</h3><ul class="pf-list">${rows}</ul></section>`;
}

function growthHtml(questionnaires: QuestionnaireSummary[]): string {
  const input = questionnaires.find((q) => q.phase === 'input');
  const output = questionnaires.find((q) => q.phase === 'output');
  if (!input && !output) return '';
  const rows = QUESTIONNAIRE_AREAS.map((a) => {
    const i = input?.areaScores?.[a.id];
    const o = output?.areaScores?.[a.id];
    const g = i != null && o != null && i > 0 ? Math.round(((o - i) / i) * 100) : null;
    const chip = g == null ? '' : ` <span class="chip ${g > 0 ? 'chip--accent' : 'chip--muted'}">${g > 0 ? '+' : ''}${g} %</span>`;
    return `<li><span>${esc(a.title)}</span><strong>${i ?? '—'} → ${o ?? '—'} <span class="muted" style="font-weight:normal">/40</span>${chip}</strong></li>`;
  }).join('');
  return `<section class="pf-section"><h3>${'\u{1F4C8}'} Môj rast (štart → koniec)</h3><ul class="pf-list">${rows}</ul></section>`;
}

function projectsHtml(quests: StudentQuest[], filesByQuest: Record<string, TeacherFile[]>): string {
  const projects = quests.filter((q) => q.state !== 'draft' && q.state !== 'rejected');
  if (projects.length === 0) {
    return `<section class="pf-section"><h3>${'\u{1F680}'} Moje projekty</h3><p class="muted">Zatiaľ žiadne projekty — začni misiou.</p></section>`;
  }
  const cards = projects
    .map((q) => {
      const badge = PROJECT_STATES[q.state] ?? { label: q.state, cls: 'chip--muted' };
      const files = filesByQuest[q.id] ?? [];
      const fileLinks = files.length
        ? `<div class="pf-files">${files
            .map((f) => `<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${'\u{1F4CE}'} ${esc(f.name)}</a>`)
            .join('')}</div>`
        : '';
      const affected = q.affectedGroup ? `<p class="pf-meta"><strong>Koho sa týka:</strong> ${esc(q.affectedGroup)}</p>` : '';
      return `<article class="pf-card">
        <div class="pf-card__head"><strong>${esc(q.title)}</strong><span class="chip ${badge.cls}">${badge.label}</span></div>
        <p class="pf-meta"><strong>Cieľ:</strong> ${esc(q.goal ?? '')}</p>
        ${affected}
        ${fileLinks}
      </article>`;
    })
    .join('');
  return `<section class="pf-section"><h3>${'\u{1F680}'} Moje projekty <span class="muted" style="font-weight:normal">(${projects.length})</span></h3><div class="pf-cards">${cards}</div></section>`;
}

function renderPortfolio(alias: string, data: PortfolioData): string {
  const head = `<header class="pf-head">
    <div class="pf-head__brand"><span class="pf-head__mark">IN</span> INVOK</div>
    <h1>Moje INVOK portfólio</h1>
    <div class="pf-head__who"><strong>${esc(alias)}</strong> · ${data.progress.totalXp} XP · úroveň ${data.progress.level} · ${todaySk()}</div>
  </header>`;
  return (
    head +
    badgesHtml(data.progress) +
    competenciesHtml(data.progress) +
    growthHtml(data.questionnaires) +
    projectsHtml(data.quests, data.filesByQuest)
  );
}

export async function openPortfolio(opts: PortfolioOptions): Promise<void> {
  if (typeof document === 'undefined') return;
  closePortfolio();
  const alias = (opts.alias || '').trim() || 'žiak';

  const overlay = document.createElement('div');
  overlay.className = 'invok-portfolio-overlay invok-printable';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Moje INVOK portfólio');

  const printBtn = document.createElement('button');
  printBtn.type = 'button';
  printBtn.className = 'btn btn--primary';
  printBtn.textContent = '🖨️ Tlačiť / Uložiť PDF';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn--ghost';
  closeBtn.textContent = 'Zavrieť';
  const bar = document.createElement('div');
  bar.className = 'invok-portfolio-overlay__bar';
  bar.append(printBtn, closeBtn);

  const content = document.createElement('div');
  content.className = 'invok-portfolio';
  content.appendChild(document.createTextNode('Načítavam portfólio…'));

  overlay.append(bar, content);
  document.body.appendChild(overlay);
  overlayEl = overlay;
  document.addEventListener('keydown', onKey);
  printBtn.addEventListener('click', () => window.print());
  closeBtn.addEventListener('click', () => closePortfolio());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePortfolio();
  });

  const [progress, quests, questionnaires] = await Promise.all([
    fetchMyProgress(),
    listQuests(),
    fetchMyQuestionnaires(),
  ]);
  const projectQuests = quests.filter((q) => q.state !== 'draft' && q.state !== 'rejected');
  const filesByQuest: Record<string, TeacherFile[]> = {};
  await Promise.all(
    projectQuests.map(async (q) => {
      filesByQuest[q.id] = await listMyQuestFiles(q.id);
    }),
  );

  if (!overlayEl) return; // closed while loading
  content.innerHTML = renderPortfolio(alias, { progress, quests, questionnaires, filesByQuest });
}
