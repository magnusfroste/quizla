// The study view: what Quizla read from the pages, grouped by topic or by page, with a search box.

import { h, add, clear, api, modal, chip, empty } from './ui.js';
import { icon, illustration } from './icons.js';
import { state, DEMO_NOTE } from './state.js';
import { PAGE_TYPES } from './collection.js';

const haystack = (p) => [p.text, ...p.topics, ...p.concepts, ...p.formulas, ...p.objectives, ...p.emphasis,
  ...Object.entries(p.definitions).flat()].join(' \n ').toLowerCase();

function pageCard(p) {
  const type = PAGE_TYPES[p.type] || PAGE_TYPES.content;
  const paragraphs = p.text.split(/\n\s*\n/).filter(Boolean);
  const text = h('div', { class: `prose${paragraphs.join('').length > 420 ? ' folded' : ''}` }, paragraphs.map((t) => h('p', {}, t)));
  const more = text.classList.contains('folded') && h('button', { class: 'link-btn', type: 'button', onclick: () => {
    const open = text.classList.toggle('folded');
    more.firstChild.textContent = open ? 'Visa mer' : 'Visa mindre';
  } }, 'Visa mer');
  const defs = Object.entries(p.definitions);
  return h('article', { class: 'card study-card' },
    h('div', { class: 'row start' },
      h('button', { class: 'thumb', type: 'button', 'aria-label': `Visa sida ${p.number}`, onclick: () => modal({ title: `Sida ${p.number}`, wide: true,
        body: h('img', { class: 'page-full', src: `/api/pages/${p.id}/image`, alt: `Sida ${p.number}` }) }) },
      h('img', { src: `/api/pages/${p.id}/image`, alt: '', loading: 'lazy' })),
      h('div', { class: 'grow stack tight' },
        h('div', { class: 'row wrap' }, h('span', { class: 'mono strong' }, `Sida ${p.number}`), chip(type.label, '', type.icon), p.demo && chip('Exempel', 'tiny')),
        h('div', { class: 'row wrap' }, p.topics.map((t) => chip(t, 'blue'))))),
    p.objectives.length > 0 && h('div', { class: 'stack tight' }, h('h3', {}, icon('flag'), 'Lärandemål'),
      h('ul', { class: 'checks' }, p.objectives.map((o) => h('li', {}, icon('target'), h('span', {}, o))))),
    p.concepts.length > 0 && h('div', { class: 'row wrap' }, p.concepts.map((c) => chip(c, 'orange'))),
    paragraphs.length > 0 && text, more,
    defs.length > 0 && h('div', { class: 'stack tight' }, h('h3', {}, icon('bookmark'), 'Begrepp'),
      h('dl', { class: 'defs' }, defs.map(([term, meaning]) => [h('dt', {}, term), h('dd', {}, meaning)]))),
    p.formulas.length > 0 && h('div', { class: 'stack tight' }, h('h3', {}, icon('bolt'), 'Formler'),
      p.formulas.map((f) => h('div', { class: 'formula mono' }, f))),
    p.emphasis.length > 0 && h('div', { class: 'stack tight' }, h('h3', {}, icon('star'), 'Viktigt'),
      h('ul', { class: 'checks' }, p.emphasis.map((e) => h('li', {}, icon('check'), h('span', {}, e))))));
}

export async function study(ctx, cid) {
  const data = await api(`/collections/${cid}/study`);
  const pages = data.pages.map((p) => ({ ...p, hay: haystack(p) }));
  let group = 'topic';
  let query = '';
  const list = h('div', { class: 'stack roomy' });
  const seg = h('div', { class: 'segmented small' });

  function draw() {
    clear(seg);
    for (const [id, label, ic] of [['topic', 'Ämne', 'layers'], ['page', 'Sida', 'file']]) {
      seg.appendChild(h('button', { type: 'button', class: group === id ? 'on' : '', 'aria-pressed': String(group === id), onclick: () => { group = id; draw(); } }, icon(ic), label));
    }
    clear(list);
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = pages.filter((p) => words.every((w) => p.hay.includes(w)));
    if (!hits.length) {
      list.appendChild(empty(illustration('quiz'), 'Inga träffar', 'Prova ett annat ord.'));
      return;
    }
    if (group === 'page') {
      add(list, hits.map(pageCard));
      return;
    }
    const groups = new Map();
    for (const p of hits) {
      const key = p.topics[0] || 'Övrigt';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    for (const [topic, items] of groups) {
      list.appendChild(h('section', { class: 'stack' },
        h('h2', { class: 'topic-head' }, topic, h('span', { class: 'muted mono small' }, ` ${items.length} ${items.length === 1 ? 'sida' : 'sidor'}`)),
        items.map(pageCard)));
    }
  }

  const head = h('div', { class: 'row' },
    h('a', { href: `/c/${cid}`, class: 'icon-btn', 'aria-label': 'Tillbaka' }, icon('left')),
    h('h1', { class: 'grow clamp' }, data.collection.title));
  if (!pages.length) {
    return h('div', { class: 'stack roomy' }, head, empty(illustration('scan'), 'Inget att plugga på än', 'Låt Quizla läsa dina sidor först.',
      h('a', { href: `/c/${cid}`, class: 'btn primary' }, icon('left'), 'Till samlingen')));
  }
  draw();
  const search = h('input', { type: 'search', placeholder: 'Sök i dina sidor', 'aria-label': 'Sök', oninput: (e) => { query = e.target.value; draw(); } });
  return add(h('div', { class: 'stack roomy' }), [
    head,
    !state.ai && pages.some((p) => p.demo) && h('p', { class: 'note' }, icon('info'), h('span', {}, DEMO_NOTE)),
    h('div', { class: 'row wrap' }, h('label', { class: 'search grow' }, icon('search'), search), seg),
    list,
  ]);
}
