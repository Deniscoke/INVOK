import './styles/tokens.css';
import './styles/app.css';
import { LandingPage } from './pages/LandingPage';
import { StudentDashboardPage, mountStudentDashboard } from './pages/StudentDashboardPage';
import { StudentQuestsPage, mountStudentQuestsPage } from './pages/StudentQuestsPage';
import { TeacherDashboardPage, mountTeacherDashboard } from './pages/TeacherDashboardPage';
import { LoginPage, mountLoginPage } from './pages/LoginPage';
import { StudentJoinPage, mountStudentJoinPage } from './pages/StudentJoinPage';
import { PilotSetupPage, mountPilotSetup } from './pages/PilotSetupPage';
import { AuthStatus } from './components/AuthStatus';
import { getSnapshot, init as initAuth, onAuthChange, signOut } from './services/authService';

interface Route {
  path: string;
  label: string;
  render: () => string;
  mount?: () => void;
  inNav?: boolean;
}

const routes: Route[] = [
  { path: '/', label: 'Domov', render: LandingPage, inNav: true },
  { path: '/student', label: 'Žiak', render: StudentDashboardPage, mount: mountStudentDashboard, inNav: true },
  { path: '/quests', label: 'Misie', render: StudentQuestsPage, mount: mountStudentQuestsPage },
  { path: '/teacher', label: 'Učiteľ', render: TeacherDashboardPage, mount: mountTeacherDashboard, inNav: true },
  { path: '/login', label: 'Prihlásenie', render: LoginPage, mount: mountLoginPage },
  { path: '/join', label: 'Pripojiť sa', render: StudentJoinPage, mount: mountStudentJoinPage },
  { path: '/pilot', label: 'Pilot', render: PilotSetupPage, mount: mountPilotSetup, inNav: true },
];

function currentPath(): string {
  const hash = window.location.hash.replace(/^#/, '');
  const raw = hash.length > 0 ? hash : '/';
  // Strip query/fragment so `#/join?code=...` matches the `/join` route.
  return raw.split('?')[0].split('#')[0];
}

/**
 * Promote a path-based URL (e.g. /pilot, /teacher) into the hash-based router
 * we actually use. This makes direct links and bookmarks like /pilot keep
 * working: Vercel rewrites every non-API path to index.html, then we move the
 * intended route into the hash before the first render.
 */
function normalizeUrlToHash(): void {
  if (typeof window === 'undefined') return;
  const { pathname, search, hash } = window.location;
  if (hash || pathname === '/' || pathname === '') return;
  const target = `/#${pathname}${search}`;
  window.history.replaceState(null, '', target);
}

function header(activePath: string): string {
  const links = routes
    .filter((route) => route.inNav)
    .map(
      (route) =>
        `<a class="nav__link" href="#${route.path}"${route.path === activePath ? ' aria-current="page"' : ''}>${route.label}</a>`,
    )
    .join('');
  return `
  <header class="app-header">
    <div class="app-header__inner">
      <a class="brand" href="#/"><span class="brand__mark">IN</span> INVOk</a>
      <div class="header-right">
        <nav class="nav" aria-label="Hlavná navigácia">${links}</nav>
        ${AuthStatus(getSnapshot())}
      </div>
    </div>
  </header>`;
}

function footer(): string {
  return `
  <footer class="app-footer">
    <div class="container">
      INVOk · MVP skelet · Pseudonymita a súkromie žiakov sú v základe dizajnu.
    </div>
  </footer>`;
}

function render(): void {
  const path = currentPath();
  const route = routes.find((candidate) => candidate.path === path) ?? routes[0];
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) return;
  app.innerHTML = `${header(route.path)}<main><div class="container">${route.render()}</div></main>${footer()}`;
  window.scrollTo({ top: 0 });

  document.querySelector('#auth-signout')?.addEventListener('click', () => {
    void signOut();
  });
  route.mount?.();
}

onAuthChange(render);
window.addEventListener('hashchange', render);
normalizeUrlToHash();
render();
void initAuth();
