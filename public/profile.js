// Profile: the name, how much is used, sign out, and delete the account with everything in it.

import { h, add, api, busy, modal, field, toast } from './ui.js';
import { icon } from './icons.js';
import { state, go } from './state.js';

export async function profile() {
  const usage = await api('/usage');
  const u = state.user;

  const name = h('input', { maxlength: 40, value: u.display_name, 'aria-label': 'Vad du kallas' });
  const saveName = h('button', { class: 'btn secondary', type: 'submit', 'aria-label': 'Spara namnet' }, icon('check'));
  const avatar = h('div', { class: 'avatar big' }, (u.display_name || u.username).slice(0, 1).toUpperCase());

  const meter = (ic, label, used, max) => h('div', { class: 'topic-bar' },
    h('div', { class: 'row' }, icon(ic), h('span', { class: 'grow' }, label), h('span', { class: 'mono small' }, max ? `${used}/${max}` : String(used))),
    max && h('div', { class: 'bar' }, h('i', { style: { width: `${Math.min(100, Math.round((100 * used) / max))}%` } })));

  async function signOut() {
    await api('/auth/logout', {});
    state.user = null;
    go('/', { replace: true });
  }

  function deleteAccount() {
    const password = h('input', { type: 'password', autocomplete: 'current-password', required: true });
    const btn = h('button', { class: 'btn danger big wide', type: 'submit' }, icon('trash'), 'Ta bort allt');
    const m = modal({
      title: 'Ta bort kontot?',
      body: h('form', { class: 'stack', onsubmit: (e) => {
        e.preventDefault();
        busy(btn, async () => {
          await api('/auth/delete', { password: password.value });
          m.close();
          state.user = null;
          toast('Kontot och allt i det är borta. Hej då!');
          go('/', { replace: true });
        });
      } },
      h('p', {}, 'Ditt konto, dina samlingar, foton, quiz och resultat tas bort direkt. Det går inte att ångra.'),
      field('Skriv ditt lösenord för att bekräfta', password), btn),
    });
    password.focus();
  }

  return add(h('div', { class: 'stack roomy' }), [
    h('h1', {}, 'Profil'),
    h('div', { class: 'card stack' },
      h('div', { class: 'row' }, avatar, h('div', { class: 'grow' }, h('div', { class: 'strong' }, u.display_name), h('div', { class: 'muted mono small' }, `@${u.username}`))),
      h('form', { class: 'row', onsubmit: (e) => {
        e.preventDefault();
        busy(saveName, async () => {
          const r = await api('/profile', { display_name: name.value });
          state.user.display_name = r.display_name;
          toast('Sparat!');
          go('/profile', { replace: true });
        });
      } }, h('label', { class: 'grow field' }, h('span', { class: 'label' }, 'Vad vill du kallas?'), name), saveName)),
    h('section', { class: 'stack' }, h('h2', {}, 'Din användning'),
      h('div', { class: 'card stack' },
        meter('layers', 'Samlingar', usage.collections, usage.limits.collections),
        meter('image', 'Sidor', usage.pages),
        meter('play', 'Quiz', usage.quizzes),
        usage.ai.configured ? meter('sparkles', 'AI-läsningar i dag', usage.ai.today, usage.ai.daily_limit)
          : h('p', { class: 'note' }, icon('info'), h('span', {}, 'AI:n är inte påslagen än – Quizla svarar med exempel.')),
        h('p', { class: 'muted small' }, `En samling rymmer ${usage.limits.pages} sidor och ${usage.limits.quizzes} quiz.`))),
    h('section', { class: 'stack' }, h('h2', {}, 'Konto'),
      h('div', { class: 'card stack' },
        h('p', { class: 'muted small' }, 'Quizla sparar bara ditt användarnamn, det du laddar upp och dina resultat. Ingen spårning, ingen reklam.'),
        h('button', { class: 'btn big', type: 'button', onclick: (e) => busy(e.currentTarget, signOut) }, icon('logout'), 'Logga ut'),
        h('button', { class: 'btn ghost danger-text', type: 'button', onclick: deleteAccount }, icon('trash'), 'Ta bort mitt konto'))),
  ]);
}
