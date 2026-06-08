/**
 * Teacher panel — list & decide on student-proposed quests.
 *
 * Lifecycle (mirrors backend studentQuestService):
 *   pending_approval  → approve | request_changes | reject
 *   changes_requested → approve | reject              (the student already edited)
 *   approved          → (no actions here — appears as info)
 *
 * The teacher can:
 *   - leave feedback (visible to the student),
 *   - override the deadline,
 *   - tune the XP estimate (only when approving).
 */

import {
  listPendingQuests,
  reviewQuestRequest,
  type ApprovalDecision,
  type TeacherQuestRow,
} from '../../services/teacherQuestApi';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

const STATE_LABEL: Record<TeacherQuestRow['state'], { label: string; chip: string }> = {
  draft:              { label: 'koncept', chip: 'chip--muted' },
  pending_approval:   { label: 'čaká na teba', chip: 'chip--warm' },
  changes_requested:  { label: 'po úprave žiakom', chip: 'chip--warm' },
  approved:           { label: 'schválené', chip: 'chip--accent' },
  submitted:          { label: 'odovzdané', chip: 'chip--accent' },
  completed:          { label: 'hotové', chip: 'chip--muted' },
  rejected:           { label: 'zamietnuté', chip: 'chip--muted' },
};

function questCard(q: TeacherQuestRow): string {
  const badge = STATE_LABEL[q.state] ?? STATE_LABEL.pending_approval;
  const isActionable = q.state === 'pending_approval' || q.state === 'changes_requested';
  const xpDefault = q.xpEstimate || 100;
  const deadlineDefault = q.approvedDeadline || q.proposedDeadline || '';

  return `
  <article class="card" data-quest-id="${escapeHtml(q.id)}" style="border-left:4px solid var(--color-accent)">
    <div class="card-title">
      <div>
        <div class="muted" style="font-size:var(--fs-xs)">
          ${q.source === 'ai' ? '🤖 AI návrh' : '✨ Návrh žiaka'} ·
          žiak: <strong>${escapeHtml(q.studentAlias ?? '—')}</strong> ·
          vytvorené ${formatDate(q.createdAt)}
        </div>
        <h3 style="margin:4px 0 0">${escapeHtml(q.title)}</h3>
      </div>
      <span class="chip ${badge.chip}">${badge.label}</span>
    </div>

    <div class="mission__goal" style="margin-top:var(--space-3)"><strong>Cieľ:</strong> ${escapeHtml(q.goal)}</div>
    ${q.affectedGroup ? `<p class="muted" style="margin:8px 0 0;font-size:var(--fs-sm)"><strong>Koho sa týka:</strong> ${escapeHtml(q.affectedGroup)}</p>` : ''}
    ${q.evidence ? `<p class="muted" style="margin:6px 0 0;font-size:var(--fs-sm)"><strong>Dôkaz:</strong> ${escapeHtml(q.evidence)}</p>` : ''}
    ${q.firstIdea ? `<p class="muted" style="margin:6px 0 0;font-size:var(--fs-sm)"><strong>Prvý nápad:</strong> ${escapeHtml(q.firstIdea)}</p>` : ''}
    ${q.aiModel ? `<p class="muted" style="margin:6px 0 0;font-size:var(--fs-xs)">model: ${escapeHtml(q.aiModel)}</p>` : ''}

    <div style="display:flex;flex-wrap:wrap;gap:var(--space-3);align-items:center;margin-top:var(--space-3)">
      <span class="muted" style="font-size:var(--fs-xs)">
        <strong>Žiakom navrhnutý termín:</strong> ${formatDate(q.proposedDeadline)}
        ${q.approvedDeadline ? ` · <strong>schválený:</strong> ${formatDate(q.approvedDeadline)}` : ''}
      </span>
    </div>

    ${isActionable ? `
    <form class="stack" data-quest-form="${escapeHtml(q.id)}" style="margin-top:var(--space-4);background:var(--tint-muted, #f8fafc);padding:var(--space-3);border-radius:var(--radius-md)">
      <label class="field">Spätná väzba pre žiaka
        <textarea data-field="teacherFeedback" rows="2" maxlength="1000" placeholder="napr. Skvelý nápad, prosím spresni, ako budeš merať výsledok."></textarea>
      </label>
      <div class="grid grid--2" style="gap:var(--space-3)">
        <label class="field">Schválený termín
          <input data-field="approvedDeadline" type="date" value="${escapeHtml(deadlineDefault)}">
        </label>
        <label class="field">XP odhad (pri schválení)
          <input data-field="xpEstimate" type="number" min="30" max="250" value="${xpDefault}">
        </label>
      </div>
      <p class="muted" data-quest-msg="${escapeHtml(q.id)}" role="status" aria-live="polite" style="margin:0"></p>
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">
        <button type="button" class="btn btn--primary" data-quest-action="approve" data-quest-id="${escapeHtml(q.id)}">Schváliť</button>
        <button type="button" class="btn btn--ghost" data-quest-action="request_changes" data-quest-id="${escapeHtml(q.id)}">Požiadať o úpravu</button>
        <button type="button" class="btn btn--ghost" data-quest-action="reject" data-quest-id="${escapeHtml(q.id)}" style="color:var(--color-danger)">Zamietnuť</button>
      </div>
    </form>` : `
    ${q.teacherFeedback ? `<div class="teacher-hint" style="margin-top:var(--space-3)">
      <div class="teacher-hint__label">Tvoja predošlá spätná väzba</div>
      ${escapeHtml(q.teacherFeedback)}
    </div>` : ''}
    `}
  </article>`;
}

