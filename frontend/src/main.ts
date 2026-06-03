import './styles/tokens.css';
import './styles/app.css';
import { LandingPage } from './pages/LandingPage';
import { StudentDashboardPage } from './pages/StudentDashboardPage';
import { TeacherDashboardPage } from './pages/TeacherDashboardPage';
import { LoginPage, mountLoginPage } from './pages/LoginPage';
import { StudentJoinPage, mountStudentJoinPage } from './pages/StudentJoinPage';
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
  { path: '/student', label: 'Žiak', render: StudentDashboardPage, inNav: true },
  { path: '/teacher', label: 'Učiteľ', render: TeacherDashboardPage, inNav: true },
  { path: '/login', label: 'Prihlásenie', render: LoginPage, mount: mountLoginPage },
  { path: '/join', label: 'Pripojiť sa', render: StudentJoinPage, mount: mountStudentJoinPage },
];

function currentPath(): string {
  const hash = window.location.hash.replace(/^#/, '');
  return hash.length > 0 ? hash : '/';
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
render();
void initAuth();
