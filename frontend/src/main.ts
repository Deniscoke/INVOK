import './styles/tokens.css';
import './styles/app.css';
import './styles/login-transition.css';
import './styles/smarta.css';
import { LandingPage } from './pages/LandingPage';
import { StudentDashboardPage, mountStudentDashboard } from './pages/StudentDashboardPage';
import { StudentQuestsPage, mountStudentQuestsPage } from './pages/StudentQuestsPage';
import { TeacherDashboardPage, mountTeacherDashboard } from './pages/TeacherDashboardPage';
import { LoginPage, mountLoginPage } from './pages/LoginPage';
import { StudentJoinPage, mountStudentJoinPage } from './pages/StudentJoinPage';
import { PilotSetupPage, mountPilotSetup } from './pages/PilotSetupPage';
import { AuthStatus } from './components/AuthStatus';
import { mountSmarta } from './components/smarta/Smarta';
import { getSnapshot, init as initAuth, onAuthChange, signOut } from './services/authService';

interface Route {
  path: string;
  label: string;
  render: () => string;
  mount?: () => void;
}

const routes: Route[] = [
  { path: '/', label: 'Domov', render: LandingPage },
  { path: '/student', label: 'Žiak', render: StudentDashboardPage, mount: mountStudentDashboard },
  { path: '/quests', label: 'Misie', render: StudentQuestsPage, mount: mountStudentQuestsPage },
  { path: '/teacher', label: 'Učiteľ', render: TeacherDashboardPage, mount: mountTeacherDashboard },
  { path: '/login', label: 'Prihlásenie', render: LoginPage, mount: mountLoginPage },
  { path: '/join', label: 'Pripojiť sa', render: StudentJoinPage, mount: mountStudentJoinPage },
  { path: '/pilot', label: 'Pilot', render: PilotSetupPage, mount: mountPilotSetup },
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

interface NavItem {
  path: string;
  label: string;
}

/**
 * Role-based navigation. Sections appear only once the relevant person is
 * signed in, so a logged-out visitor sees a clean bar (just the two role
 * buttons in AuthStatus). Labels are short and friendly rather than
 * "Žiak"/"Učiteľ". Pilot setup is teacher-only.
 */
function navItemsFor(snapshot: ReturnType<typeof getSnapshot>): NavItem[] {
  const role = snapshot.user?.role;
  if (role === 'student') {
    return [
      { path: '/student', label: 'Moja cesta' },
      { path: '/quests', label: 'Misie' },
    ];
  }
  if (role === 'teacher' || role === 'admin') {
    return [
      { path: '/teacher', label: 'Moja trieda' },
      { path: '/pilot', label: 'Žiaci a kódy' },
    ];
  }
  return [];
}

function header(activePath: string): string {
  const snapshot = getSnapshot();
  const links = navItemsFor(snapshot)
    .map(
      (item) =>
        `<a class="nav__link" href="#${item.path}"${item.path === activePath ? ' aria-current="page"' : ''}>${item.label}</a>`,
    )
    .join('');
  return `
  <header class="app-header">
    <div class="app-header__inner">
      <a class="brand" href="#/"><span class="brand__mark">IN</span> INVOk</a>
      <div class="header-right">
        <nav class="nav" aria-label="Hlavná navigácia">${links}</nav>
        ${AuthStatus(snapshot)}
      </div>
    </div>
  </header>`;
}

function footer(): string {
  return `
  <footer class="app-footer">
    <div class="container">
      INVOk · Súkromie a pseudonymita žiakov sú v základe dizajnu.
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

  document.querySelector('#auth-signout')?.addEventListener('click', async () => {
    await signOut();
    // Land on the home page after signing out instead of staying on a now
    // role-less dashboard (which would show demo data).
    if (currentPath() === '/') render();
    else window.location.hash = '/';
  });
  route.mount?.();
}

onAuthChange(render);
window.addEventListener('hashchange', render);
normalizeUrlToHash();
render();
// Global assistant — mounted once on <body>, survives #app re-renders.
mountSmarta();
void initAuth();