interface PanelState {
  loading: boolean;
  rows: TeacherQuestRow[];
  error?: string;
}

function panelMarkup(state: PanelState): string {
  if (state.loading) {
    return '<p class="muted">Načítavam misie čakajúce na tvoje schválenie…</p>';
  }
  if (state.error) {
    return `<p class="muted" style="color:var(--color-danger)">${escapeHtml(state.error)}</p>`;
  }
  if (state.rows.length === 0) {
    return `<p class="muted">Žiadne misie nečakajú na tvoje schválenie. 🎉
      Žiaci si môžu novú misiu navrhnúť na stránke <strong>Moje misie</strong>.</p>`;
  }
  return `<div class="stack" style="gap:var(--space-4)">${state.rows.map(questCard).join('')}</div>`;
}

let containerRef: HTMLElement | null = null;
let stateRef: PanelState = { loading: true, rows: [] };

function setState(next: Partial<PanelState>): void {
  stateRef = { ...stateRef, ...next };
  if (containerRef) containerRef.innerHTML = panelMarkup(stateRef);
  bindForms();
}

async function refresh(): Promise<void> {
  setState({ loading: true, error: undefined });
  try {
    const rows = await listPendingQuests();
    setState({ loading: false, rows });
  } catch (err) {
    setState({ loading: false, rows: [], error: err instanceof Error ? err.message : 'Načítanie zlyhalo.' });
  }
}

function readField(form: HTMLFormElement, name: string): string {
  const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-field="${name}"]`);
  return el?.value.trim() ?? '';
}

function setBusy(form: HTMLFormElement, busy: boolean): void {
  for (const b of Array.from(form.querySelectorAll<HTMLButtonElement>('button[data-quest-action]'))) {
    b.disabled = busy;
  }
}

function bindForms(): void {
  if (!containerRef) return;
  for (const btn of Array.from(containerRef.querySelectorAll<HTMLButtonElement>('button[data-quest-action]'))) {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-quest-id');
      const decision = btn.getAttribute('data-quest-action') as ApprovalDecision | null;
      if (!id || !decision) return;
      const form = containerRef!.querySelector<HTMLFormElement>(`form[data-quest-form="${id}"]`);
      if (!form) return;
      const msg = containerRef!.querySelector<HTMLElement>(`[data-quest-msg="${id}"]`);
      if (msg) msg.textContent = '';

      const teacherFeedback = readField(form, 'teacherFeedback');
      const approvedDeadline = readField(form, 'approvedDeadline');
      const xpRaw = readField(form, 'xpEstimate');
      const xpEstimate = xpRaw ? Number(xpRaw) : undefined;

      // Friendly client-side requirement: when rejecting or requesting changes,
      // ask for a short feedback so the student knows what to fix.
      if (decision !== 'approve' && teacherFeedback.length < 5) {
        if (msg) msg.textContent = 'Napíš krátku spätnú väzbu (min. 5 znakov), nech žiak vie, čo zmeniť.';
        return;
      }

      setBusy(form, true);
      const result = await reviewQuestRequest({
        questId: id,
        decision,
        teacherFeedback: teacherFeedback || undefined,
        approvedDeadline: decision === 'approve' && approvedDeadline ? approvedDeadline : undefined,
        xpEstimate: decision === 'approve' && xpEstimate != null && !Number.isNaN(xpEstimate) ? xpEstimate : undefined,
      });
      setBusy(form, false);

      if (!result.ok) {
        if (msg) msg.textContent = result.error ?? 'Schválenie zlyhalo.';
        return;
      }
      // Reload so the panel reflects the new state without stale UI.
      await refresh();
    });
  }
}

export function PendingQuestApprovalsPanel(): string {
  return `
  <section class="card" id="pending-quest-approvals" style="margin-top:var(--space-5)">
    <div class="card-title">
      <div>
        <div class="muted">Schvaľovanie misií</div>
        <h2 style="margin:0">Návrhy žiakov</h2>
      </div>
      <button type="button" id="pending-quest-refresh" class="btn btn--ghost btn--sm">Obnoviť</button>
    </div>
    <p class="muted" style="margin-top:var(--space-2)">
      Žiaci si navrhujú misie sami alebo cez AI. Tu ich potvrdzuješ predtým, než ich začnú riešiť.
      AI návrhy sa generujú v súlade s INVOK kompetenciami a ŠVP ZV — vždy si pred schválením preverí cieľ a dôkaz.
    </p>
    <div id="pending-quest-slot" style="margin-top:var(--space-3)">${panelMarkup({ loading: true, rows: [] })}</div>
  </section>`;
}

export function mountPendingQuestApprovalsPanel(): void {
  containerRef = document.querySelector<HTMLElement>('#pending-quest-slot');
  if (!containerRef) return;
  stateRef = { loading: true, rows: [] };
  void refresh();
  const refreshBtn = document.querySelector<HTMLButtonElement>('#pending-quest-refresh');
  refreshBtn?.addEventListener('click', () => {
    void refresh();
  });
}
