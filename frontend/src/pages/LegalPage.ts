/**
 * Prístupnosť a právne informácie — app-specific accessibility statement
 * (required for the app itself), plus a privacy summary and links to the
 * official organisation-level legal pages on invok.pscno.sk.
 */
import { euEmblem } from '../components/brand';

export function LegalPage(): string {
  return `
  <section class="auth-page" style="max-width:760px">
    <h1>Prístupnosť a právne informácie</h1>

    <div class="card stack" style="margin-bottom:var(--space-4)">
      <h2 style="margin:0;font-size:var(--fs-lg)">Vyhlásenie o prístupnosti</h2>
      <p class="muted" style="margin:0">
        INVOK sa usiluje o prístupnosť v súlade so štandardom
        <strong>WCAG 2.1, úroveň AA</strong>, a so zákonom č. 95/2019 Z. z. o
        informačných technológiách vo verejnej správe.
      </p>
      <p style="margin:0"><strong>Už zavedené opatrenia:</strong></p>
      <ul class="muted" style="margin:0;padding-left:1.2em">
        <li>dostatočný farebný kontrast a čitateľná typografia,</li>
        <li>ovládanie klávesnicou a viditeľný indikátor zamerania (focus),</li>
        <li>významové (ARIA) označenia tlačidiel, dialógov a živých oblastí,</li>
        <li>rešpektovanie nastavenia „obmedziť pohyb" (prefers-reduced-motion),</li>
        <li>titulky pri video lekciách pre žiakov s poruchami čítania.</li>
      </ul>
      <p style="margin:0"><strong>Známe obmedzenia (priebežne riešime):</strong></p>
      <ul class="muted" style="margin:0;padding-left:1.2em">
        <li>titulky a textové prepisy postupne dopĺňame ku všetkým videám,</li>
        <li>formálny audit prístupnosti je naplánovaný.</li>
      </ul>
      <p class="muted" style="margin:0">
        Ak narazíš na bariéru v prístupnosti, napíš nám na
        <a href="mailto:invok@pscno.sk">invok@pscno.sk</a> — radi to opravíme.
      </p>
    </div>

    <div class="card stack" style="margin-bottom:var(--space-4)">
      <h2 style="margin:0;font-size:var(--fs-lg)">Ochrana súkromia</h2>
      <p class="muted" style="margin:0">
        Súkromie žiakov je v základe návrhu. Žiaci pristupujú <strong>pseudonymne</strong> —
        platforma <strong>nespracúva ich osobné údaje</strong> (meno, e-mail, fotku tváre);
        identifikujú sa prezývkou a kódom triedy. Dáta sú uložené v <strong>EÚ</strong>.
      </p>
      <p class="muted" style="margin:0">
        Úplné znenie:
        <a href="https://invok.pscno.sk/ochrana-osobnych-udajov" target="_blank" rel="noopener noreferrer">Ochrana osobných údajov</a>
        ·
        <a href="https://invok.pscno.sk/podmienky-pouzivania" target="_blank" rel="noopener noreferrer">Podmienky používania</a>
      </p>
    </div>

    <div class="card stack">
      <h2 style="margin:0;font-size:var(--fs-lg)">Financovanie a kontakt</h2>
      <div style="display:flex;align-items:center;gap:12px">
        <span style="line-height:0">${euEmblem(30)}</span>
        <p class="muted" style="margin:0;font-size:var(--fs-sm)">
          Program INVOK je realizovaný vďaka podpore Európskej únie prostredníctvom
          programu Program Slovensko a Ministerstva práce, sociálnych vecí a rodiny SR.
        </p>
      </div>
      <p class="muted" style="margin:0">
        Prevádzkovateľ: <strong>PSC n.o.</strong> ·
        <a href="mailto:invok@pscno.sk">invok@pscno.sk</a> ·
        <a href="https://invok.pscno.sk/kontakt" target="_blank" rel="noopener noreferrer">Kontakt</a>
      </p>
    </div>
  </section>`;
}
