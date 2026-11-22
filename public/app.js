// Quizla – the browser side. One page, a small router, and one module per screen.

import { h, add, clear, api, oops, busy, field, empty } from './ui.js';
import { icon, logo, illustration } from './icons.js';
import { state, go } from './state.js';
import { home } from './home.js';
import { collection } from './collection.js';
import { study } from './study.js';
import { quiz, practice } from './play.js';
import { stats } from './stats.js';
import { profile } from './profile.js';

// open: reachable without an account · focus: no navigation around it (playing a quiz)
const ROUTES = [
  { re: /^\/$/, view: home, tab: 'home' },
  { re: /^\/c\/(\d+)$/, view: collection, tab: 'home' },
  { re: /^\/c\/(\d+)\/study$/, view: study, tab: 'home' },
  { re: /^\/c\/(\d+)\/practice$/, view: practice, tab: 'home', focus: true },
  { re: /^\/quiz\/([A-Za-z0-9_-]{6,40})$/, view: quiz, tab: 'home', open: true, focus: true },
  { re: /^\/stats$/, view: stats, tab: 'stats' },
  { re: /^\/profile$/, view: profile, tab: 'profile' },
];
const TABS = [['home', '/', 'home', 'Hem'], ['stats', '/stats', 'chart', 'Statistik'], ['profile', '/profile', 'user', 'Profil']];

const root = document.getElementById('app');
let current = null;        // AbortController of the screen on show

function shell(route) {
  const signedIn = Boolean(state.user);
  const links = (cls) => TABS.map(([id, href, ic, label]) =>
    h('a', { href, class: `${cls}${route && route.tab === id ? ' on' : ''}`, 'aria-current': route && route.tab === id ? 'page' : null }, icon(ic), h('span', {}, label)));
  const main = h('main', { id: 'view', class: 'view' });
  clear(root);
  document.body.classList.toggle('focus', Boolean(route && route.focus));
  add(root, [
    h('header', { class: 'top' },
      h('a', { href: '/', class: 'brand', 'aria-label': 'Quizla – hem' }, logo(34), h('span', { class: 'wordmark' }, 'Quizla')),
      signedIn ? h('nav', { class: 'top-nav', 'aria-label': 'Meny' }, links('top-link'))
        : h('button', { class: 'btn small ghost', type: 'button', onclick: () => { state.wantAuth = true; render(); } }, icon('user'), 'Logga in')),
    main,
    signedIn && h('nav', { class: 'tabs', 'aria-label': 'Meny' }, links('tab')),
  ]);
  return main;
}

const loader = () => h('div', { class: 'loader', role: 'status', 'aria-label': 'Laddar' }, h('span', {}), h('span', {}), h('span', {}));

async function render() {
  if (current) current.abort();
  const controller = new AbortController();
  current = controller;
  const url = new URL(location.href);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  let route = null;
  let params = [];
  for (const r of ROUTES) {
    const m = r.re.exec(path);
    if (m) { route = r; params = m.slice(1); break; }
  }
  if (!state.user && (state.wantAuth || !(route && route.open))) {
    document.body.classList.remove('focus');
    clear(root).appendChild(authScreen());
    window.scrollTo(0, 0);
    return;
  }
  const main = shell(route);
  main.appendChild(loader());
  window.scrollTo(0, 0);
  const ctx = { signal: controller.signal, query: Object.fromEntries(url.searchParams), path };
  try {
    const node = route ? await route.view(ctx, ...params) : notFound();
    if (controller.signal.aborted) return;
    clear(main).appendChild(node);
  } catch (e) {
    if (controller.signal.aborted) return;
    if (e.status === 401) {
      state.user = null;
      document.body.classList.remove('focus');
      clear(root).appendChild(authScreen(e.message));
      return;
    }
    clear(main).appendChild(e.status === 404 ? notFound(e.message) : problem(e));
  }
}

const notFound = (message) => empty(illustration('quiz'), 'Hittar inte den sidan', message || 'Den kan ha tagits bort.',
  h('a', { href: '/', class: 'btn primary' }, icon('home'), 'Till start'));
