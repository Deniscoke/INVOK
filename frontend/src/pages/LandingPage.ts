import { Mascot } from '../components/Mascot';
import { icon } from '../components/icons';
import { getCompetencies } from '../services/mockDataService';
import { getSnapshot } from '../services/authService';

/**
 * Landing page. Copy is playful and warm for pupils but keeps the pedagogical
 * credibility teachers need (ŠVP ZV, teacher-as-guarantor, privacy). CTAs adapt
 * to who's signed in so nobody lands in a confusing demo-only path.
 */
function heroCtas(): string {
  const role = getSnapshot().user?.role;
  if (role === 'student') {
    return `
      <a class="btn btn--primary btn--lg" href="#/quests">Pokračovať v misiách</a>
      <a class="btn btn--ghost btn--lg" href="#/student">Môj rast</a>`;
  }
  if (role === 'teacher' || role === 'admin') {
    return `
      <a class="btn btn--primary btn--lg" href="#/teacher">Moja trieda</a>
      <a class="btn btn--ghost btn--lg" href="#/pilot">Žiaci a kódy</a>`;
  }
  return `
      <a class="btn btn--primary btn--lg" href="#/join">Som žiak — ideme na to 🚀</a>
      <a class="btn btn--ghost btn--lg" href="#/login">Som učiteľ</a>`;
}

export function LandingPage(): string {
  const competencyChips = getCompetencies()
    .map((competency) => `<span class="chip chip--muted">${icon(competency.icon, 14)} ${competency.childName}</span>`)
    .join('');

  return `
  <section class="hero">
    <div class="hero__grid">
      <div>
        <span class="chip" style="background:rgba(255,255,255,.18);color:#fff">Pre slovenské ZŠ · 2. stupeň · ŠVP ZV</span>
        <h1>Zmeň svoju školu. Misiu po misii.</h1>
        <p>Všimni si problém vo svojej škole, vymysli riešenie a vyskúšaj ho naozaj. AI ti hneď poradí, učiteľ ti drží chrbát — a ty zbieraš XP za zručnosti, ktoré ti ostanú.</p>
        <div class="hero__cta">${heroCtas()}</div>
      </div>
      <div class="hero__mascot">${Mascot({ size: 200 })}</div>
    </div>
  </section>

  <div class="feature-row">
    <div class="feature">
      <span class="feature__icon">${icon('lightbulb')}</span>
      <div><strong>Naozajstné výzvy</strong><p class="muted" style="margin:4px 0 0">Žiadne nudné cvičenia — riešiš ozajstné problémy, od jedálne po triedny odpad.</p></div>
    </div>
    <div class="feature">
      <span class="feature__icon">${icon('shield')}</span>
      <div><strong>AI radí, učiteľ rozhoduje</strong><p class="muted" style="margin:4px 0 0">Spätná väzba príde hneď, no posledné slovo a XP má vždy tvoj učiteľ.</p></div>
    </div>
    <div class="feature">
      <span class="feature__icon">${icon('compass')}</span>
      <div><strong>Si v bezpečí</strong><p class="muted" style="margin:4px 0 0">Vystupuješ pod prezývkou (napr. Líška-07). Žiadne mená, žiadne verejné rebríčky.</p></div>
    </div>
  </div>

  <section style="margin-top: var(--space-7)">
    <div class="section-title"><h2>Tvoje hrdinské sily</h2><span class="muted">detské názvy, za nimi pedagogické kompetencie ŠVP</span></div>
    <div class="chip-row">${competencyChips}</div>
  </section>`;
}
