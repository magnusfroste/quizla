'use strict';
// Walks the whole flow against a real server in demo mode (no AI key): accounts, a collection,
// pages, analysis, a quiz, server-side grading, retake, "Öva på det svåra", statistics, sharing,
// the public link without an account, access control between two users, limits, a restart in
// the middle of an analysis, and account deletion. Then once more with an AI configured – a
// stand-in endpoint inside this process – to check what is sent to the model and what is kept.
// No packages. Exits non-zero on a failure.
//
//   node test/api-test.js        (or: bash test/api-test.sh)

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const zlib = require('node:zlib');

const ROOT = path.join(__dirname, '..');
const { demoQuiz } = require('../lib/demo');

// A real 20×20 JPEG (made once with an image tool), and PNGs generated here.
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAFKADAAQAAAABAAAAFAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAFAAUAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAAv/aAAwDAQACEQMRAD8AoRaeZJ2tfEjPCYnAlK5sobeN0LOVyA+PKWTJJGSoRi6fK1nyLiW0bVLyS1EsDRxMbh42IJtSpYBUY7ZXEig7mRju3IrDcmlqmv2UmpXFhp2nwztEsVpBPc242xmQxOkQSKFj+6fzWCFjg5TcPMwMTUrnUVgsJXTz31Ul5IrgZRXYrtEqwRskkavvdQpPyN8q4bItzqV3TquD2j0s+jvbSyau2rN3e7S1MPhKkIOHJyu2iVrNJXdot3absui11Y46fFDNNIdMWS2mYG0eGPT2VrdFWKNs3VtJLltmcMR15AOaX7Paf9AqT/vzo/8A8hU+6F1pEu3QYLi2guVWVrf7bZW6wsAIwqLdJLKUKIrozFdysDsU5FV/7X8S/wB2f/waaV/8j1t9Wxy0hiIpdE+e69baX720OpZjGK5eVO3Vxd35vXd9T//QpBjNeXmk3BMqSoLlpGJEm9bpYTnbhW3qiFiyliy7s7sk5liTrqTTXoQf8U7LqSKkaBUa2UhIVypIiPmOSM7skEMNq40Y/wDkYp/+vQ/+lxrO8L/8e0v/AGJl7/Ja9Chp7W3T2dvK8It2+bb9Xc4HiKs6seabfXd7uMU380kn6I5W18UeI7gzpBqD2aW0pt1SCOIKUiAVOGRsbUCoAuFCqOM5Jtf2/wCKf+g3c/8AfFv/APGq5fSvv3//AF+S/wBK1q5qdWcYKMZNJHqVsHh/aS/drd9Ef//Z';

function png(seed, size = 20) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let x = seed + 1;
  for (let i = 0; i < raw.length; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;              // noise, so the file is not tiny
    raw[i] = i % (size * 3 + 1) === 0 ? 0 : (x >>> 16) & 0xff;   // each row starts with filter type 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const file = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  return `data:image/png;base64,${file.toString('base64')}`;
}

// ---------------------------------------------------------------- a tiny test frame

let passed = 0;
let failed = 0;
function ok(condition, what, detail) {
  if (condition) { passed++; console.log(`  ok    ${what}`); } else { failed++; console.log(`  FAIL  ${what}${detail === undefined ? '' : ` -> ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`); }
}
const eq = (got, want, what) => ok(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = (name) => console.log(`\n${name}`);

let base = '';
function client() {
  let cookie = '';
  const call = async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of set) if (c.startsWith('sid=')) cookie = c.split(';')[0] === 'sid=' ? '' : c.split(';')[0];
    const type = res.headers.get('content-type') || '';
    const raw = Buffer.from(await res.arrayBuffer());
    let json = null;
    if (type.includes('application/json')) { try { json = JSON.parse(raw.toString('utf8')); } catch (e) { /* not JSON */ } }
    return { status: res.status, json, raw, type, text: raw.toString('utf8'), headers: res.headers };
  };
  return { get: (url) => call('GET', url), post: (url, body = {}) => call('POST', url, body) };
}

const freePort = () => new Promise((resolve) => {
  const s = net.createServer();
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

let child = null;
let log = '';
async function startServer(dataDir, port, extra = {}) {
  const env = { ...process.env, PORT: String(port), DATA_DIR: dataDir };
  for (const k of ['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL', 'AI_DAILY_LIMIT']) delete env[k];   // demo mode: nothing is sent anywhere
  Object.assign(env, extra);
  child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/healthz`)).ok) return; } catch (e) { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`the server did not start:\n${log}`);
}
const stopServer = () => new Promise((resolve) => {
  if (!child || child.exitCode !== null) return resolve();
  child.once('exit', resolve);
  child.kill('SIGTERM');
});

/** Every key anywhere in a JSON value. */
function keysOf(value, into = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => keysOf(v, into));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { into.add(k); keysOf(v, into); }
  return into;
}

// The demo quiz is known, so the test knows the right answers without asking the server.
const KEY = new Map();
for (const n of [0, 1, 2]) for (const q of demoQuiz(n).questions) KEY.set(q.question, q);
const SECRETS = [...KEY.values()].flatMap((q) => [q.explanation, q.misconception_targeted, q.exam_tip]);

