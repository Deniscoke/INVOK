import { Mascot } from '../components/Mascot';
import { icon } from '../components/icons';
import { getCompetencies } from '../services/mockDataService';

export function LandingPage(): string {
  const competencyChips = getCompetencies()
    .map((competency) => `<span class="chip chip--muted">${icon(competency.icon, 14)} ${competency.childName}</span>`)
    .join('');

  return `
  <section class="hero">
    <div class="hero__grid">
      <div>
        <span class="chip" style="background:rgba(255,255,255,.18);color:#fff">Pre slovenské základné školy · ŠVP ZV</span>
        <h1>Misie, ktoré rozvíjajú skutočné zručnosti.</h1>
        <p>INVOk je gamifikovaná platforma, kde žiaci mapujú problémy, navrhujú riešenia a zbierajú dôkazy svojho rastu. AI dáva rýchlu spätnú väzbu — učiteľ zostáva garantom.</p>
        <div class="hero__cta">
          <a class="btn btn--primary btn--lg" href="#/student">Začať misiu</a>
          <a class="btn btn--ghost btn--lg" href="#/teacher">Pre učiteľov</a>
        </div>
      </div>
      <div class="hero__mascot">${Mascot({ size: 200 })}</div>
    </div>
  </section>

  <div class="feature-row">
    <div class="feature">
      <span class="feature__icon">${icon('lightbulb')}</span>
      <div><strong>Zmysluplné misie</strong><p class="muted" style="margin:4px 0 0">Projektové výzvy: zmapuj problém, navrhni a otestuj riešenie, reflektuj rast.</p></div>
    </div>
    <div class="feature">
      <span class="feature__icon">${icon('shield')}</span>
      <div><strong>AI + učiteľ ako garant</strong><p class="muted" style="margin:4px 0 0">AI robí formatívnu validáciu s mierou istoty. Finálne slovo má vždy učiteľ.</p></div>
    </div>
    <div class="feature">
      <span class="feature__icon">${icon('compass')}</span>
      <div><strong>Súkromie na prvom mieste</strong><p class="muted" style="margin:4px 0 0">Žiaci vystupujú pod pseudonymom (napr. Líška-07). Žiadne verejné rebríčky.</p></div>
    </div>
  </div>

  <section style="margin-top: var(--space-7)">
    <div class="section-title"><h2>Hrdinské kompetencie</h2><span class="muted">detské názvy, interné pedagogické mapovanie</span></div>
    <div class="chip-row">${competencyChips}</div>
  </section>`;
}
