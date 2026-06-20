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
  fetchSubmissionReview,
  type ApprovalDecision,
  type TeacherQuestRow,
  type SubmissionEvaluation,
  type ExistingSubmissionReview,
} from '../../services/teacherQuestApi';
import { listQuestFilesForTeacher } from '../../services/uploadApi';
import { submitReview, type ReviewDecision } from '../../services/teacherReviewApi';
import { competencyName, scoreToLevel, strengthToLevel, levelLabel } from '../../services/competencyScale';

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

    ${q.state === 'pending_approval' || q.state === 'rejected' || q.state === 'draft' ? '' : `
    <div style="margin-top:var(--space-3)">
      <button type="button" class="btn btn--ghost btn--sm" data-files-btn="${escapeHtml(q.id)}">📎 Dokumentácia žiaka</button>
      <div data-files-slot="${escapeHtml(q.id)}" style="margin-top:var(--space-2)"></div>
    </div>`}

    ${q.state === 'submitted' && q.submissionId ? `
    <div style="margin-top:var(--space-3)">
      <button type="button" class="btn btn--primary btn--sm" data-review-btn="${escapeHtml(q.id)}" data-submission="${escapeHtml(q.submissionId)}">📊 Hodnotenie AI + potvrdiť výsledok</button>
      <div data-review-slot="${escapeHtml(q.id)}" style="margin-top:var(--space-3)"></div>
    </div>` : ''}

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

/** AI's evaluation of the SUBMITTED solution, on the shared 1–5 competency scale. */
function renderSubmissionEval(ev: SubmissionEvaluation): string {
  const overall = scoreToLevel(ev.score);
  const comps = (ev.detectedCompetencies ?? [])
    .map((d) => {
      const lvl = strengthToLevel(d.strength);
      return `<li style="margin:2px 0"><strong>${escapeHtml(competencyName(d.id))}</strong>: ${lvl}/5 <span class="muted">(${levelLabel(lvl)})</span></li>`;
    })
    .join('');
  const reasons = (ev.reasons ?? [])
    .slice(0, 6)
    .map((r) => {
      const chip = r.result === 'met' ? 'chip--accent' : r.result === 'partial' ? 'chip--warm' : 'chip--muted';
      return `<li style="margin:3px 0"><strong>${escapeHtml(r.criterion)}</strong>: ${escapeHtml(r.explanation)} <span class="chip ${chip}">${escapeHtml(r.result)}</span></li>`;
    })
    .join('');
  return `
  <div class="card" style="border-left:4px solid ${ev.valid ? 'var(--color-success)' : '#f59e0b'}">
    <div class="muted" style="font-size:var(--fs-xs)">🤖 Hodnotenie AI (${escapeHtml(ev.model)}) — je to len NÁVRH, ty ho potvrdíš alebo upravíš</div>
    <h4 style="margin:4px 0 0">Celkovo: ${overall}/5 <span class="muted">(${levelLabel(overall)})</span> · interné skóre ${ev.score}/100</h4>
    ${comps ? `<p style="margin:10px 0 4px"><strong>V čom sa žiak preukázal (kompetencie):</strong></p><ul style="margin:0;padding-left:18px">${comps}</ul>` : ''}
    ${reasons ? `<p style="margin:10px 0 4px"><strong>Prečo si to AI myslí:</strong></p><ul style="margin:0;padding-left:18px">${reasons}</ul>` : ''}
  </div>`;
}

function renderReviewForm(questId: string, submissionId: string, ev: SubmissionEvaluation): string {
  return `
  <form class="card stack" data-review-form="${escapeHtml(questId)}" data-submission="${escapeHtml(submissionId)}" style="margin-top:var(--space-3);border-left:4px solid var(--color-accent)">
    <h4 style="margin:0">Tvoje finálne hodnotenie</h4>
    <label class="field">Rozhodnutie
      <select data-rfield="decision">
        <option value="approved">Potvrdiť výsledok (schváliť)</option>
        <option value="adjusted">Upraviť skóre</option>
        <option value="needs_revision">Vrátiť na dopracovanie</option>
        <option value="rejected">Zamietnuť</option>
      </select>
    </label>
    <label class="field">Finálne skóre (0–100) — zodpovedá úrovni 1–5
      <input data-rfield="finalScore" type="number" min="0" max="100" value="${ev.score}">
    </label>
    <label class="field" style="flex-direction:row;align-items:center;gap:8px">
      <input data-rfield="finalValid" type="checkbox" ${ev.valid ? 'checked' : ''}> Platné odovzdanie
    </label>
    <label class="field">Spätná väzba pre žiaka
      <textarea data-rfield="feedbackText" rows="2" maxlength="1500" placeholder="Povzbudivá a konkrétna — v čom je dobrý, čo zlepšiť…"></textarea>
    </label>
    <p class="muted" data-review-msg="${escapeHtml(questId)}" role="status" aria-live="polite" style="margin:0"></p>
    <button class="btn btn--primary" type="submit">Uložiť finálne hodnotenie a prideliť XP</button>
  </form>`;
}