const problem = (e) => empty(illustration('quiz'), 'Det gick inte att ladda', e.message || 'Försök igen om en stund.',
  h('button', { class: 'btn primary', type: 'button', onclick: () => render() }, icon('refresh'), 'Försök igen'));

state.router = (path, { replace = false } = {}) => {
  if (path !== location.pathname + location.search) history[replace ? 'replaceState' : 'pushState'](null, '', path);
  return render();
};
window.addEventListener('popstate', () => render());

// Links inside the app move without a page load.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest ? e.target.closest('a[href^="/"]') : null;
  if (!a || a.target || a.hasAttribute('download')) return;
  e.preventDefault();
  go(a.getAttribute('href'));
});

// ---------------------------------------------------------------- sign in / sign up

function authScreen(message) {
  let mode = sessionStorage.getItem('quizla:auth') === 'signup' ? 'signup' : 'login';
  const username = h('input', { name: 'username', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true, minlength: 3, maxlength: 24 });
  const password = h('input', { name: 'password', type: 'password', required: true, minlength: 6, maxlength: 200 });
  const display = h('input', { name: 'display_name', autocomplete: 'nickname', maxlength: 40, placeholder: 'T.ex. ditt förnamn' });
  const nameField = field('Vad vill du kallas?', display);
  const submit = h('button', { class: 'btn primary big wide', type: 'submit' });
  const tabs = h('div', { class: 'segmented', role: 'tablist' });
  const hint = h('p', { class: 'hint center' });

  function draw() {
    clear(tabs);
    for (const [id, label] of [['login', 'Logga in'], ['signup', 'Skapa konto']]) {
      tabs.appendChild(h('button', { type: 'button', role: 'tab', class: mode === id ? 'on' : '', 'aria-selected': String(mode === id),
        onclick: () => { mode = id; draw(); } }, label));
    }
    nameField.hidden = mode !== 'signup';
    password.setAttribute('autocomplete', mode === 'signup' ? 'new-password' : 'current-password');
    clear(submit);
    add(submit, [mode === 'signup' ? 'Skapa konto' : 'Logga in', icon('arrow')]);
    hint.textContent = mode === 'signup' ? 'Inget mejl behövs – bara ett användarnamn och ett lösenord (minst 6 tecken).' : 'Ny här? Välj Skapa konto – det tar tio sekunder.';
  }
  draw();

  const form = h('form', { class: 'stack', onsubmit: (e) => {
    e.preventDefault();
    busy(submit, async () => {
      const body = { username: username.value.trim(), password: password.value };
      if (mode === 'signup') body.display_name = display.value.trim();
      const r = await api(mode === 'signup' ? '/auth/signup' : '/auth/login', body);
      sessionStorage.removeItem('quizla:auth');
      state.user = r.user;
      state.wantAuth = false;
      await render();          // stays on the address that was asked for, e.g. a shared quiz
    });
  } }, tabs, nameField, field('Användarnamn', username), field('Lösenord', password), submit, hint);

  const step = (ic, label, cls) => h('div', { class: 'step' }, h('div', { class: `step-icon ${cls}` }, icon(ic)), h('span', {}, label));
  return h('div', { class: 'auth' },
    h('div', { class: 'auth-hero' },
      logo(64),
      h('h1', { class: 'wordmark xl' }, 'Quizla'),
      h('p', { class: 'tagline' }, 'Snap. Quiz. Ace.'),
      h('div', { class: 'steps', 'aria-label': 'Fota dina sidor, få ett quiz, briljera på provet' },
        step('camera', 'Fota', 'orange'), icon('right', 'step-arrow'), step('sparkles', 'Quizza', 'blue'), icon('right', 'step-arrow'), step('trophy', 'Briljera', 'ink'))),
    h('div', { class: 'card auth-card' }, message && h('p', { class: 'note' }, icon('info'), h('span', {}, message)), form),
    state.wantAuth && h('button', { class: 'link-btn', type: 'button', onclick: () => { state.wantAuth = false; render(); } }, 'Tillbaka till quizet'));
}

// ---------------------------------------------------------------- start

async function boot() {
  try {
    const me = await api('/me');
    state.user = me.user;
    state.ai = Boolean(me.ai && me.ai.configured);
  } catch (e) {
    oops(e);
  }
  render();
}
boot();
