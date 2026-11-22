// Statistics: how it is going, the level and the badges, the last attempts as a chart, and the topics.

import { h, add, api, modal, empty, dateText } from './ui.js';
import { icon, illustration, svg } from './icons.js';
import { gameStrip, badgeIcon, celebrate } from './home.js';

/** The last attempts as a line of dots, 0–100 %. Drawn here; orange = quiz, blue = practice. */
function chart(points) {
  const W = 340;
  const H = 150;
  const left = 30;
  const right = 10;
  const top = 12;
  const bottom = 16;
  const x = (i) => (points.length === 1 ? (left + W - right) / 2 : left + (i * (W - left - right)) / (points.length - 1));
  const y = (pct) => top + ((100 - pct) * (H - top - bottom)) / 100;
  const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `Resultat på de senaste ${points.length} försöken` });
  for (const level of [0, 50, 100]) {
    el.appendChild(svg('line', { x1: left, x2: W - right, y1: y(level), y2: y(level), class: 'chart-grid' }));
    const label = svg('text', { x: left - 6, y: y(level) + 4, class: 'chart-label', 'text-anchor': 'end' });
    label.textContent = String(level);
    el.appendChild(label);
  }
  if (points.length > 1) {
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.pct).toFixed(1)}`).join(' ');
    el.appendChild(svg('path', { d: `${line} L${x(points.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`, class: 'chart-area' }));
    el.appendChild(svg('path', { d: line, class: 'chart-line' }));
  }
  points.forEach((p, i) => {
    const dot = svg('circle', { cx: x(i), cy: y(p.pct), r: 4.5, class: `chart-dot ${p.kind}` });
    const tip = svg('title');
    tip.textContent = `${p.title}: ${p.score}/${p.total}`;
    dot.appendChild(tip);
    el.appendChild(dot);
  });
  return el;
}

function badgeTile(b) {
  return h('button', { class: `badge-tile${b.earned ? ' earned' : ''}`, type: 'button', onclick: () => modal({ title: b.name,
    body: h('div', { class: 'stack center-text' }, h('div', { class: `badge-icon huge ${b.earned ? 'orange' : ''}` }, badgeIcon(b.id)),
      h('p', {}, b.description), h('p', { class: 'muted small mono' }, b.earned ? `Klarat ${dateText(b.earned_at)}` : `${b.have}/${b.target}`)) }) },
  h('span', { class: `badge-icon big ${b.earned ? 'orange' : ''}` }, badgeIcon(b.id)),
  h('span', { class: 'small strong' }, b.name),
  !b.earned && b.target > 1 && h('span', { class: 'muted tiny mono' }, `${b.have}/${b.target}`));
}

export async function stats() {
  const data = await api('/stats');
  celebrate(data.game);
  const tile = (ic, value, label, cls) => h('div', { class: 'card stat' }, h('div', { class: `badge-icon ${cls}` }, icon(ic)),
    h('span', { class: 'mono stat-num' }, value), h('span', { class: 'muted small' }, label));
  const earned = data.game.badges.filter((b) => b.earned).length;

  return add(h('div', { class: 'stack roomy' }), [
    h('h1', {}, 'Statistik'),
    h('div', { class: 'trio' },
      tile('check', String(data.done), 'quiz gjorda', 'blue'),
      tile('target', data.average == null ? '–' : `${data.average} %`, 'i snitt', 'orange'),
      tile('flame', String(data.game.streak.current), data.game.streak.current === 1 ? 'dag i rad' : 'dagar i rad', data.game.streak.current ? 'orange' : '')),
    gameStrip(data.game),
    h('details', { class: 'how' }, h('summary', {}, icon('info'), 'Så får du XP'),
      h('ul', { class: 'checks' },
        h('li', {}, icon('play'), h('span', {}, 'Nytt quiz: 20 XP, plus upp till 80 efter hur många rätt du får.')),
        h('li', {}, icon('refresh'), h('span', {}, 'Gör om ett quiz: XP för det du förbättrar – inte för att trycka en gång till.')),
        h('li', {}, icon('dumbbell'), h('span', {}, 'Öva på det svåra: 8 XP för varje fråga du nu klarar som du haft fel på.')),
        h('li', {}, icon('flame'), h('span', {}, 'Sviten räknar dagar i rad med minst ett gjort quiz.')))),
    !data.done && empty(illustration('trophy'), 'Här växer din statistik', 'Gör ditt första quiz, så syns det här.', h('a', { href: '/', class: 'btn primary' }, icon('home'), 'Till start')),
    data.chart.length > 0 && h('section', { class: 'stack' }, h('h2', {}, 'Senaste försöken'),
      h('div', { class: 'card' }, chart(data.chart),
        h('div', { class: 'row wrap legend muted small' }, h('span', {}, h('i', { class: 'dot quiz' }), 'Quiz'), h('span', {}, h('i', { class: 'dot practice' }), 'Öva på det svåra')))),
    h('section', { class: 'stack' }, h('h2', {}, 'Märken ', h('span', { class: 'muted mono small' }, `${earned}/${data.game.badges.length}`)),
      h('div', { class: 'badges' }, data.game.badges.map(badgeTile))),
    data.topics.length > 0 && h('section', { class: 'stack' }, h('h2', {}, 'Dina ämnen'),
      h('div', { class: 'card stack' }, data.topics.map((t) => h('div', { class: 'topic-bar' },
        h('div', { class: 'row' }, h('span', { class: 'grow strong clamp' }, t.topic), h('span', { class: 'mono small' }, `${t.pct} %`)),
        h('div', { class: `bar ${t.pct >= 80 ? 'ok' : t.pct >= 50 ? '' : 'bad'}`, role: 'img', 'aria-label': `${t.correct} av ${t.total} rätt` }, h('i', { style: { width: `${Math.max(3, t.pct)}%` } })))))),
    data.recent.length > 0 && h('section', { class: 'stack' }, h('h2', {}, 'Historik'),
      h('div', { class: 'card list' }, data.recent.map((a) => h(a.quiz ? 'a' : 'div', { class: 'list-row', href: a.quiz ? `/quiz/${a.quiz}` : null },
        h('span', { class: `badge-icon ${a.kind === 'practice' ? 'blue' : 'orange'}` }, icon(a.kind === 'practice' ? 'dumbbell' : 'play')),
        h('span', { class: 'grow' }, h('span', { class: 'strong clamp' }, a.title || 'Borttaget quiz'), h('span', { class: 'muted small' }, dateText(a.at), a.xp ? ` · +${a.xp} XP` : '')),
        h('span', { class: 'mono strong' }, `${a.score}/${a.total}`))))),
  ]);
}
