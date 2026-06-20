/**
 * Student completion certificate ("Certifikát absolvovania").
 *
 * Self-contained, additive feature: opens a full-screen overlay with a printable
 * certificate matching the official INVOK design (PSC n.o. · EÚ · Program
 * Slovensko · Ministerstvo práce SR header lockup), populated with the student's
 * alias + date. "Tlačiť / Uložiť PDF" uses the browser's print dialog; an
 * isolated @media print stylesheet (see styles/certificate.css) prints only the
 * certificate at A4 landscape. No app state, routing or data flow is touched.
 *
 * Security: the markup template is fully static; the only dynamic values (alias,
 * date) are injected via textContent and the EU emblem via a data-URI on an
 * <img> — nothing untrusted ever reaches innerHTML.
 */
import { euEmblem } from './brand';

export interface CertificateOptions {
  /** Student pseudonym / code shown as the recipient. */
  alias: string;
  /** Optional pre-formatted date; defaults to today (sk-SK). */
  dateText?: string;
}

const TEMPLATE = `
  <div class="invok-cert-overlay__bar">
    <button type="button" class="btn btn--primary invok-cert-print">🖨️ Tlačiť / Uložiť PDF</button>
    <button type="button" class="btn btn--ghost invok-cert-close">Zavrieť</button>
  </div>
  <div class="invok-cert" role="document">
    <div class="invok-cert__logos">
      <span class="invok-cert__wm invok-cert__wm--psc">PSC <small>n.o.</small></span>
      <span class="invok-cert__logodiv"></span>
      <span class="invok-cert__eu"><img class="invok-cert__flag" alt="Vlajka Európskej únie"><small>EURÓPSKA ÚNIA</small></span>
      <span class="invok-cert__logodiv"></span>
      <span class="invok-cert__wm">PROGRAM<br>SLOVENSKO</span>
      <span class="invok-cert__logodiv"></span>
      <span class="invok-cert__wm">MINISTERSTVO PRÁCE,<br>SOCIÁLNYCH VECÍ A RODINY SR</span>
    </div>

    <div class="invok-cert__brand"><span class="invok-cert__mark">IN</span> INVOK</div>
    <h1 class="invok-cert__title">CERTIFIKÁT</h1>
    <div class="invok-cert__sub">— ABSOLVOVANIA —</div>

    <p class="invok-cert__lead">S HRDOSŤOU POTVRDZUJEME, ŽE</p>
    <p class="invok-cert__name"></p>
    <p class="invok-cert__body">
      úspešne absolvoval/a vzdelávací program <strong>INVOK</strong> zameraný na rozvoj
      <strong>podnikavosti, kritického myslenia, digitálnych kompetencií a tímovej spolupráce.</strong>
    </p>
    <p class="invok-cert__thanks">Ďakujeme za aktívnu účasť, nasadenie a chuť posúvať sa vpred.</p>

    <div class="invok-cert__foot">
      <div class="invok-cert__foot-col">
        <div class="invok-cert__line invok-cert__date"></div>
        <div class="invok-cert__cap">📅 Miesto a dátum</div>
      </div>
      <div class="invok-cert__foot-col invok-cert__foot-col--right">
        <div class="invok-cert__sign">Radovan Ščerbák</div>
        <div class="invok-cert__line"></div>
        <div class="invok-cert__cap"><strong>Mgr. Radovan Ščerbák</strong><br>riaditeľ PSC N.O.</div>
      </div>
    </div>
  </div>`;

function todaySk(): string {
  try {
    return new Date().toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

let overlayEl: HTMLElement | null = null;

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeCertificate();
}

export function closeCertificate(): void {
  if (!overlayEl) return;
  overlayEl.remove();
  overlayEl = null;
  document.removeEventListener('keydown', onKey);
}

export function openCertificate(opts: CertificateOptions): void {
  if (typeof document === 'undefined') return;
  closeCertificate();

  const alias = (opts.alias || '').trim() || 'žiak';
  const dateText = opts.dateText ?? todaySk();

  const overlay = document.createElement('div');
  overlay.className = 'invok-cert-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Certifikát absolvovania');
  overlay.innerHTML = TEMPLATE; // static template only

  // Inject dynamic values safely (no untrusted HTML).
  const nameEl = overlay.querySelector<HTMLElement>('.invok-cert__name');
  if (nameEl) nameEl.textContent = alias;
  const dateEl = overlay.querySelector<HTMLElement>('.invok-cert__date');
  if (dateEl) dateEl.textContent = dateText;
  const flag = overlay.querySelector<HTMLImageElement>('.invok-cert__flag');
  if (flag) flag.setAttribute('src', `data:image/svg+xml,${encodeURIComponent(euEmblem(32))}`);

  document.body.appendChild(overlay);
  overlayEl = overlay;

  overlay.querySelector('.invok-cert-print')?.addEventListener('click', () => window.print());
  overlay.querySelector('.invok-cert-close')?.addEventListener('click', () => closeCertificate());
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeCertificate();
  });
  document.addEventListener('keydown', onKey);
}
