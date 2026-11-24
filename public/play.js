// Playing: one question per screen, then the result and the review. The same player runs a quiz
// and "Öva på det svåra". The browser never holds the right answers while a quiz is being played:
// it sends the chosen option ids and the server grades.

import { h, add, clear, api, oops, busy, confirmDialog, chip } from './ui.js';
import { icon, ring, illustration } from './icons.js';
import { state, go, DEMO_NOTE } from './state.js';
import { badgeIcon } from './home.js';
import { shareDialog } from './share.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const saved = (token) => { try { return JSON.parse(sessionStorage.getItem(`quizla:a:${token}`)) || {}; } catch (e) { return {}; } };
const save = (token, answers) => { try { sessionStorage.setItem(`quizla:a:${token}`, JSON.stringify(answers)); } catch (e) { /* private mode */ } };
const forget = (token) => { try { sessionStorage.removeItem(`quizla:a:${token}`); } catch (e) { /* private mode */ } };
// skolappar's usage snippet (kotten.js): anonymous counts only, never answers or names.
const report = (name, value) => { try { window.skolappar?.event(name, value); } catch (e) { /* the app works without it */ } };

// ---------------------------------------------------------------- the player

function player(ctx, { attempt, questions, exit, done }) {
  const answers = saved(attempt.token);
  const total = questions.length;
  let index = Math.max(0, questions.findIndex((q) => !answers[q.id]));
  if (index >= total) index = total - 1;

  const fill = h('i', {});
  const counter = h('span', { class: 'mono counter' });
  const area = h('div', { class: 'q-area' });
  const prev = h('button', { class: 'btn big', type: 'button', onclick: () => move(-1) }, icon('left'), h('span', { class: 'wide-only' }, 'Föregående'));
  const next = h('button', { class: 'btn primary big grow', type: 'button' });
  const el = h('div', { class: 'play' },
    h('div', { class: 'play-top' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Avsluta', onclick: leave }, icon('x')),
      h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total) }, fill),
      counter),
    area,
    h('div', { class: 'play-nav' }, prev, next));

  function draw(direction = 0) {
    const q = questions[index];
    const last = index === total - 1;
    fill.style.width = `${Math.round(((index + 1) / total) * 100)}%`;
    fill.parentNode.setAttribute('aria-valuenow', String(index + 1));
    counter.textContent = `${index + 1}/${total}`;
    prev.disabled = index === 0;
    clear(next);
    add(next, last ? ['Lämna in', icon('check')] : ['Nästa', icon('right')]);
    next.onclick = last ? submit : () => move(1);

    const options = h('div', { class: 'options', role: 'radiogroup', 'aria-label': 'Svar' });
    q.options.forEach((o, i) => {
      const b = h('button', { type: 'button', class: `option${answers[q.id] === o.id ? ' on' : ''}`, role: 'radio', 'aria-checked': String(answers[q.id] === o.id),
        onclick: () => {
          answers[q.id] = o.id;
          save(attempt.token, answers);
          for (const x of options.children) { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); }
        } }, h('span', { class: 'letter mono' }, LETTERS[i] || '?'), h('span', { class: 'grow' }, o.text));
      options.appendChild(b);
    });
    clear(area);
    area.className = `q-area${direction > 0 ? ' from-right' : direction < 0 ? ' from-left' : ''}`;
    add(area, [q.topic && chip(q.topic, 'blue'), h('h1', { class: 'question' }, q.text), options]);
  }

  function move(step) {
    const to = index + step;
    if (to < 0 || to >= total) return;
    index = to;
    draw(step);
  }

  async function leave() {
    const ok = await confirmDialog({ title: 'Avsluta quizet?', text: 'Dina svar sparas på den här enheten en stund, så du kan fortsätta senare.', ok: 'Avsluta', iconName: 'logout' });
    if (ok) exit();
  }

  async function submit() {
    const open = questions.filter((q) => !answers[q.id]).length;
    if (open) {
      const ok = await confirmDialog({ title: 'Lämna in ändå?', text: open === 1 ? 'Du har hoppat över en fråga. Den räknas som fel.' : `Du har hoppat över ${open} frågor. De räknas som fel.`, ok: 'Lämna in', iconName: 'info' });
      if (!ok) return;
    }
    busy(next, async () => {
      const r = await api(`/attempts/${attempt.token}/submit`, { answers });
      forget(attempt.token);
      report('round_done', r.result.pct);
      done(r);
    });
  }

  // Swipe on touch screens, arrows and A–D / 1–4 on a keyboard.
  let touch = null;
  area.addEventListener('touchstart', (e) => { touch = e.changedTouches[0]; }, { passive: true, signal: ctx.signal });
  area.addEventListener('touchend', (e) => {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch.clientX;
    const dy = e.changedTouches[0].clientY - touch.clientY;
    touch = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
  }, { passive: true, signal: ctx.signal });
  document.addEventListener('keydown', (e) => {
    if (!el.isConnected || document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight') move(1);
    else if (e.key === 'ArrowLeft') move(-1);
    else {
      const i = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
      const buttons = area.querySelectorAll('.option');
      if (i >= 0 && buttons[i] && e.key.length === 1) buttons[i].click();
    }
  }, { signal: ctx.signal });

  report('round_start');
  draw();
  return el;
}

