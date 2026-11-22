// The share sheet of a quiz: open it to anyone with the link, or to named classmates.

import { h, add, clear, api, oops, busy, modal, toast, copyText } from './ui.js';
import { icon } from './icons.js';

export async function shareDialog(quiz, onchange) {
  let data;
  try {
    data = await api(`/quizzes/${quiz.id}/shares`);
  } catch (e) {
    oops(e);
    return;
  }
  const url = `${location.origin}/quiz/${quiz.id}`;
  const changed = () => { if (onchange) onchange({ is_public: data.is_public, shares: data.shares.length }); };

  // --- anyone with the link
  const toggle = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-label': 'Öppet för alla med länken' }, h('span', {}));
  const publicIcon = h('div', { class: 'badge-icon' });
  const publicText = h('p', { class: 'muted small' });
  const linkBox = h('input', { class: 'mono', readonly: true, value: url, 'aria-label': 'Länk till quizet', onfocus: (e) => e.target.select() });
  const drawPublic = () => {
    toggle.setAttribute('aria-checked', String(data.is_public));
    publicIcon.className = `badge-icon ${data.is_public ? 'blue' : ''}`;
    clear(publicIcon).appendChild(icon(data.is_public ? 'globe' : 'lock'));
    publicText.textContent = data.is_public ? 'Alla som har länken kan göra quizet – även utan konto.' : 'Bara du och de du delar med kan öppna quizet.';
  };
  const setPublic = async (on) => {
    const r = await api(`/quizzes/${quiz.id}/public`, { is_public: on });
    data.is_public = r.is_public;
    drawPublic();
    changed();
  };
  toggle.addEventListener('click', () => busy(toggle, () => setPublic(!data.is_public)));
  const copy = h('button', { type: 'button', class: 'btn primary wide', onclick: () => busy(copy, async () => {
    // Copying the link is asking for it to work, so it opens the quiz (as the original did) – and says so.
    const opened = !data.is_public;
    if (opened) await setPublic(true);
    const ok = await copyText(url);
    if (!ok) { linkBox.focus(); linkBox.select(); }
    toast(`${ok ? 'Länken är kopierad' : 'Markera och kopiera länken'}${opened ? ' – quizet är nu öppet för alla med länken' : ''}.`);
  }) }, icon('copy'), 'Kopiera länk');

  // --- named classmates
  const list = h('ul', { class: 'people' });
  const drawList = () => {
    clear(list);
    if (!data.shares.length) list.appendChild(h('li', { class: 'muted small' }, 'Inte delat med någon än.'));
    for (const u of data.shares) {
      const removeBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Sluta dela med ${u.username}`, onclick: () => busy(removeBtn, async () => {
        data.shares = (await api(`/quizzes/${quiz.id}/shares/remove`, { user_id: u.id })).shares;
        drawList();
        changed();
      }) }, icon('x'));
      list.appendChild(h('li', {}, h('span', { class: 'avatar small' }, (u.display_name || u.username).slice(0, 1).toUpperCase()),
        h('span', { class: 'grow' }, h('strong', {}, u.display_name), h('span', { class: 'muted small mono' }, ` @${u.username}`)), removeBtn));
    }
  };
  const name = h('input', { placeholder: 'Användarnamn', autocapitalize: 'none', spellcheck: 'false', maxlength: 25, 'aria-label': 'Kompisens användarnamn' });
  const addBtn = h('button', { class: 'btn secondary', type: 'submit', 'aria-label': 'Dela' }, icon('plus'));
  const form = h('form', { class: 'row', onsubmit: (e) => {
    e.preventDefault();
    if (!name.value.trim()) { name.focus(); return; }
    busy(addBtn, async () => {
      data.shares = (await api(`/quizzes/${quiz.id}/shares`, { username: name.value.trim() })).shares;
      name.value = '';
      drawList();
      changed();
      toast('Delat!');
    });
  } }, name, addBtn);

  drawPublic();
  drawList();
  modal({
    title: 'Dela quiz',
    body: add(h('div', { class: 'stack' }), [
      h('p', { class: 'strong' }, quiz.title),
      h('div', { class: 'card flat' },
        h('div', { class: 'row' }, publicIcon, h('div', { class: 'grow' }, h('strong', {}, 'Öppet med länk'), publicText), toggle),
        linkBox, copy),
      h('div', { class: 'card flat' },
        h('div', { class: 'row' }, h('div', { class: 'badge-icon orange' }, icon('users')),
          h('div', { class: 'grow' }, h('strong', {}, 'Dela med en klasskompis'), h('p', { class: 'muted small' }, 'Skriv kompisens användarnamn i Quizla.'))),
        form, list),
    ]),
  });
}
