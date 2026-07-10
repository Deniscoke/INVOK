/**
 * Galéria školských projektov — teacher curation panel.
 * Lists COMPLETED projects of the teacher's class(es); one click publishes a
 * project into the shared gallery "Ako žiaci menia svoje školy" (or removes it).
 */
import { fetchCurationList, setProjectPublished, type CurationProject } from '../../services/galleryApi';
import { moduleLabel } from '../../services/academyContent';

export function GalleryPanel(): string {
  return `<section style="margin-top:var(--space-5)">
    <div class="section-title"><h3 style="margin:0">${'\u{1F3A8}'} Galéria projektov <span class="muted" style="font-weight:normal;font-size:var(--fs-sm)">„Ako žiaci menia svoje školy"</span></h3></div>
    <div id="dashboard-gallery"><p class="muted">Načítavam…</p></div>
  </section>`;
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function row(p: CurationProject): string {
  const btn = p.published
    ? `<button type="button" class="btn btn--ghost btn--sm" data-gallery-toggle="${esc(p.questId)}" data-published="1">Odobrať z galérie</button>`
    : `<button type="button" class="btn btn--primary btn--sm" data-gallery-toggle="${esc(p.questId)}" data-published="0">${'\u{2B50}'} Zaradiť do galérie</button>`;
  const badge = p.published ? '<span class="chip chip--accent">v galérii ✓</span>' : '<span class="chip chip--muted">nezaradené</span>';
  return `<div class="card" style="padding:var(--space-3);display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap">
    <div style="min-width:0">
      <strong>${esc(p.title)}</strong> ${moduleLabel(p.moduleId) ? `<span class="chip chip--muted">${moduleLabel(p.moduleId)}</span> ` : ''}${badge}
      <div class="muted" style="font-size:var(--fs-xs);margin-top:2px">${esc(p.pseudonym)} · ${esc(p.className)}${p.grade != null ? ` (${p.grade}. roč.)` : ''}</div>
    </div>
    ${btn}
  </div>`;
}

export async function mountGalleryPanel(classId?: string): Promise<void> {
  const slot = document.querySelector<HTMLElement>('#dashboard-gallery');
  if (!slot) return;
  const projects = await fetchCurationList(classId);
  if (projects.length === 0) {
    slot.innerHTML = '<p class="muted">Zatiaľ žiadne dokončené projekty. Do galérie možno zaradiť projekt po jeho dokončení a schválení.</p>';
    return;
  }
  const published = projects.filter((p) => p.published).length;
  slot.innerHTML = `
    <p class="muted" style="font-size:var(--fs-xs);margin:0 0 var(--space-3)">Zaradené projekty vidia žiaci ako inšpiráciu (pseudonymne, len text — bez súborov). V galérii: <strong>${published}</strong> z ${projects.length} dokončených.</p>
    <div class="stack" style="gap:8px">${projects.map(row).join('')}</div>`;
  for (const btn of Array.from(slot.querySelectorAll<HTMLButtonElement>('[data-gallery-toggle]'))) {
    btn.addEventListener('click', async () => {
      const questId = btn.getAttribute('data-gallery-toggle') ?? '';
      const publish = btn.getAttribute('data-published') !== '1';
      btn.disabled = true;
      const result = await setProjectPublished(questId, publish);
      if (!result.ok) {
        btn.disabled = false;
        btn.textContent = result.error ?? 'Chyba';
        return;
      }
      void mountGalleryPanel(classId);
    });
  }
}