// ---------------------------------------------------------------- the result

const HEADLINES = [[100, 'Alla rätt!'], [80, 'Riktigt bra!'], [50, 'Bra jobbat!'], [0, 'Bra kämpat – nu vet du vad du ska öva på.']];
const LIKELY = { very_high: 'Kommer nästan säkert på provet', high: 'Kommer troligen på provet' };

function scoreRing(result) {
  return h('div', { class: `score ${result.pct >= 80 ? 'great' : result.pct >= 50 ? 'ok' : 'low'}` }, ring(result.total ? result.score / result.total : 0, 168, 14),
    h('div', { class: 'score-text' }, h('span', { class: 'mono score-num' }, `${result.score}/${result.total}`), h('span', { class: 'muted small mono' }, `${result.pct} % rätt`)));
}

function reviewCard(item, n) {
  const details = h('div', { class: 'why', hidden: true },
    item.explanation && h('p', {}, item.explanation),
    item.misconception && h('div', { class: 'callout red' }, icon('alert'), h('div', {}, h('strong', {}, 'Vanligt misstag'), h('p', {}, item.misconception))),
    item.exam_tip && h('div', { class: 'callout blue' }, icon('bulb'), h('div', {}, h('strong', {}, 'Provtips'), h('p', {}, item.exam_tip))),
    h('div', { class: 'row wrap' }, LIKELY[item.exam_likelihood] && chip(LIKELY[item.exam_likelihood], 'orange', 'flame'), item.page_references.map((p) => chip(p, '', 'file'))));
  const has = item.explanation || item.misconception || item.exam_tip;
  const why = has && h('button', { class: 'btn small', type: 'button', 'aria-expanded': 'false', onclick: () => {
    details.hidden = !details.hidden;
    why.setAttribute('aria-expanded', String(!details.hidden));
    why.classList.toggle('open', !details.hidden);
  } }, icon('bulb'), 'Varför?', icon('down', 'turn'));
  return h('article', { class: `card review ${item.is_correct ? 'right' : 'wrong'}` },
    h('div', { class: 'row start' },
      h('span', { class: `mark ${item.is_correct ? 'ok' : 'bad'}`, 'aria-label': item.is_correct ? 'Rätt' : 'Fel' }, icon(item.is_correct ? 'check' : 'x')),
      h('div', { class: 'grow' }, h('span', { class: 'muted small mono' }, `Fråga ${n}${item.topic ? ` · ${item.topic}` : ''}`), h('h3', {}, item.text))),
    h('ul', { class: 'answers' }, item.options.filter((o) => o.id === item.correct || o.id === item.selected).map((o) => {
      const right = o.id === item.correct;
      return h('li', { class: right ? 'ok' : 'bad' }, icon(right ? 'check' : 'x'),
        h('div', {}, h('span', { class: 'small muted' }, right ? (o.id === item.selected ? 'Ditt svar – rätt!' : 'Rätt svar') : 'Ditt svar'), h('div', {}, o.text)));
    }), !item.selected && h('li', { class: 'bad' }, icon('x'), h('div', {}, h('span', { class: 'small muted' }, 'Ditt svar'), h('div', {}, 'Inget svar')))),
    why, details);
}

