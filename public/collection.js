// A collection: its pages (photos), the one next thing to do (scan → read → make a quiz),
// shortcuts to study and to practise what was hard, and its quizzes.

import { h, add, clear, api, oops, busy, modal, confirmDialog, toast, chip, shrinkImage } from './ui.js';
import { icon, illustration } from './icons.js';
import { state, go, DEMO_NOTE } from './state.js';
import { collectionDialog, quizRow } from './home.js';

export const PAGE_TYPES = {
  content: { label: 'Studiematerial', icon: 'book', hint: 'Det du ska kunna – frågorna görs härifrån.' },
  learning_objectives: { label: 'Lärandemål', icon: 'flag', hint: 'Målen från läraren – de styr vad quizet tar upp.' },
  reference: { label: 'Referens', icon: 'bookmark', hint: 'Bakgrund – används som stöd, inga frågor ställs på den.' },
};
const STATUS = {
  pending: { icon: 'clock', label: 'Väntar på att läsas', cls: 'wait' },
  analyzed: { icon: 'check', label: 'Läst', cls: 'ok' },
  failed: { icon: 'alert', label: 'Gick inte att läsa', cls: 'bad' },
};

export async function collection(ctx, cid) {
  let data = await api(`/collections/${cid}`);
  state.ai = data.ai.configured;
  let mode = 'idle';                 // idle | uploading | reading | writing
  let note = '';

  const head = h('div', { class: 'stack tight' });
  const stepBox = h('section', { class: 'card step-card' });
  const shortcuts = h('div', { class: 'duo' });
  const quizBox = h('section', { class: 'stack' });
  const grid = h('div', { class: 'pages' });
  const pagesHead = h('h2', {});
  const tiles = new Map();

  // The two ways in: the camera, or several pictures from the library.
  const pick = (attrs) => h('input', { type: 'file', accept: 'image/*', hidden: true, ...attrs,
    onchange: (e) => { const files = [...e.target.files]; e.target.value = ''; upload(files); } });
  const cameraInput = pick({ capture: 'environment' });
  const libraryInput = pick({ multiple: true });

  // ---- head
  function drawHead() {
    const c = data.collection;
    clear(head);
    add(head, [
      h('div', { class: 'row' },
        h('a', { href: '/', class: 'icon-btn', 'aria-label': 'Tillbaka' }, icon('left')),
        h('h1', { class: 'grow clamp' }, c.title),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Byt namn', onclick: () => collectionDialog(c, (r) => { Object.assign(c, r); drawHead(); }) }, icon('pencil')),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Ta bort samlingen', onclick: removeCollection }, icon('trash'))),
      c.description && h('p', { class: 'muted' }, c.description),
    ]);
  }

  async function removeCollection() {
    const ok = await confirmDialog({ title: 'Ta bort samlingen?', text: 'Alla sidor och quiz i samlingen försvinner. Det går inte att ångra.', ok: 'Ta bort', danger: true, iconName: 'trash' });
    if (!ok) return;
    try {
      await api(`/collections/${cid}/delete`, {});
      toast('Samlingen är borta.');
      go('/', { replace: true });
    } catch (e) { oops(e); }
  }

  // ---- the one clear thing to do
  function drawStep() {
    const p = data.progress;
    clear(stepBox);
    stepBox.className = `card step-card ${mode}`;
    if (mode === 'reading' || mode === 'writing' || mode === 'uploading') {
      const share = mode === 'reading' && p.total ? p.done / p.total : null;
      add(stepBox, [
        h('div', { class: 'badge-icon big orange pulse' }, icon(mode === 'uploading' ? 'camera' : 'sparkles')),
        h('h2', { class: 'mono' }, note),
        h('div', { class: `bar${share === null ? ' endless' : ''}` }, h('i', { style: { width: `${Math.round((share === null ? 0.35 : share) * 100)}%` } })),
        mode === 'writing' && h('p', { class: 'muted small' }, 'En lärare med tjugo års vana tänker efter. Det kan ta upp till en minut.'),
      ]);
      return;
    }
    if (!p.total) {
      add(stepBox, [
        illustration('scan'),
        h('h2', {}, 'Fota dina sidor'),
        h('p', { class: 'muted' }, 'Boksidor, anteckningar eller stenciler – en bild per sida.'),
        h('div', { class: 'duo' },
          h('button', { class: 'btn primary big', type: 'button', onclick: () => cameraInput.click() }, icon('camera'), 'Kamera'),
          h('button', { class: 'btn big', type: 'button', onclick: () => libraryInput.click() }, icon('image'), 'Välj bilder')),
      ]);
      return;
    }
    const waiting = p.remaining + p.failed;
    if (waiting) {
      const btn = h('button', { class: 'btn primary big wide', type: 'button', onclick: read }, icon('sparkles'), 'Läs & analysera');
      add(stepBox, [
        h('div', { class: 'row' }, h('div', { class: 'badge-icon big orange' }, icon('sparkles')),
          h('div', { class: 'grow' }, h('h2', {}, waiting === 1 ? '1 sida väntar' : `${waiting} sidor väntar`),
            h('p', { class: 'muted small' }, p.failed ? 'Några gick inte att läsa – vi försöker igen.' : 'Quizla läser sidorna och plockar ut det viktiga.'))),
        btn,
      ]);
      return;
    }
    const full = data.quizzes.length >= data.limits.quizzes;
    add(stepBox, [
      h('div', { class: 'row' }, h('div', { class: 'badge-icon big orange' }, icon('bolt', 'fill')),
        h('div', { class: 'grow' }, h('h2', {}, data.quizzes.length ? 'Dags för ett nytt quiz?' : 'Redo för quiz!'),
          h('p', { class: 'muted small' }, data.quizzes.length ? 'Nya frågor, nya vinklar på samma sidor.' : `${p.analyzed} ${p.analyzed === 1 ? 'sida är läst' : 'sidor är lästa'}. Nu gör vi frågor av dem.`))),
      h('button', { class: `btn ${full ? '' : 'primary'} big wide`, type: 'button', onclick: write }, icon('sparkles'), 'Skapa quiz'),
    ]);
  }

  function drawShortcuts() {
    clear(shortcuts);
    if (!data.progress.analyzed) { shortcuts.hidden = true; return; }
    shortcuts.hidden = false;
    add(shortcuts, [
      h('a', { href: `/c/${cid}/study`, class: 'card tile-link' }, h('div', { class: 'badge-icon blue' }, icon('book')),
        h('span', { class: 'strong' }, 'Plugga'), h('span', { class: 'muted small' }, 'Allt det viktiga')),
      h(data.hard ? 'a' : 'div', { href: data.hard ? `/c/${cid}/practice` : null, class: `card tile-link${data.hard ? '' : ' off'}` },
        h('div', { class: `badge-icon ${data.hard ? 'orange' : ''}` }, icon('dumbbell')),
        h('span', { class: 'strong' }, 'Öva på det svåra'),
        h('span', { class: 'muted small' }, data.hard ? (data.hard === 1 ? '1 fråga att knäcka' : `${data.hard} frågor att knäcka`) : 'Fylls på när du gjort ett quiz')),
    ]);
  }

  // ---- quizzes
  function drawQuizzes() {
    clear(quizBox);
    if (!data.quizzes.length) { quizBox.hidden = true; return; }
    quizBox.hidden = false;
    add(quizBox, [h('h2', {}, 'Quiz'), data.quizzes.map((q) => quizRow(q, { own: true, ondelete: removeQuiz }))]);
  }

  async function removeQuiz(q) {
    const ok = await confirmDialog({ title: 'Ta bort quizet?', text: `"${q.title}" tas bort för alla som har det. Dina poäng och din svit finns kvar.`, ok: 'Ta bort', danger: true, iconName: 'trash' });
    if (!ok) return;
    try {
      await api(`/quizzes/${q.id}/delete`, {});
      await reload();
    } catch (e) { oops(e); }
  }

  // ---- pages
  function tile(page) {
    const type = PAGE_TYPES[page.type] || PAGE_TYPES.content;
    const st = STATUS[page.status] || STATUS.pending;
    const el = h('button', { class: 'page', type: 'button', 'aria-label': `Sida ${page.number}, ${type.label}, ${st.label}`, onclick: () => pageDialog(page) },
      h('img', { src: `/api/pages/${page.id}/image`, alt: '', loading: 'lazy' }),
      h('span', { class: 'page-no mono' }, String(page.number)),
      h('span', { class: `page-type ${page.type}`, title: type.label }, icon(type.icon)),
      h('span', { class: `page-status ${st.cls}`, title: st.label }, icon(st.icon)));
    tiles.set(page.id, el);
    return el;
  }

  function updateTile(page) {
    const i = data.pages.findIndex((x) => x.id === page.id);
    if (i >= 0) data.pages[i] = page;
    const old = tiles.get(page.id);
    if (old) old.replaceWith(tile(page));
  }

  function drawPages() {
    clear(grid);
    tiles.clear();
    const any = data.pages.length > 0;
    pagesHead.hidden = !any;
    grid.hidden = !any;
    clear(pagesHead);
    add(pagesHead, ['Sidor ', h('span', { class: 'muted mono small' }, `${data.pages.length}/${data.limits.pages}`)]);
    if (!any) return;
    add(grid, [
      h('button', { class: 'page add', type: 'button', 'aria-label': 'Fota en sida', onclick: () => cameraInput.click() }, icon('camera'), h('span', {}, 'Kamera')),
      h('button', { class: 'page add', type: 'button', 'aria-label': 'Välj bilder', onclick: () => libraryInput.click() }, icon('image'), h('span', {}, 'Bilder')),
      data.pages.map(tile),
    ]);
  }

  function pageDialog(page) {
    const typeBox = h('div', { class: 'type-pick' });
    const hint = h('p', { class: 'muted small' });
    const status = h('div', { class: 'row wrap' });
    let m = null;
    const draw = () => {
      clear(typeBox);
      for (const [id, t] of Object.entries(PAGE_TYPES)) {
        const b = h('button', { type: 'button', class: page.type === id ? 'on' : '', 'aria-pressed': String(page.type === id), onclick: () => busy(b, async () => {
          if (page.type === id) return;
          const r = await api(`/pages/${page.id}/type`, { type: id });
          const again = page.status === 'analyzed' && r.page.status === 'pending';
          page = r.page;
          data.progress = r.progress;
          updateTile(page);
          drawStep();
          drawShortcuts();
          draw();
          if (again) toast('Sidan läses om med sin nya typ nästa gång du trycker Läs & analysera.');
        }) }, icon(t.icon), h('span', {}, t.label));
        typeBox.appendChild(b);
      }
      hint.textContent = PAGE_TYPES[page.type].hint;
      const st = STATUS[page.status];
      clear(status);
      add(status, [chip(st.label, st.cls, st.icon), page.demo && chip('Exempel'), page.topics.map((t) => chip(t, 'blue')),
        page.error && h('span', { class: 'muted small' }, page.error)]);
    };
    const del = h('button', { class: 'btn ghost danger-text', type: 'button', onclick: () => busy(del, async () => {
      const r = await api(`/pages/${page.id}/delete`, {});
      data.pages = data.pages.filter((x) => x.id !== page.id);
      data.progress = r.progress;
      m.close();
      await reload();
    }) }, icon('trash'), 'Ta bort sidan');
    draw();
    m = modal({
      title: `Sida ${page.number}`,
      wide: true,
      body: h('div', { class: 'stack' },
        h('img', { class: 'page-full', src: `/api/pages/${page.id}/image`, alt: `Sida ${page.number}` }),
        status,
        h('div', { class: 'stack tight' }, h('span', { class: 'label' }, 'Vad är det här för sida?'), typeBox, hint),
        del),
    });
  }

  // ---- actions
  async function upload(files) {
    const list = files.filter((f) => !f.type || f.type.startsWith('image/'));
    if (!list.length || mode !== 'idle') return;
    mode = 'uploading';
    let sent = 0;
    for (const file of list) {
      if (ctx.signal.aborted) return;
      note = list.length === 1 ? 'Laddar upp…' : `Laddar upp… (${sent + 1}/${list.length})`;
      drawStep();
      try {
        const image = await shrinkImage(file);
        const r = await api(`/collections/${cid}/pages`, { image });
        data.pages.push(r.page);
        data.progress = r.progress;
        sent++;
        if (data.pages.length === 1) drawPages(); else grid.appendChild(tile(r.page));
        clear(pagesHead);
        add(pagesHead, ['Sidor ', h('span', { class: 'muted mono small' }, `${data.pages.length}/${data.limits.pages}`)]);
      } catch (e) {
        oops(e);
        if (e.status === 403 || e.status === 429 || e.status === 0) break;      // full, too fast or offline: the rest would fail too
      }
    }
    mode = 'idle';
    if (ctx.signal.aborted) return;
    drawStep();
    if (sent) toast(sent === 1 ? 'Sidan är uppladdad.' : `${sent} sidor är uppladdade.`);
  }

  // The browser drives the analysis one page at a time; the pages' status lives on the server,
  // so leaving in the middle loses nothing – the button simply continues where it stopped.
  async function read() {
    if (mode !== 'idle') return;
    mode = 'reading';
    let first = true;
    let failsInARow = 0;
    try {
      for (;;) {
        const p = data.progress;
        const left = first ? p.remaining + p.failed : p.remaining;
        note = `Läser… (${Math.min(p.total, p.total - left + 1)}/${p.total})`;
        drawStep();
        const r = await api(`/collections/${cid}/analyze-next`, { retry: first });
        if (ctx.signal.aborted) return;
        first = false;
        data.progress = r;
        if (r.demo) state.ai = false;
        if (r.page) {
          updateTile(r.page);
          failsInARow = r.page.status === 'failed' ? failsInARow + 1 : 0;
        }
        if (!r.page || !r.remaining) break;
        if (failsInARow >= 2) { toast('Två sidor i rad gick inte att läsa. Vänta lite och försök igen.', 'error'); break; }
      }
    } catch (e) {
      if (ctx.signal.aborted) return;
      oops(e);
    }
    mode = 'idle';
    await reload();
    if (!data.progress.remaining && !data.progress.failed && data.progress.analyzed) toast('Klart! Alla sidor är lästa.', 'win');
  }

  async function write() {
    if (mode !== 'idle') return;
    mode = 'writing';
    note = 'Skriver frågor…';
    drawStep();
    try {
      const r = await api(`/collections/${cid}/quizzes`, {});
      if (ctx.signal.aborted) return;
      go(`/quiz/${r.quiz.id}`);
      return;
    } catch (e) {
      if (ctx.signal.aborted) return;
      oops(e);
    }
    mode = 'idle';
    drawStep();
  }

  async function reload() {
    try { data = await api(`/collections/${cid}`); } catch (e) { oops(e); }
    if (ctx.signal.aborted) return;
    drawAll();
  }

  const demo = h('p', { class: 'note' }, icon('info'), h('span', {}, DEMO_NOTE));
  function drawAll() {
    demo.hidden = state.ai;
    drawHead();
    drawStep();
    drawShortcuts();
    drawQuizzes();
    drawPages();
  }
  drawAll();
  return add(h('div', { class: 'stack roomy' }), [head, demo, stepBox, shortcuts, quizBox, h('section', { class: 'stack' }, pagesHead, grid), cameraInput, libraryInput]);
}
