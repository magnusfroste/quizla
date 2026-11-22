// Icons and small illustrations, drawn here as SVG nodes (no icon font, no images, no markup strings).
// An icon is a list of shapes on a 24×24 grid: a string is a path, an array is [tag, attributes].

const NS = 'http://www.w3.org/2000/svg';

export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of children) if (c) el.appendChild(c);
  return el;
}

const c = (cx, cy, r) => ['circle', { cx, cy, r }];
const r = (x, y, width, height, rx) => ['rect', { x, y, width, height, rx }];

const ICONS = {
  bolt: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
  home: ['M3 10.5L12 3l9 7.5', 'M5 9.5V21h14V9.5', 'M10 21v-6h4v6'],
  chart: ['M5 20v-8', 'M12 20V5', 'M19 20v-11', 'M3 20h18'],
  user: [c(12, 8, 4), 'M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7'],
  users: [c(9, 8, 3.5), 'M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6', 'M16 4.6a3.5 3.5 0 0 1 0 6.8', 'M18 14.3c2 .8 3.5 2.7 3.5 5.7'],
  plus: ['M12 5v14', 'M5 12h14'],
  camera: ['M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z', c(12, 13.5, 3.5)],
  image: [r(3, 4, 18, 16, 2), c(8.5, 9.5, 1.5), 'M21 16l-5-5-9 9'],
  book: ['M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z', 'M12 6v14'],
  sparkles: ['M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z', 'M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z'],
  play: ['M7 4l13 8-13 8z'],
  share: [c(18, 5, 3), c(6, 12, 3), c(18, 19, 3), 'M8.6 10.6l6.8-4.2', 'M8.6 13.4l6.8 4.2'],
  link: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  left: ['M15 5l-7 7 7 7'],
  right: ['M9 5l7 7-7 7'],
  down: ['M5 9l7 7 7-7'],
  search: [c(11, 11, 6), 'M20 20l-4.5-4.5'],
  flame: ['M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z'],
  trophy: ['M8 4h8v6a4 4 0 0 1-8 0z', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4', 'M12 14v4', 'M8 20h8'],
  star: ['M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z'],
  target: [c(12, 12, 9), c(12, 12, 5), c(12, 12, 1)],
  dumbbell: ['M6 7v10', 'M3 10v4', 'M18 7v10', 'M21 10v4', 'M6 12h12'],
  globe: [c(12, 12, 9), 'M3 12h18', 'M12 3c3.5 3 3.5 15 0 18', 'M12 3c-3.5 3-3.5 15 0 18'],
  lock: [r(5, 11, 14, 9, 2), 'M8 11V8a4 4 0 0 1 8 0v3'],
  copy: [r(9, 9, 11, 11, 2), 'M5 15V5a1 1 0 0 1 1-1h10'],
  logout: ['M10 4H5v16h5', 'M15 8l4 4-4 4', 'M19 12H9'],
  refresh: ['M4 11a8 8 0 0 1 14-4l2 2', 'M20 4v5h-5', 'M20 13a8 8 0 0 1-14 4l-2-2', 'M4 20v-5h5'],
  bulb: ['M9 18h6', 'M10 21h4', 'M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z'],
  alert: ['M12 4l9 16H3z', 'M12 10v4', 'M12 17v.5'],
  layers: ['M12 3l9 5-9 5-9-5z', 'M3 13l9 5 9-5'],
  flag: ['M5 21V4', 'M5 4h12l-2 4 2 4H5'],
  bookmark: ['M6 3h12v18l-6-4-6 4z'],
  clock: [c(12, 12, 9), 'M12 7v5l3 2'],
  medal: [c(12, 15, 5), 'M8 3l4 7 4-7'],
  pencil: ['M4 20l1-4L16 5l3 3L8 19z'],
  info: [c(12, 12, 9), 'M12 11v5', 'M12 8v.5'],
  file: ['M7 3h7l5 5v13H7z', 'M14 3v5h5', 'M10 13h6', 'M10 17h6'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  heart: ['M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z', c(12, 12, 3)],
};

/** icon('camera') – a 24px line icon that takes the text colour; pass a class for size or fill. */
export function icon(name, cls = '') {
  const el = svg('svg', { viewBox: '0 0 24 24', class: `icon ${cls}`.trim(), 'aria-hidden': 'true', focusable: 'false' });
  for (const shape of ICONS[name] || ICONS.info) {
    el.appendChild(typeof shape === 'string' ? svg('path', { d: shape }) : svg(shape[0], shape[1]));
  }
  return el;
}

/** The logo: the lightning bolt in an orange rounded square. */
export function logo(size = 36) {
  return svg('svg', { viewBox: '0 0 48 48', width: size, height: size, class: 'logo', role: 'img', 'aria-label': 'Quizla' },
    svg('rect', { x: 2, y: 2, width: 44, height: 44, rx: 13, fill: '#FF6A3D' }),
    svg('path', { d: 'M26 9L13 27h10l-2 12 14-18H25l1-12z', fill: '#1B1A18' }));
}

// ---- illustrations (colours come from the theme through CSS classes: .i-paper .i-line .i-orange .i-blue .i-ink)

const paper = (x, y, rot, lines = 4) => {
  const g = svg('g', { transform: `rotate(${rot} ${x + 30} ${y + 40})` },
    svg('rect', { x, y, width: 60, height: 80, rx: 7, class: 'i-paper' }));
  for (let i = 0; i < lines; i++) {
    g.appendChild(svg('rect', { x: x + 10, y: y + 14 + i * 13, width: i === lines - 1 ? 24 : 40, height: 5, rx: 2.5, class: i === 0 ? 'i-orange' : 'i-line' }));
  }
  return g;
};

const ILLUSTRATIONS = {
  // Pages of notes with a camera: "photograph your pages".
  scan: () => [
    paper(34, 26, -9), paper(64, 20, 6),
    svg('g', { transform: 'translate(98 74)' },
      svg('rect', { x: 0, y: 8, width: 52, height: 36, rx: 9, class: 'i-ink' }),
      svg('rect', { x: 16, y: 1, width: 20, height: 12, rx: 4, class: 'i-ink' }),
      svg('circle', { cx: 26, cy: 26, r: 10, class: 'i-orange' }),
      svg('circle', { cx: 26, cy: 26, r: 4.5, class: 'i-ink' })),
    svg('path', { d: 'M22 30l3 7 7 3-7 3-3 7-3-7-7-3 7-3z', class: 'i-blue' }),
  ],
  // Quiz cards with a tick: "nothing here yet, make a quiz".
  quiz: () => [
    svg('rect', { x: 28, y: 22, width: 124, height: 86, rx: 14, class: 'i-paper' }),
    svg('rect', { x: 42, y: 36, width: 70, height: 7, rx: 3.5, class: 'i-ink' }),
    ...[0, 1, 2].map((i) => svg('g', {},
      svg('rect', { x: 42, y: 54 + i * 16, width: 96, height: 11, rx: 5.5, class: i === 1 ? 'i-orange' : 'i-line' }))),
    svg('circle', { cx: 146, cy: 30, r: 16, class: 'i-blue' }),
    svg('path', { d: 'M138 30l6 6 10-11', class: 'i-stroke-light' }),
  ],
  // A trophy on a podium: statistics before the first quiz.
  trophy: () => [
    svg('rect', { x: 50, y: 98, width: 80, height: 12, rx: 6, class: 'i-line' }),
    svg('rect', { x: 78, y: 82, width: 24, height: 18, rx: 3, class: 'i-ink' }),
    svg('path', { d: 'M62 24h56v22a28 28 0 0 1-56 0z', class: 'i-orange' }),
    svg('path', { d: 'M62 30H46c0 16 8 24 20 26M118 30h16c0 16-8 24-20 26', class: 'i-stroke-ink' }),
    svg('path', { d: 'M90 34l3.5 7.5 8 1-6 5.6 1.6 8L90 52l-7.1 4.1 1.6-8-6-5.6 8-1z', class: 'i-ink' }),
    svg('path', { d: 'M30 40l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM150 62l2 5 5 2-5 2-2 5-2-5-5-2 5-2z', class: 'i-blue' }),
  ],
};

export function illustration(name) {
  return svg('svg', { viewBox: '0 0 180 130', class: 'illustration', 'aria-hidden': 'true' }, ...ILLUSTRATIONS[name]());
}

/** A ring that fills to `share` (0–1) with whatever is passed as its centre. */
export function ring(share, size = 132, stroke = 12, cls = '') {
  const rad = (size - stroke) / 2;
  const len = 2 * Math.PI * rad;
  return svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: `ring ${cls}`.trim(), 'aria-hidden': 'true' },
    svg('circle', { cx: size / 2, cy: size / 2, r: rad, class: 'ring-track', 'stroke-width': stroke }),
    share > 0 && svg('circle', { cx: size / 2, cy: size / 2, r: rad, class: 'ring-fill', 'stroke-width': stroke,
      'stroke-dasharray': `${len * Math.min(1, share)} ${len}`, transform: `rotate(-90 ${size / 2} ${size / 2})` }));
}
