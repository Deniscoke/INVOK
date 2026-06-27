/**
 * Site footer with mandatory EU-funding publicity.
 *
 * Shows the EU emblem + "Spolufinancované Európskou úniou", the partner marks,
 * the verbatim funding statement, and links to the OFFICIAL legal pages already
 * published on invok.pscno.sk (no duplication). Purely additive — replaces the
 * old one-line footer, touches no app logic.
 */
import { euEmblem, FUNDING_STATEMENT, PARTNERS } from './brand';

const LEGAL: ReadonlyArray<{ href: string; label: string }> = [
  { href: 'https://invok.pscno.sk/ochrana-osobnych-udajov', label: 'Ochrana osobných údajov' },
  { href: 'https://invok.pscno.sk/podmienky-pouzivania', label: 'Podmienky používania' },
  { href: '#/pristupnost', label: 'Vyhlásenie o prístupnosti' },
  { href: 'https://invok.pscno.sk/kontakt', label: 'Kontakt' },
];

export function SiteFooter(): string {
  const partners = PARTNERS.map((p) => `<span class="footer-wm">${p}</span>`).join('');
  const links = LEGAL.map((l) =>
    l.href.startsWith('#')
      ? `<a href="${l.href}">${l.label}</a>`
      : `<a href="${l.href}" target="_blank" rel="noopener noreferrer">${l.label}</a>`,
  ).join('');

  return `
  <footer class="app-footer">
    <div class="container footer-eu">
      <div class="footer-eu__bar">
        <span class="footer-eu__flag">${euEmblem(34)}</span>
        <span class="footer-eu__fund">Spolufinancované<br>Európskou úniou</span>
        <span class="footer-eu__div" aria-hidden="true"></span>
        <div class="footer-eu__partners">${partners}</div>
      </div>
      <p class="footer-eu__statement">${FUNDING_STATEMENT}</p>
      <nav class="footer-links" aria-label="Právne informácie">${links}</nav>
      <p class="footer-fine">© ${new Date().getFullYear()} PSC n.o. · INVOk — súkromie a pseudonymita žiakov sú v základe dizajnu.</p>
    </div>
  </footer>`;
}