function resultView({ result, game, back, retry, quiz, note }) {
  const headline = HEADLINES.find(([min]) => result.pct >= min)[1];
  const rewards = [];
  if (game) {
    const leveled = result.xp > 0 && game.xp - result.xp < game.floor;
    if (leveled) report('level', game.level);
    rewards.push(h('div', { class: 'row wrap center' },
      result.xp > 0 && h('span', { class: 'xp mono' }, icon('bolt', 'fill'), `+${result.xp} XP`),
      result.improved && chip('Nytt rekord', 'orange', 'refresh'),
      result.fixed > 0 && chip(result.fixed === 1 ? '1 knäckt nöt' : `${result.fixed} knäckta nötter`, 'blue', 'target'),
      leveled && chip(`Nivå ${game.level} · ${game.name}`, 'orange', 'star'),
      game.streak.current > 0 && chip(game.streak.current === 1 ? 'Dag 1 i sviten' : `${game.streak.current} dagar i rad`, '', 'flame')));
    if (game.fresh.length) {
      rewards.push(h('div', { class: 'new-badges' }, game.fresh.map((b) =>
        h('div', { class: 'card new-badge' }, h('div', { class: 'badge-icon big orange pop' }, badgeIcon(b.id)),
          h('div', {}, h('span', { class: 'muted small' }, 'Nytt märke'), h('div', { class: 'strong' }, b.name))))));
    }
  }
  const wrong = result.review ? result.review.filter((r) => !r.is_correct).length : 0;
  return add(h('div', { class: 'stack roomy result' }), [
    h('div', { class: 'row' }, h('a', { href: back, class: 'icon-btn', 'aria-label': 'Tillbaka' }, icon('left')), h('h1', { class: 'grow' }, result.title),
      quiz && quiz.role === 'owner' && h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Dela quizet', onclick: () => shareDialog(quiz) }, icon('share'))),
    note,
    h('div', { class: 'card result-card' }, scoreRing(result), h('h2', {}, headline), rewards,
      result.topics && result.topics.length > 1 && h('div', { class: 'row wrap center' },
        result.topics.filter((t) => t.topic).map((t) => chip(`${t.topic} ${t.correct}/${t.total}`, t.correct === t.total ? 'ok' : t.correct === 0 ? 'bad' : ''))),
      h('div', { class: 'duo' },
        retry && h('button', { class: 'btn primary big', type: 'button', onclick: (e) => busy(e.currentTarget, retry) }, icon('refresh'), result.kind === 'practice' ? 'Öva igen' : 'Försök igen'),
        h('a', { href: back, class: 'btn big' }, icon(back === '/' ? 'home' : 'layers'), back === '/' ? 'Hem' : 'Till samlingen'))),
    result.review && h('section', { class: 'stack' },
      h('h2', {}, 'Gå igenom svaren ', h('span', { class: 'muted mono small' }, wrong ? `${wrong} att lära av` : 'allt satt')),
      result.review.map((item, i) => reviewCard(item, i + 1))),
  ]);
}

// ---------------------------------------------------------------- a quiz (also without an account, when it is public)

export async function quiz(ctx, slug) {
  const info = await api(`/quizzes/${slug}`);
  const q = info.quiz;
  const box = h('div', { class: 'play-wrap' });
  const show = (node) => { clear(box).appendChild(node); window.scrollTo(0, 0); };
  const back = q.role === 'owner' ? `/c/${q.collection_id}` : '/';
  const demoNote = () => q.demo && h('p', { class: 'note' }, icon('info'), h('span', {}, state.ai ? 'Det här är ett exempelquiz om fotosyntesen.' : DEMO_NOTE));
  const anonymous = !state.user;
  const resumeKey = `quizla:open:${slug}`;

  async function start() {
    const body = {};
    if (anonymous) { try { body.resume = sessionStorage.getItem(resumeKey) || undefined; } catch (e) { /* private mode */ } }
    const r = await api(`/quizzes/${slug}/start`, body);
    if (ctx.signal.aborted) return;
    if (anonymous) { try { sessionStorage.setItem(resumeKey, r.attempt.token); } catch (e) { /* private mode */ } }
    if (!r.questions.length) throw new Error('Quizet har inga frågor.');
    show(player(ctx, { attempt: r.attempt, questions: r.questions, exit: () => go(back),
      done: (res) => {
        if (anonymous) { try { sessionStorage.removeItem(resumeKey); } catch (e) { /* private mode */ } }
        show(anonymous ? anonymousResult(res.result) : resultView({ result: res.result, game: res.game, back, retry: start, quiz: q, note: demoNote() }));
      } }));
  }

  // Without an account: the score only, and an honest pitch for why an account is worth it.
  function anonymousResult(result) {
    const join = (mode) => { try { sessionStorage.setItem('quizla:auth', mode); } catch (e) { /* private mode */ } state.wantAuth = true; go(ctx.path); };
    return h('div', { class: 'stack roomy result' },
      h('div', { class: 'card result-card' }, scoreRing(result), h('h2', {}, HEADLINES.find(([min]) => result.pct >= min)[1]),
        h('button', { class: 'btn big', type: 'button', onclick: (e) => busy(e.currentTarget, start) }, icon('refresh'), 'Försök igen')),
      h('div', { class: 'card pitch' }, h('div', { class: 'badge-icon big orange' }, icon('bulb')),
        h('h2', {}, 'Vill du se vad som var rätt?'),
        h('p', { class: 'muted' }, 'Med ett konto ser du rätt svar, förklaringar och provtips efter varje quiz – och dina resultat sparas. Inget mejl behövs.'),
        h('button', { class: 'btn primary big wide', type: 'button', onclick: () => join('signup') }, 'Skapa konto', icon('arrow')),
        h('button', { class: 'link-btn', type: 'button', onclick: () => join('login') }, 'Jag har redan ett konto')));
  }

  if (anonymous) {
    show(h('div', { class: 'stack roomy intro' },
      h('div', { class: 'card result-card' }, illustration('quiz'), h('h1', {}, q.title), q.description && h('p', { class: 'muted' }, q.description),
        h('div', { class: 'row wrap center' }, chip(`${q.questions} frågor`, '', 'file'), q.demo && chip('Exempel')),
        h('button', { class: 'btn primary big wide', type: 'button', onclick: (e) => busy(e.currentTarget, start) }, icon('play'), 'Starta')),
      h('p', { class: 'note' }, icon('info'), h('span', {}, 'Du spelar utan konto. Skapa ett konto efteråt om du vill spara resultatet och se förklaringarna.'))));
  } else if (info.latest && !ctx.query.again) {
    show(resultView({ result: info.latest, game: null, back, retry: start, quiz: q, note: demoNote() }));
  } else {
    await start();
  }
  return box;
}

// ---------------------------------------------------------------- "Öva på det svåra"

export async function practice(ctx, cid) {
  const box = h('div', { class: 'play-wrap' });
  const show = (node) => { clear(box).appendChild(node); window.scrollTo(0, 0); };
  const back = `/c/${cid}`;

  async function start() {
    let r;
    try {
      r = await api(`/collections/${cid}/practice`, {});
    } catch (e) {
      if (e.status !== 400) throw e;
      // Nothing left that was answered wrong: that is the goal, so say it nicely.
      show(h('div', { class: 'stack roomy' }, h('div', { class: 'card result-card' }, illustration('trophy'), h('h1', {}, 'Inget svårt kvar!'),
        h('p', { class: 'muted' }, 'Du har rättat till allt du haft fel på. Gör ett nytt quiz så hittar vi nya nötter.'),
        h('a', { href: back, class: 'btn primary big wide' }, icon('layers'), 'Till samlingen'))));
      return;
    }
    if (ctx.signal.aborted) return;
    show(player(ctx, { attempt: r.attempt, questions: r.questions, exit: () => go(back),
      done: (res) => show(resultView({ result: res.result, game: res.game, back, retry: start })) }));
  }
  await start();
  return box;
}