function renderExistingReview(review: ExistingSubmissionReview): string {
  const level = scoreToLevel(review.finalScore);
  return `
  <div class="teacher-hint" style="margin-top:var(--space-3);border-left-color:var(--color-success)">
    <div class="teacher-hint__label" style="color:#15803d">Tvoje finálne hodnotenie ✓</div>
    Rozhodnutie: <strong>${escapeHtml(review.decision)}</strong> · skóre ${review.finalScore}/100 (úroveň ${level}/5 — ${levelLabel(level)})
    ${review.feedbackText ? `<div style="margin-top:6px">${escapeHtml(review.feedbackText)}</div>` : ''}
  </div>`;
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

function bindReviewForm(questId: string): void {
  const form = containerRef?.querySelector<HTMLFormElement>(`form[data-review-form="${questId}"]`);
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submissionId = form.getAttribute('data-submission') ?? '';
    const decision = (form.querySelector('[data-rfield="decision"]') as HTMLSelectElement).value as ReviewDecision;
    const finalScore = Number((form.querySelector('[data-rfield="finalScore"]') as HTMLInputElement).value);
    const finalValid = (form.querySelector('[data-rfield="finalValid"]') as HTMLInputElement).checked;
    const feedbackText = (form.querySelector('[data-rfield="feedbackText"]') as HTMLTextAreaElement).value.trim();
    const msg = containerRef?.querySelector<HTMLElement>(`[data-review-msg="${questId}"]`);

    if ((decision === 'needs_revision' || decision === 'rejected') && feedbackText.length < 5) {
      if (msg) msg.textContent = 'Pri vrátení alebo zamietnutí napíš krátku spätnú väzbu.';
      return;
    }
    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    const result = await submitReview({
      submissionId,
      decision,
      finalValid,
      finalScore,
      feedbackText: feedbackText || undefined,
      adjustmentReason: decision === 'adjusted' ? (feedbackText || 'Upravené učiteľom') : undefined,
    });
    if (submitBtn) submitBtn.disabled = false;
    if (!result.ok) {
      if (msg) msg.textContent = result.error ?? 'Hodnotenie zlyhalo.';
      return;
    }
    await refresh();
  });
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

  // Lazy-load a quest's uploaded documentation with fresh signed download links.
  for (const fbtn of Array.from(containerRef.querySelectorAll<HTMLButtonElement>('button[data-files-btn]'))) {
    fbtn.addEventListener('click', async () => {
      const id = fbtn.getAttribute('data-files-btn');
      const slot = id ? containerRef!.querySelector<HTMLElement>(`[data-files-slot="${id}"]`) : null;
      if (!id || !slot) return;
      fbtn.disabled = true;
      const original = fbtn.textContent;
      fbtn.textContent = 'Načítavam…';
      const files = await listQuestFilesForTeacher(id);
      fbtn.disabled = false;
      fbtn.textContent = original;
      if (files.length === 0) {
        slot.innerHTML = '<p class="muted" style="font-size:var(--fs-sm)">Žiak zatiaľ nepriložil žiadne súbory.</p>';
        return;
      }
      slot.innerHTML =
        '<ul style="margin:0;padding-left:18px">' +
        files
          .map((f) => {
            const kb = Math.max(1, Math.round(f.sizeBytes / 1024));
            const size = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} kB`;
            return `<li style="margin:2px 0"><a href="${escapeHtml(f.url)}" target="_blank" rel="noopener">${escapeHtml(f.name)}</a> <span class="muted" style="font-size:var(--fs-xs)">(${size})</span></li>`;
          })
          .join('') +
        '</ul>';
    });
  }

  // Post-submission review: load the AI evaluation (1–5) + confirm/adjust.
  for (const rbtn of Array.from(containerRef.querySelectorAll<HTMLButtonElement>('button[data-review-btn]'))) {
    rbtn.addEventListener('click', async () => {
      const qid = rbtn.getAttribute('data-review-btn');
      const sid = rbtn.getAttribute('data-submission');
      const slot = qid ? containerRef!.querySelector<HTMLElement>(`[data-review-slot="${qid}"]`) : null;
      if (!qid || !sid || !slot || slot.dataset.loaded === '1') return;
      rbtn.disabled = true;
      const original = rbtn.textContent;
      rbtn.textContent = 'Načítavam…';
      const { evaluation, review } = await fetchSubmissionReview(sid);
      rbtn.disabled = false;
      rbtn.textContent = original;
      if (!evaluation) {
        slot.innerHTML = '<p class="muted">Hodnotenie AI sa nepodarilo načítať.</p>';
        return;
      }
      slot.dataset.loaded = '1';
      slot.innerHTML = renderSubmissionEval(evaluation) + (review ? renderExistingReview(review) : renderReviewForm(qid, sid, evaluation));
      if (!review) bindReviewForm(qid);
    });
  }

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
