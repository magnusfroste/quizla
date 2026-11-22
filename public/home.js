// Home: "Hej {namn}", the game strip, one big thing to do (a new collection), then quizzes and collections.

import { h, add, api, busy, modal, field, chip, empty, toast } from './ui.js';
import { icon, illustration, ring } from './icons.js';
import { state, go } from './state.js';
import { shareDialog } from './share.js';

const BADGE_ICONS = {
  first_quiz: 'play', perfect: 'star', improved: 'refresh', practice: 'dumbbell', fixed10: 'target', streak3: 'flame',
  streak7: 'flame', quizzes10: 'trophy', collections5: 'layers', pages10: 'camera', sharer: 'users',
};
export const badgeIcon = (id) => icon(BADGE_ICONS[id] || 'medal');

/** Say it once when a badge has just been earned. */
export function celebrate(game) {
  for (const b of (game && game.fresh) || []) toast(`Nytt märke: ${b.name}!`, 'win');
}

/** Level, XP and streak in one calm strip. */
export function gameStrip(game, href) {
  const span = game.next - game.floor;
  const inner = h('div', { class: 'level-ring' }, ring((game.xp - game.floor) / span, 56, 6), h('span', { class: 'mono' }, String(game.level)));
  const alive = game.streak.current > 0;
  return h(href ? 'a' : 'div', { class: 'card game-strip', href },
    inner,
    h('div', { class: 'grow' },
      h('div', { class: 'strong' }, `Nivå ${game.level} · ${game.name}`),
      h('div', { class: 'muted small mono' }, `${game.xp} / ${game.next} XP`)),
    h('div', { class: `streak${alive ? ' on' : ''}${game.streak.today ? ' today' : ''}`, title: alive ? (game.streak.today ? 'Dagens pass är gjort' : 'Gör ett quiz i dag så lever din svit') : 'Gör ett quiz för att starta en svit' },
      icon('flame'), h('span', { class: 'mono' }, String(game.streak.current))));
}

/** Create or rename a collection. */
export function collectionDialog(existing, done) {
  const title = h('input', { maxlength: 80, required: true, placeholder: 'T.ex. Biologi kap. 3', value: existing ? existing.title : null });
  const description = h('input', { maxlength: 300, placeholder: 'Valfritt', value: existing ? existing.description : null });
  const save = h('button', { class: 'btn primary big wide', type: 'submit' }, existing ? 'Spara' : 'Skapa', icon('arrow'));
  const m = modal({
    title: existing ? 'Byt namn' : 'Ny samling',
    body: h('form', { class: 'stack', onsubmit: (e) => {
      e.preventDefault();
      busy(save, async () => {
        const body = { title: title.value, description: description.value };
        const r = await api(existing ? `/collections/${existing.id}/update` : '/collections', body);
        m.close();
        done(r.collection);
      });
    } }, field('Vad pluggar du?', title), field('Beskrivning', description), save),
  });
  title.focus();
}

export function quizRow(q, { own, onchange, ondelete }) {
  const meta = [`${q.questions} frågor`];
  if (q.best != null) meta.push(`bäst ${q.best} %`);
  if (q.from) meta.push(`från ${q.from}`);
  const shareBtn = own && h('button', { class: `icon-btn${q.is_public || q.shares ? ' active' : ''}`, type: 'button', 'aria-label': 'Dela quizet',
    onclick: () => shareDialog(q, (s) => { Object.assign(q, s); shareBtn.classList.toggle('active', Boolean(q.is_public || q.shares)); if (onchange) onchange(); }) }, icon('share'));
  return h('div', { class: 'quiz-row card' },
    h('a', { href: `/quiz/${q.id}`, class: 'quiz-main' },
      h('span', { class: `play-dot${q.attempts ? ' done' : ''}` }, icon(q.attempts ? 'refresh' : 'play')),
      h('span', { class: 'grow' },
        h('span', { class: 'strong clamp' }, q.title),
        h('span', { class: 'muted small' }, meta.join(' · '), q.demo && chip('Exempel', 'tiny')))),
    shareBtn,
    ondelete && h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Ta bort quizet', onclick: () => ondelete(q) }, icon('trash')));
}

export async function home() {
  const data = await api('/home');
  celebrate(data.game);
  const first = (state.user.display_name || state.user.username).split(' ')[0];
  const create = () => collectionDialog(null, (c) => go(`/c/${c.id}`));

  const collections = data.collections.length
    ? h('div', { class: 'grid' }, data.collections.map((c) =>
      h('a', { href: `/c/${c.id}`, class: 'card collection-card' },
        h('div', { class: 'cover' }, c.cover ? h('img', { src: `/api/pages/${c.cover}/image`, alt: '', loading: 'lazy' }) : icon('layers')),
        h('div', { class: 'collection-body' },
          h('div', { class: 'strong clamp' }, c.title),
          h('div', { class: 'counts muted mono' },
            h('span', { title: 'Sidor' }, icon('image'), String(c.pages)),
            h('span', { title: 'Quiz' }, icon('play'), String(c.quizzes)))))))
    : empty(illustration('scan'), 'Inget här än', 'Fota din första sida – resten sköter Quizla.');

  return add(h('div', { class: 'stack roomy' }), [
    h('h1', { class: 'hello' }, `Hej ${first}!`),
    gameStrip(data.game, '/stats'),
    h('button', { class: 'cta', type: 'button', onclick: create },
      h('span', { class: 'cta-icon' }, icon('camera')),
      h('span', { class: 'grow' }, h('span', { class: 'cta-title mono' }, 'Ny samling'), h('span', { class: 'cta-sub' }, 'Fota sidor – få ett quiz')),
      icon('plus')),
    data.quizzes.length > 0 && h('section', { class: 'stack' },
      h('h2', {}, 'Senaste quiz'),
      data.quizzes.map((q) => quizRow(q, { own: true }))),
    data.shared.length > 0 && h('section', { class: 'stack' },
      h('h2', {}, 'Delat med dig'),
      data.shared.map((q) => quizRow(q, { own: false }))),
    h('section', { class: 'stack' }, h('h2', {}, 'Samlingar'), collections),
  ]);
}