/** Answers for a started attempt: right for the first `right` questions, wrong for the next `wrong`, the rest unanswered. */
function answer(questions, right, wrong = 0) {
  const answers = {};
  questions.forEach((q, i) => {
    const correctText = KEY.get(q.text).correct_answer;
    if (i < right) answers[q.id] = q.options.find((o) => o.text === correctText).id;
    else if (i < right + wrong) answers[q.id] = q.options.find((o) => o.text !== correctText).id;
  });
  return answers;
}

function leaksNothing(res, what) {
  const keys = [...keysOf(res.json)];
  const allowed = ['attempt', 'token', 'kind', 'title', 'total', 'questions', 'id', 'text', 'topic', 'options', 'quiz', 'demo', 'collection'];
  eq(keys.filter((k) => !allowed.includes(k)), [], `${what}: only question text, topic and options are sent`);
  ok(!/correct|explanation|misconception|exam_tip/i.test(Object.keys(res.json.questions[0]).join()) && !SECRETS.some((s) => res.text.includes(s)),
    `${what}: no correct answers, explanations or tips in the body`);
  ok(res.json.questions.every((q) => q.options.length === 4 && q.options.every((o) => typeof o.id === 'string' && o.text)), `${what}: four options with ids`);
}

// ---------------------------------------------------------------- the walk

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quizla-test-'));
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  await startServer(dataDir, port);
  const anna = client();
  const bertil = client();
  const anon = client();
  let r;

  section('The page and its rules');
  r = await anon.get('/');
  ok(r.status === 200 && r.text.includes('<div id="app">'), 'the app page is served');
  ok(/script-src 'self'/.test(r.headers.get('content-security-policy') || ''), "CSP allows scripts from 'self' only");
  ok(!/<script(?![^>]*\ssrc=)[^>]*>/i.test(r.text) && !/\son[a-z]+\s*=/i.test(r.text), 'index.html has no inline script and no inline event handler');
  const sources = fs.readdirSync(path.join(ROOT, 'public')).filter((f) => /\.(js|html)$/.test(f)).map((f) => [f, fs.readFileSync(path.join(ROOT, 'public', f), 'utf8')]);
  eq(sources.filter(([, s]) => /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(/.test(s)).map(([f]) => f), [], 'no innerHTML (or the like) anywhere in public/');
  eq(sources.filter(([, s]) => /https?:\/\/(?!www\.w3\.org\/2000\/svg)/.test(s)).map(([f]) => f), [], 'no address of another site in public/ (no CDN, fonts or trackers)');
  r = await anon.get('/quiz/abcdefgh1234');
  ok(r.status === 200 && r.text.includes('<div id="app">'), '/quiz/<id> serves the app');
  r = await anon.get('/api/me');
  eq([r.json.user, r.json.ai.configured], [null, false], 'nobody is signed in, and the AI is off (demo mode)');
  eq([(await anon.get('/api/quizzes/%E0%A4%A')).status, (await anon.get('/%E0%A4%A')).status], [400, 400], 'a broken address is a 400, not a crash');

  section('Accounts');
  r = await anna.post('/api/auth/signup', { username: 'anna', password: 'hemligt1', display_name: 'Anna Andersson' });
  ok(r.status === 200 && r.json.user.username === 'anna', 'anna signs up', r.json);
  const annaId = r.json.user.id;
  r = await bertil.post('/api/auth/signup', { username: 'bertil', password: 'hemligt2' });
  ok(r.status === 200, 'bertil signs up');
  eq((await anon.post('/api/auth/signup', { username: 'Anna', password: 'hemligt3' })).status, 409, 'a taken username is refused');
  eq((await anon.get('/api/home')).status, 401, 'home needs an account');
  r = await fetch(`${base}/api/collections`, { method: 'POST', body: 'title=x', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  eq(r.status, 415, 'a form post from another page is refused (JSON only)');
  r = await anna.post('/api/profile', { display_name: 'Anna A' });
  eq([(r.json || {}).display_name, (await anna.get('/api/me')).json.user.display_name], ['Anna A', 'Anna A'], 'the name can be changed');

  section('Collections and pages');
  eq((await anna.post('/api/collections', { title: '  ' })).status, 400, 'a collection needs a title');
  r = await anna.post('/api/collections', { title: 'Biologi kap 3', description: 'Fotosyntes' });
  ok(r.status === 200 && r.json.collection.id, 'anna creates a collection', r.json);
  const cid = r.json.collection.id;
  r = await anna.post(`/api/collections/${cid}/pages`, { image: JPEG });
  ok(r.status === 200 && r.json.page.number === 1 && r.json.page.status === 'pending', 'page 1 (JPEG) is uploaded and waits for analysis', r.json);
  const page1 = r.json.page.id;
  r = await anna.post(`/api/collections/${cid}/pages`, { image: png(1) });
  ok(r.status === 200 && r.json.page.number === 2, 'page 2 (PNG) is uploaded', r.json);
  const page2 = r.json.page.id;
  eq((await anna.post(`/api/collections/${cid}/pages`, { image: 'data:text/html;base64,PGgxPmhlajwvaDE+' })).status, 400, 'something that is not an image is refused');
  eq((await anna.post(`/api/collections/${cid}/pages`, { image: `data:image/jpeg;base64,${Buffer.alloc(2000, 65).toString('base64')}` })).status, 400, 'a file that only claims to be a JPEG is refused');
  r = await anna.post(`/api/collections/${cid}/pages`, { image: png(2) });
  const page3 = r.json.page.id;
  eq((await anna.post(`/api/pages/${page3}/delete`)).status, 200, 'a page can be deleted');
  r = await anna.post(`/api/collections/${cid}/pages`, { image: png(3) });
  eq(r.json.page.number, 4, 'page numbers are never reused (1, 2, deleted 3, then 4)');
  const page4 = r.json.page.id;
  r = await anna.get(`/api/pages/${page1}/image`);
  ok(r.status === 200 && r.type === 'image/jpeg' && r.raw.equals(Buffer.from(JPEG.split(',')[1], 'base64')), 'the owner gets the page image back, byte for byte');
  const dir = path.join(dataDir, 'uploads', String(annaId), String(cid));
  ok(fs.existsSync(dir) && fs.readdirSync(dir).length === 3, 'the files are under DATA_DIR/uploads/<user>/<collection>/', fs.existsSync(dir) && fs.readdirSync(dir));
  r = await anna.get('/api/home');
  eq([r.json.collections.length, r.json.collections[0].pages], [1, 3], 'home lists the collection with its page count');

  section('Analysis (one page per request, resumable)');
  eq((await anna.post(`/api/collections/${cid}/quizzes`)).status, 400, 'no quiz before anything is analysed');
  r = await anna.post(`/api/collections/${cid}/analyze-next`, { retry: true });
  eq([r.status, r.json.done, r.json.total, r.json.remaining, r.json.page.status, r.json.demo], [200, 1, 3, 2, 'analyzed', true], 'the first call analyses one page: 1/3');
  r = await anna.get(`/api/collections/${cid}`);
  eq(r.json.pages.map((p) => p.status), ['analyzed', 'pending', 'pending'], 'the state of the job is in the database');
  let calls = 0;
  do { r = await anna.post(`/api/collections/${cid}/analyze-next`); calls++; } while (r.json.remaining && calls < 10);
  eq([calls, r.json.done, r.json.total, r.json.remaining], [2, 3, 3, 0], 'two more calls finish the job: 3/3');
  r = await anna.post(`/api/collections/${cid}/analyze-next`);
  eq([r.status, r.json.page, r.json.remaining], [200, null, 0], 'nothing left: the call says so');
  r = await anna.post(`/api/pages/${page2}/type`, { type: 'reference' });
  eq([r.json.page.type, r.json.page.status], ['reference', 'analyzed'], 'study material -> reference keeps the analysis (same prompt)');
  r = await anna.post(`/api/pages/${page4}/type`, { type: 'learning_objectives' });
  eq([r.json.page.type, r.json.page.status, r.json.progress.remaining], ['learning_objectives', 'pending', 1], 'a change to learning goals marks the page for re-analysis');
  eq((await anna.post(`/api/pages/${page4}/type`, { type: 'nonsense' })).status, 400, 'an unknown page type is refused');
  r = await anna.post(`/api/collections/${cid}/analyze-next`);
  eq([r.json.page.id, r.json.page.status, r.json.remaining], [page4, 'analyzed', 0], 'and it is analysed again');
  r = await anna.get(`/api/collections/${cid}/study`);
  ok(r.status === 200 && r.json.pages.length === 3 && r.json.pages[0].text.includes('Fotosyntesen') && Object.keys(r.json.pages[0].definitions).length > 2
    && r.json.pages[0].formulas.length > 0 && r.json.pages[2].objectives.length > 2 && r.json.pages.every((p) => p.demo),
  'the study view has text, definitions, formulas and learning goals, marked as demo');

  section('Quiz generation and playing');
  r = await anna.post(`/api/collections/${cid}/quizzes`);
  ok(r.status === 200 && r.json.quiz.demo === true && r.json.quiz.questions === 10 && /^[A-Za-z0-9_-]{10,}$/.test(r.json.quiz.id), 'a quiz of 10 questions is generated (demo)', r.json);
  const quiz = r.json.quiz.id;
  r = await anna.get(`/api/quizzes/${quiz}`);
  eq([r.json.quiz.role, r.json.quiz.questions, r.json.latest, r.json.quiz.is_public], ['owner', 10, null, false], 'the owner opens it: private, no result yet');
  ok(!SECRETS.some((s) => r.text.includes(s)), 'opening a quiz sends no explanations');
  let start = await anna.post(`/api/quizzes/${quiz}/start`);
  eq([start.status, start.json.questions.length], [200, 10], 'starting gives 10 questions');
  leaksNothing(start, 'the quiz as sent to the player');
  const again = await anna.post(`/api/quizzes/${quiz}/start`);
  eq([again.json.attempt.token, again.json.questions.map((q) => q.options.map((o) => o.id))], [start.json.attempt.token, start.json.questions.map((q) => q.options.map((o) => o.id))],
    'a reload continues the same attempt with the same order');
  const correctFirst = start.json.questions.filter((q) => q.options[0].text === KEY.get(q.text).correct_answer).length;
  ok(correctFirst < 10, 'the right answer is not always in the same place');

  // 7 right, 2 wrong, 1 unanswered – and one of the "answers" is an id that is not an option.
  const first = answer(start.json.questions, 7, 2);
  r = await anna.post(`/api/attempts/${start.json.attempt.token}/submit`, { answers: first });
  eq([r.status, r.json.result.score, r.json.result.total, r.json.result.pct], [200, 7, 10, 70], 'the server grades: 7/10');
  eq([r.json.result.xp, r.json.game.xp, r.json.game.streak.current, r.json.game.fresh.map((b) => b.id)], [76, 76, 1, ['first_quiz']], 'XP follows the score (20 + 80 × 0.7), day 1 of a streak, first badge');
  const review = r.json.result.review;
  ok(review.length === 10 && review.every((x) => x.correct && x.explanation && x.misconception && x.exam_tip), 'the review has the right answer, the explanation, the common mistake and the exam tip');
  eq(review.map((x) => x.is_correct), [true, true, true, true, true, true, true, false, false, false], 'each question is marked right or wrong');
  eq(review[9].selected, null, 'an unanswered question counts as wrong');
  ok(r.json.result.topics.length >= 1 && r.json.result.topics.reduce((n, t) => n + t.total, 0) === 10, 'the result has a breakdown by topic');
  r = await anna.post(`/api/attempts/${start.json.attempt.token}/submit`, { answers: answer(start.json.questions, 10) });
  eq([r.json.result.score, r.json.game.xp], [7, 76], 'submitting the same attempt twice changes nothing');
  r = await anna.post(`/api/attempts/nope/submit`, { answers: {} });
  eq(r.status, 404, 'an unknown attempt is refused');
  r = await anna.get(`/api/quizzes/${quiz}`);
  eq([r.json.latest.score, r.json.latest.review.length], [7, 10], 'reopening the quiz shows the latest result');

  section('"Öva på det svåra"');
  r = await anna.get(`/api/collections/${cid}`);
  eq([r.json.hard, r.json.quizzes[0].best, r.json.quizzes[0].attempts], [3, 70, 1], 'the collection knows 3 questions were wrong');
  const hard = await anna.post(`/api/collections/${cid}/practice`);
  eq([hard.status, hard.json.attempt.kind, hard.json.questions.length], [200, 'practice', 3], 'the practice round re-asks exactly those 3');
  leaksNothing(hard, 'the practice round');
  eq(hard.json.questions.map((q) => q.text).sort(), review.filter((x) => !x.is_correct).map((x) => x.text).sort(), 'they are the questions answered wrong');
  r = await anna.post(`/api/attempts/${hard.json.attempt.token}/submit`, { answers: answer(hard.json.questions, 2, 1) });
  eq([r.json.result.score, r.json.result.total, r.json.result.fixed, r.json.result.xp, r.json.game.fresh.map((b) => b.id)], [2, 3, 2, 16, ['practice']], '2 of 3 fixed: 8 XP each, and a badge');
  eq((await anna.get(`/api/collections/${cid}`)).json.hard, 1, 'one hard question is left');

  section('Retake');
  start = await anna.post(`/api/quizzes/${quiz}/start`);
  ok(start.json.attempt.token !== again.json.attempt.token, 'a retake is a new attempt');
  r = await anna.post(`/api/attempts/${start.json.attempt.token}/submit`, { answers: { ...answer(start.json.questions, 10), [start.json.questions[0].id]: answer(start.json.questions, 10)[start.json.questions[0].id] } });
  eq([r.json.result.score, r.json.result.improved, r.json.result.xp], [10, true, 24], 'all right on the retake: only the improvement pays (80 × 0.3)');
  eq(r.json.game.fresh.map((b) => b.id).sort(), ['improved', 'perfect'], 'badges for a perfect score and for beating your own result');
  eq((await anna.get(`/api/collections/${cid}`)).json.hard, 0, 'nothing hard is left');
  eq((await anna.post(`/api/collections/${cid}/practice`)).status, 400, 'so there is no practice round to start');
  start = await anna.post(`/api/quizzes/${quiz}/start`);
  r = await anna.post(`/api/attempts/${start.json.attempt.token}/submit`, { answers: { [start.json.questions[0].id]: 'not-an-option', 999999: 'x' } });
  eq([r.json.result.score, r.json.result.xp], [0, 0], 'made-up option ids score nothing, and a worse retake gives no XP');

  section('Statistics');
  r = await anna.get('/api/stats');
  eq([r.json.done, r.json.average, r.json.chart.length, r.json.recent.length, r.json.collections], [4, 59, 4, 4, 1], 'four attempts, average 59 %');
  eq([r.json.game.xp, r.json.game.level, r.json.game.streak.current, r.json.game.streak.today], [116, 2, 1, true], '116 XP is level 2; the streak is 1 day');
  ok(r.json.topics.length >= 1 && r.json.topics.every((t) => t.total > 0 && t.pct >= 0 && t.pct <= 100), 'topics with % right');
  eq(r.json.game.badges.filter((b) => b.earned).map((b) => b.id).sort(), ['first_quiz', 'improved', 'perfect', 'practice'], 'four badges earned');
  r = await anna.get('/api/usage');
  eq([r.json.collections, r.json.pages, r.json.quizzes, r.json.ai.configured], [1, 3, 1, false], 'usage for the profile');

  section('Access control: bertil and visitors against anna\'s things');
  const refused = async (who, name, method, url, body) => {
    const res = method === 'GET' ? await who.get(url) : await who.post(url, body);
    ok([401, 403, 404].includes(res.status) && !SECRETS.some((s) => res.text.includes(s)), `${name} is refused: ${method} ${url.replace(quiz, '<quiz>')}`, res.status);
  };
  const open = await anna.post(`/api/quizzes/${quiz}/start`);
  for (const [who, name] of [[bertil, 'bertil'], [anon, 'a visitor']]) {
    await refused(who, name, 'GET', `/api/collections/${cid}`);
    await refused(who, name, 'GET', `/api/collections/${cid}/study`);
    await refused(who, name, 'GET', `/api/pages/${page1}/image`);
    await refused(who, name, 'POST', `/api/collections/${cid}/update`, { title: 'Kapad' });
    await refused(who, name, 'POST', `/api/collections/${cid}/pages`, { image: png(9) });
    await refused(who, name, 'POST', `/api/collections/${cid}/analyze-next`, { retry: true });
    await refused(who, name, 'POST', `/api/collections/${cid}/quizzes`);
    await refused(who, name, 'POST', `/api/collections/${cid}/practice`);
    await refused(who, name, 'POST', `/api/pages/${page1}/type`, { type: 'reference' });
    await refused(who, name, 'POST', `/api/pages/${page1}/delete`);
    await refused(who, name, 'GET', `/api/quizzes/${quiz}`);
    await refused(who, name, 'POST', `/api/quizzes/${quiz}/start`);
    await refused(who, name, 'GET', `/api/quizzes/${quiz}/shares`);
    await refused(who, name, 'POST', `/api/quizzes/${quiz}/public`, { is_public: true });
    await refused(who, name, 'POST', `/api/quizzes/${quiz}/shares`, { username: 'bertil' });
    await refused(who, name, 'POST', `/api/quizzes/${quiz}/delete`);
    await refused(who, name, 'POST', `/api/attempts/${open.json.attempt.token}/submit`, { answers: {} });
    await refused(who, name, 'POST', `/api/collections/${cid}/delete`);
  }
  r = await anna.get(`/api/collections/${cid}`);
  eq([r.status, r.json.collection.title, r.json.pages.length, r.json.quizzes.length, r.json.quizzes[0].is_public], [200, 'Biologi kap 3', 3, 1, false], 'and nothing of anna\'s was changed');
  eq((await bertil.get('/api/home')).json.collections.length, 0, 'bertil\'s home shows none of it');

  section('Sharing with a named user');
  eq((await anna.post(`/api/quizzes/${quiz}/shares`, { username: 'ingen-sådan' })).status, 404, 'an unknown username is refused');
  eq((await anna.post(`/api/quizzes/${quiz}/shares`, { username: 'anna' })).status, 400, 'you cannot share with yourself');
  r = await anna.post(`/api/quizzes/${quiz}/shares`, { username: 'Bertil' });
  eq([r.status, r.json.shares.map((u) => u.username)], [200, ['bertil']], 'anna shares the quiz with bertil');
  const bertilId = r.json.shares[0].id;
  r = await bertil.get(`/api/quizzes/${quiz}`);
  eq([r.status, r.json.quiz.role, r.json.quiz.collection_id, r.json.quiz.is_public], [200, 'shared', undefined, undefined], 'bertil can open it, as "shared", without the owner\'s details');
  eq((await bertil.get('/api/home')).json.shared.map((q) => q.id), [quiz], 'it is on bertil\'s home under "Delat med dig"');
  start = await bertil.post(`/api/quizzes/${quiz}/start`);
  leaksNothing(start, 'the shared quiz as sent to bertil');
  r = await bertil.post(`/api/attempts/${start.json.attempt.token}/submit`, { answers: answer(start.json.questions, 5, 5) });
  eq([r.json.result.score, r.json.result.review.length, r.json.game.xp], [5, 10, 60], 'bertil plays it: 5/10, with the review, 60 XP');
  await refused(bertil, 'bertil (shared)', 'GET', `/api/collections/${cid}`);
  await refused(bertil, 'bertil (shared)', 'GET', `/api/pages/${page1}/image`);
  await refused(bertil, 'bertil (shared)', 'POST', `/api/quizzes/${quiz}/public`, { is_public: true });
  await refused(bertil, 'bertil (shared)', 'POST', `/api/quizzes/${quiz}/delete`);
  await refused(anon, 'a visitor', 'GET', `/api/quizzes/${quiz}`);
  const kept = await bertil.post(`/api/quizzes/${quiz}/start`);
  r = await anna.post(`/api/quizzes/${quiz}/shares/remove`, { user_id: bertilId });
  eq(r.json.shares, [], 'anna removes the share');
  await refused(bertil, 'bertil (no longer shared)', 'POST', `/api/attempts/${kept.json.attempt.token}/submit`, { answers: {} });
  await refused(bertil, 'bertil (no longer shared)', 'GET', `/api/quizzes/${quiz}`);
  await refused(bertil, 'bertil (no longer shared)', 'POST', `/api/quizzes/${quiz}/start`);

  section('The public link, played without an account');
  r = await anna.post(`/api/quizzes/${quiz}/public`, { is_public: true });
  eq(r.json.is_public, true, 'anna makes the quiz public');
  r = await anon.get(`/api/quizzes/${quiz}`);
  eq([r.status, r.json.quiz.role, r.json.latest, r.json.quiz.collection_id], [200, 'public', null, undefined], 'a visitor can open it');
  start = await anon.post(`/api/quizzes/${quiz}/start`);
  leaksNothing(start, 'the public quiz as sent to a visitor');
  r = await anon.post(`/api/quizzes/${quiz}/start`, { resume: start.json.attempt.token });
  eq(r.json.attempt.token, start.json.attempt.token, 'a visitor\'s reload continues the same attempt');
  r = await anon.post(`/api/attempts/${start.json.attempt.token}/submit`, { answers: answer(start.json.questions, 6, 4) });
  eq([r.status, Object.keys(r.json), Object.keys(r.json.result).sort(), r.json.result.score, r.json.result.total],
    [200, ['result'], ['completed_at', 'kind', 'pct', 'score', 'title', 'token', 'total'], 6, 10], 'the visitor gets the score only: 6/10');
  ok(!SECRETS.some((s) => r.text.includes(s)), 'no explanations for a visitor, before or after');
  await refused(anon, 'a visitor (public quiz)', 'GET', `/api/collections/${cid}`);
  await refused(anon, 'a visitor (public quiz)', 'GET', `/api/pages/${page1}/image`);
  eq((await bertil.get(`/api/quizzes/${quiz}`)).json.quiz.role, 'public', 'a signed-in user without a share plays it as public');
  eq((await anna.get('/api/stats')).json.game.badges.find((b) => b.id === 'sharer').earned, true, 'sharing earned anna the "Lagspelare" badge');
  await anna.post(`/api/quizzes/${quiz}/public`, { is_public: false });
  await refused(anon, 'a visitor (private again)', 'GET', `/api/quizzes/${quiz}`);
  await refused(anon, 'a visitor (private again)', 'POST', `/api/quizzes/${quiz}/start`);

  section('Fair-use limits');
  r = await bertil.post('/api/collections', { title: 'Många sidor' });
  const big = r.json.collection.id;
  let status = 200;
  for (let i = 0; i < 40 && status === 200; i++) status = (await bertil.post(`/api/collections/${big}/pages`, { image: png(100 + i) })).status;
  eq(status, 200, '40 pages fit in a collection');
  r = await bertil.post(`/api/collections/${big}/pages`, { image: png(999) });
  ok(r.status === 403 && r.json.code === 'limit' && /40 sidor/.test(r.json.error), 'the 41st is refused with a friendly message', r.json);
  for (let i = 0; i < 29 && status === 200; i++) status = (await bertil.post('/api/collections', { title: `Samling ${i}` })).status;
  eq(status, 200, '30 collections fit in an account');
  r = await bertil.post('/api/collections', { title: 'En till' });
  ok(r.status === 403 && r.json.code === 'limit', 'the 31st is refused', r.json);

  section('A stop in the middle of an analysis (the platform may stop the app when idle)');
  r = await bertil.post(`/api/collections/${big}/analyze-next`, { retry: true });
  eq([r.json.done, r.json.total], [1, 40], 'one of 40 pages is analysed');
  await stopServer();
  await startServer(dataDir, port);
  r = await bertil.get(`/api/collections/${big}`);
  eq([r.status, r.json.progress.done, r.json.progress.remaining], [200, 1, 39], 'after a restart: still signed in, 1 analysed, 39 waiting');
  r = await bertil.post(`/api/collections/${big}/analyze-next`);
  eq([r.json.done, r.json.page.number], [2, 2], 'and the job continues with page 2');
  eq((await anna.get('/api/stats')).json.game.xp, 116, 'results and XP survived the restart');

  section('Deleting');
  r = await anna.post(`/api/collections/${cid}/quizzes`);
  const second = r.json.quiz.id;
  ok(r.status === 200 && r.json.quiz.title !== (await anna.get(`/api/quizzes/${quiz}`)).json.quiz.title, 'a second quiz gets another title and other questions');
  eq((await anna.post(`/api/quizzes/${second}/delete`)).status, 200, 'a quiz can be deleted');
  eq((await anna.get(`/api/quizzes/${second}`)).status, 404, 'and is gone');
  await anna.post(`/api/quizzes/${quiz}/shares`, { username: 'bertil' });
  eq((await anna.post('/api/auth/delete', { password: 'fel-lösenord' })).status, 401, 'deleting the account needs the right password');
  ok(fs.existsSync(path.join(dataDir, 'uploads', String(annaId))), 'anna\'s files are there before');
  eq((await anna.post('/api/auth/delete', { password: 'hemligt1' })).status, 200, 'anna deletes her account');
  ok(!fs.existsSync(path.join(dataDir, 'uploads', String(annaId))), 'her files are removed from the disk');
  eq((await anna.get('/api/me')).json.user, null, 'she is signed out');
  eq((await anna.get(`/api/collections/${cid}`)).status, 401, 'her session is gone');
  eq((await anon.post('/api/auth/login', { username: 'anna', password: 'hemligt1' })).status, 401, 'she cannot sign in any more');
  eq((await bertil.get(`/api/quizzes/${quiz}`)).status, 404, 'her quiz is gone for bertil too');
  r = await bertil.get('/api/stats');
  eq([(await bertil.get('/api/home')).json.shared.length, r.json.done, r.json.game.xp], [0, 1, 60], 'bertil keeps his own result and XP from it');
  r = await bertil.post(`/api/collections/${big}/delete`);
  ok(r.status === 200 && !fs.existsSync(path.join(dataDir, 'uploads', String(bertilId), String(big))), 'deleting a collection removes its files');
  ok(!/\b500\b/.test(log.split('\n').filter((l) => /^(GET|POST) /.test(l)).map((l) => l.split(' ')[2]).join(' ')), 'the server answered no request with 500');

  await stopServer();
  fs.rmSync(dataDir, { recursive: true, force: true });
  await withAi();
}

// ---------------------------------------------------------------- the same server with an AI configured

// A stand-in for the OpenAI-compatible endpoint, in this process: it records what the app sends
// and answers like a model would. Nothing leaves the machine.
async function withAi() {
  section('With an AI configured (a stand-in endpoint on this machine)');
  const http = require('node:http');
  const seen = [];
  let breakNext = false;
  const modelQuestions = Array.from({ length: 4 }, (_, i) => ({
    question: `Fråga ${i + 1}?`, correct_answer: `Rätt ${i + 1}`, wrong_answers: [`Fel A${i}`, `Fel B${i}`, `Fel C${i}`, `Rätt ${i + 1}`],
    explanation: `Förklaring ${i + 1}`, difficulty: 'medium', bloom_level: 'apply', question_type: 'application', topic_category: 'Ämne',
    exam_likelihood: i ? 'high' : 'nonsense', exam_tip: `Tips ${i + 1}`, page_references: ['Sida 1'], misconception_targeted: `Missuppfattning ${i + 1}`,
  }));
  const fake = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (d) => { raw += d; });
    req.on('end', () => {
      const body = JSON.parse(raw);
      seen.push({ url: req.url, auth: req.headers.authorization, body });
      const user = body.messages[body.messages.length - 1].content;
      const prompt = typeof user === 'string' ? user : user[0].text;
      let answer;
      if (breakNext) { breakNext = false; answer = 'Sorry, I cannot read this image.'; }
      else if (/LEARNING OBJECTIVES or STUDY PLAN/.test(prompt)) answer = JSON.stringify({ learning_objectives: ['Kunna förklara X'], major_topics: ['Mål'], key_concepts: ['X'], extracted_text: 'Mål för området.', is_foundational: false });
      else if (/expert educational content analyzer/.test(prompt)) answer = '```json\n' + JSON.stringify({ extracted_text: 'Rad ett\nfortsätter här.\n\nNytt stycke.', major_topics: ['Ämne'], key_concepts: ['A', 'B'], definitions: { Term: 'Betydelse' }, formulas: ['a + b = c'], visual_elements: [], emphasis_markers: ['Viktigt'], is_foundational: true }) + '\n```';
      else answer = JSON.stringify({ title: 'Grunderna i ämnet', description: 'Test', teaching_reasoning: 'Tanke', content_analysis: { major_topics: ['Ämne'] }, questions: [...modelQuestions, { question: 'Trasig', correct_answer: 'x', wrong_answers: [] }] });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: answer } }] }));
    });
  });
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quizla-test-ai-'));
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  await startServer(dataDir, port, { OPENAI_API_KEY: 'test-key', OPENAI_BASE_URL: `http://127.0.0.1:${fake.address().port}/v1`, OPENAI_MODEL: 'test-model', AI_DAILY_LIMIT: '6' });
  try {
    const cesar = client();
    let r = await cesar.post('/api/auth/signup', { username: 'cesar', password: 'hemligt3' });
    eq((await cesar.get('/api/me')).json.ai.configured, true, 'the app says the AI is on');
    const cid = (await cesar.post('/api/collections', { title: 'Kemi', description: 'Syror och baser' })).json.collection.id;
    await cesar.post(`/api/collections/${cid}/pages`, { image: JPEG });
    await cesar.post(`/api/collections/${cid}/pages`, { image: png(5), type: 'learning_objectives' });
    await cesar.post(`/api/collections/${cid}/pages`, { image: png(6) });

    r = await cesar.post(`/api/collections/${cid}/analyze-next`, { retry: true });
    eq([r.json.done, r.json.page.status, r.json.demo, r.json.page.topics], [1, 'analyzed', false, ['Ämne']], 'page 1 is read by the model, not marked demo');
    const first = seen[0];
    eq([first.url, first.auth, first.body.model, first.body.response_format, first.body.messages.length], ['/v1/chat/completions', 'Bearer test-key', 'test-model', { type: 'json_object' }, 1],
      'one user message to the configured endpoint, model and key, in JSON mode');
    ok(first.body.messages[0].content[0].text.includes('CRITICAL LANGUAGE RULE') && first.body.messages[0].content[0].text.includes('Analyze from a STUDENT PERSPECTIVE')
      && first.body.messages[0].content[1].image_url.url === JPEG, 'the original content prompt and the image as a data URL are sent');
    r = await cesar.post(`/api/collections/${cid}/analyze-next`);
    ok(seen[1].body.messages[0].content[0].text.includes('LEARNING OBJECTIVES or STUDY PLAN') && r.json.page.status === 'analyzed', 'a learning-goals page gets the other prompt');
    breakNext = true;
    r = await cesar.post(`/api/collections/${cid}/analyze-next`);
    eq([r.status, r.json.page.status, r.json.failed, r.json.remaining], [200, 'failed', 1, 0], 'an answer that is not JSON marks that page as failed, and the run goes on');
    r = await cesar.post(`/api/collections/${cid}/analyze-next`, { retry: true });
    eq([r.json.page.status, r.json.failed, r.json.analyzed], ['analyzed', 0, 3], 'the next run tries the failed page again');
    r = await cesar.get(`/api/collections/${cid}/study`);
    eq([r.json.pages[0].text, r.json.pages[0].definitions, r.json.pages[1].objectives], ['Rad ett fortsätter här.\n\nNytt stycke.', { Term: 'Betydelse' }, ['Kunna förklara X']], 'the analysis is stored: text reflowed, definitions, learning goals');

    r = await cesar.post(`/api/collections/${cid}/quizzes`);
    eq([r.status, r.json.quiz.title, r.json.quiz.questions, r.json.quiz.demo], [200, 'Grunderna i ämnet', 4, false], 'the quiz is stored; a question without wrong answers is dropped');
    const gen = seen[seen.length - 1].body;
    ok(gen.messages[0].role === 'system' && gen.messages[0].content.includes('veteran teacher') && gen.messages[0].content.includes('First quiz — build a solid foundation')
      && gen.messages[0].content.includes('First quiz: "Grunderna i [Ämne]"'), 'the original system prompt, in its "first quiz" form');
    const msg = gen.messages[1].content;
    ok(typeof msg === 'string' && msg.startsWith('Create a quiz from the following pre-analyzed study materials about: Kemi. Syror och baser')
      && msg.indexOf('LEARNING GOALS - YOUR PRIMARY FOCUS') > 0 && msg.indexOf('LEARNING GOALS - YOUR PRIMARY FOCUS') < msg.indexOf('STUDY MATERIALS - GENERATE QUESTIONS FROM THIS')
      && msg.includes('─── Page 1 ───') && msg.includes('─── Page 3 ───') && msg.includes('• Kunna förklara X') && msg.includes('Definitions: {"Term":"Betydelse"}') && !msg.includes('AVOID THESE'),
    'the user message: learning goals first, then the study material page by page');
    const quiz = r.json.quiz.id;
    const start = await cesar.post(`/api/quizzes/${quiz}/start`);
    ok(start.json.questions.every((q) => q.options.length === 4 && new Set(q.options.map((o) => o.text)).size === 4) && !/Förklaring|Missuppfattning|Tips/.test(start.text), 'four different options per question (a wrong answer equal to the right one is dropped), nothing leaked');
    const answers = Object.fromEntries(start.json.questions.map((q) => [q.id, q.options.find((o) => o.text.startsWith('Rätt')).id]));
    r = await cesar.post(`/api/attempts/${start.json.attempt.token}/submit`, { answers });
    eq([r.json.result.score, r.json.result.review[0].misconception, r.json.result.review[0].exam_likelihood, r.json.result.review[1].exam_likelihood], [4, 'Missuppfattning 1', null, 'high'],
      'graded 4/4; misconception_targeted is kept and shown; an unknown enum value is dropped');
    r = await cesar.post(`/api/collections/${cid}/quizzes`);
    const gen2 = seen[seen.length - 1].body;
    ok(r.status === 200 && gen2.messages[0].content.includes('This collection has 1 existing quiz(zes)') && gen2.messages[0].content.includes('Second quiz: "Fördjupning: [Ämne]"')
      && gen2.messages[1].content.includes('🚫 AVOID THESE 4 EXISTING QUESTIONS:') && gen2.messages[1].content.includes('- "Fråga 1?" (Ämne)'), 'a second quiz is steered away from the earlier questions');
    eq((await cesar.get('/api/usage')).json.ai, { configured: true, today: 6, daily_limit: 6 }, 'every model call was counted (4 pages read, 2 quizzes)');
    r = await cesar.post(`/api/collections/${cid}/quizzes`);
    ok(r.status === 429 && /i morgon/.test(r.json.error), 'the day\'s allowance stops the next call with a friendly message', r.json);
    eq(seen.length, 6, 'and nothing more was sent to the model');
  } finally {
    await stopServer();
    await new Promise((r) => fake.close(r));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((e) => { failed++; console.error(`\nThe test run broke: ${e.stack || e}\n--- server log ---\n${log.split('\n').slice(-30).join('\n')}`); })
  .finally(async () => {
    await stopServer();
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  });
