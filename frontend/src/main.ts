import './styles/tokens.css';
import './styles/app.css';
import { LandingPage } from './pages/LandingPage';
import { StudentDashboardPage } from './pages/StudentDashboardPage';
import { TeacherDashboardPage } from './pages/TeacherDashboardPage';

interface Route {
  path: string;
  label: string;
  render: () => string;
}

const routes: Route[] = [
  { path: '/', label: 'Domov', render: LandingPage },
  { path: '/student', label: 'Žiak', render: StudentDashboardPage },
  { path: '/teacher', label: 'Učiteľ', render: TeacherDashboardPage },
];

function currentPath(): string {
  const hash = window.location.hash.replace(/^#/, '');
  return hash.length > 0 ? hash : '/';
}

function header(activePath: string): string {
  const links = routes
    .map(
      (route) =>
        `<a class="nav__link" href="#${route.path}"${route.path === activePath ? ' aria-current="page"' : ''}>${route.label}</a>`,
    )
    .join('');
  return `
  <header class="app-header">
    <div class="app-header__inner">
      <a class="brand" href="#/"><span class="brand__mark">IN</span> INVOk</a>
      <nav class="nav" aria-label="Hlavná navigácia">${links}</nav>
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
}

window.addEventListener('hashchange', render);
render();
