'use strict';
// Quizla – photograph textbook pages into a collection, let an AI read them into a knowledge
// base, and get quizzes written with a teacher's craft. One small Node server with SQLite; no
// packages. (The first version ran on a hosted database; this is its successor.)
//
// Two rules the original left to the database or the browser are enforced here, on every route:
//   - access: the owner, a user a quiz is shared with, or anyone for a public quiz;
//   - grading: correct answers and explanations never leave the server before an attempt is
//     submitted; options are shuffled per attempt and answered by option id.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { app, db, tx, ai, HttpError, limit, clientIp, parseImage, now, today, DATA_DIR } = require('./lib/core');
const { analysisPrompt, promptKind, quizSystemPrompt, quizUserMessage } = require('./lib/prompts');
const { demoAnalysis, demoQuiz } = require('./lib/demo');
const { game, quizXp, localDay, PRACTICE_XP } = require('./lib/game');

// Fair use, not plans: generous for a pupil, a stop for a runaway script.
const LIMITS = { collections: 30, pages: 40, quizzes: 12, shares: 50 };
const PAGE_TYPES = ['content', 'learning_objectives', 'reference'];
const UPLOADS = path.join(DATA_DIR, 'uploads');
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const PRACTICE_SIZE = 10;

app.migrate([
  `CREATE TABLE collections (
     id INTEGER PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     description TEXT NOT NULL DEFAULT '',
     next_page INTEGER NOT NULL DEFAULT 1,       -- page numbers are never reused within a collection
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE INDEX collections_user ON collections(user_id);

   CREATE TABLE pages (
     id INTEGER PRIMARY KEY,
     collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
     page_number INTEGER NOT NULL,
     file TEXT NOT NULL,                         -- name under uploads/<user>/<collection>/
     mime TEXT NOT NULL,
     size INTEGER NOT NULL,
     type TEXT NOT NULL DEFAULT 'content',       -- content | learning_objectives | reference
     status TEXT NOT NULL DEFAULT 'pending',     -- pending | analyzed | failed  (the analysis job's state)
     error TEXT,
     demo INTEGER NOT NULL DEFAULT 0,
     extracted_text TEXT,
     major_topics TEXT, key_concepts TEXT, definitions TEXT, formulas TEXT,       -- JSON
     visual_elements TEXT, emphasis_markers TEXT, learning_objectives TEXT,       -- JSON
     is_foundational INTEGER,
     token_count INTEGER,
     analyzed_at TEXT,
     created_at TEXT NOT NULL,
     UNIQUE (collection_id, page_number)
   );

   CREATE TABLE quizzes (
     id INTEGER PRIMARY KEY,
     slug TEXT NOT NULL UNIQUE,                  -- the id in addresses: /quiz/<slug>, not guessable
     collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     description TEXT NOT NULL DEFAULT '',
     is_public INTEGER NOT NULL DEFAULT 0,
     demo INTEGER NOT NULL DEFAULT 0,
     teaching_reasoning TEXT,
     content_analysis TEXT,                      -- JSON
     created_at TEXT NOT NULL
   );
   CREATE INDEX quizzes_collection ON quizzes(collection_id);
   CREATE INDEX quizzes_user ON quizzes(user_id);

   CREATE TABLE questions (
     id INTEGER PRIMARY KEY,
     quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
     order_index INTEGER NOT NULL,
     question_text TEXT NOT NULL,
     options TEXT NOT NULL,                      -- JSON [{id, text}], in no meaningful order
     correct_id TEXT NOT NULL,
     explanation TEXT NOT NULL DEFAULT '',
     difficulty TEXT, bloom_level TEXT, question_type TEXT,
     topic TEXT NOT NULL DEFAULT '',
     exam_likelihood TEXT,
     exam_tip TEXT NOT NULL DEFAULT '',
     page_references TEXT,                       -- JSON
     misconception TEXT NOT NULL DEFAULT ''      -- "misconception_targeted": the original threw it away
   );
   CREATE INDEX questions_quiz ON questions(quiz_id);

   CREATE TABLE quiz_shares (
     quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at TEXT NOT NULL,
     PRIMARY KEY (quiz_id, user_id)
   );
   CREATE INDEX quiz_shares_user ON quiz_shares(user_id);

   -- An attempt is created when a quiz is started (it fixes the questions and the order of the
   -- options) and completed when it is submitted. A deleted quiz leaves the finished attempts of
   -- its players in place (score, XP, streak) – only the answers go with the questions.
   CREATE TABLE attempts (
     id INTEGER PRIMARY KEY,
     token TEXT NOT NULL UNIQUE,
     kind TEXT NOT NULL DEFAULT 'quiz',          -- quiz | practice ("Öva på det svåra")
     quiz_id INTEGER REFERENCES quizzes(id) ON DELETE SET NULL,
     collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
     user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,     -- NULL: played without an account
     title TEXT NOT NULL DEFAULT '',
     layout TEXT NOT NULL,                       -- JSON [{q: question id, o: [option ids in shown order]}]
     total INTEGER NOT NULL,
     score INTEGER,
     xp INTEGER NOT NULL DEFAULT 0,
     fixed INTEGER NOT NULL DEFAULT 0,           -- questions right now that were wrong last time
     improved INTEGER NOT NULL DEFAULT 0,        -- a retake that beat the earlier best
     day TEXT,                                   -- local day of completion, for the streak
     started_at TEXT NOT NULL,
     completed_at TEXT
   );
   CREATE INDEX attempts_user ON attempts(user_id, completed_at);
   CREATE INDEX attempts_quiz ON attempts(quiz_id);

   CREATE TABLE answers (
     attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
     question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
     selected TEXT,                              -- option id, NULL when left unanswered
     is_correct INTEGER NOT NULL,
     PRIMARY KEY (attempt_id, question_id)
   );
   CREATE INDEX answers_question ON answers(question_id);

   CREATE TABLE badges (
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     badge TEXT NOT NULL,
     earned_at TEXT NOT NULL,
     PRIMARY KEY (user_id, badge)
   );`,
]);

// ---------------------------------------------------------------- small helpers

const NOT_FOUND = 'Den finns inte, eller så är den inte din.';
function id(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(404, NOT_FOUND);
  return n;
}
const line = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const parse = (s, fallback) => { try { const v = JSON.parse(s); return v == null ? fallback : v; } catch (e) { return fallback; } };
const strings = (v, max, len) => (Array.isArray(v) ? v : []).map((x) => line(x, len)).filter(Boolean).slice(0, max);
const share = (score, total) => (total ? score / total : 0);
const pct = (score, total) => Math.round(100 * share(score, total));
const random = (bytes) => crypto.randomBytes(bytes).toString('base64url');

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Paragraphs kept, everything inside a paragraph on one line. */
function tidyText(v) {
  return String(v == null ? '' : v).split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n').slice(0, 20000);
}

// ---------------------------------------------------------------- access (every route goes through one of these)

/** A collection is its owner's only. */
function ownCollection(req, collectionId = req.params.id) {
  const c = db.prepare('SELECT * FROM collections WHERE id = ? AND user_id = ?').get(id(collectionId), req.user.id);
  if (!c) throw new HttpError(404, NOT_FOUND);
  return c;
}

/** A page (and its image) follows its collection. */
function ownPage(req) {
  const p = db.prepare(`SELECT p.* FROM pages p JOIN collections c ON c.id = p.collection_id
                        WHERE p.id = ? AND c.user_id = ?`).get(id(req.params.id), req.user.id);
  if (!p) throw new HttpError(404, NOT_FOUND);
  return p;
}

/**
 * A quiz: its owner, a user it is shared with, or anyone when it is public.
 * need 'owner' for everything that changes it. Without an account the answer is the same
 * whether the quiz is private or does not exist.
 */
function roleIn(quiz, user) {
  if (!quiz) return null;
  if (user && quiz.user_id === user.id) return 'owner';
  if (user && db.prepare('SELECT 1 FROM quiz_shares WHERE quiz_id = ? AND user_id = ?').get(quiz.id, user.id)) return 'shared';
  return quiz.is_public ? 'public' : null;
}

function quizFor(req, need = 'play') {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE slug = ?').get(String(req.params.id));
  const role = roleIn(quiz, req.user);
  if (!role || (need === 'owner' && role !== 'owner')) {
    if (!req.user) throw new HttpError(401, 'Logga in för att öppna det här quizet.');
    throw new HttpError(404, 'Quizet finns inte, eller så är det inte delat med dig.');
  }
  return { quiz, role };
}

// ---------------------------------------------------------------- files

const pageDir = (userId, collectionId) => path.join(UPLOADS, String(userId), String(collectionId));
const remove = (target) => { try { fs.rmSync(target, { recursive: true, force: true }); } catch (e) { console.error(`remove ${target}: ${e.message}`); } };

function looksLike(mime, b) {
  if (mime === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === 'image/png') return b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP';
}

app.onDeleteUser((userId) => {
  // Attempts made without an account on this user's quizzes belong to nobody afterwards.
  db.prepare('DELETE FROM attempts WHERE user_id IS NULL AND quiz_id IN (SELECT id FROM quizzes WHERE user_id = ?)').run(userId);
  remove(path.join(UPLOADS, String(userId)));
});

// ---------------------------------------------------------------- shapes sent to the browser

const count = (sql, ...args) => db.prepare(sql).get(...args).n;

function pageOut(p, full) {
  const out = {
    id: p.id, number: p.page_number, type: p.type, status: p.status, error: p.error || null,
    demo: Boolean(p.demo), topics: parse(p.major_topics, []),
  };
  if (full) {
    Object.assign(out, {
      text: p.extracted_text || '',
      concepts: parse(p.key_concepts, []),
      definitions: parse(p.definitions, {}),
      formulas: parse(p.formulas, []),
      visuals: parse(p.visual_elements, []),
      emphasis: parse(p.emphasis_markers, []),
      objectives: parse(p.learning_objectives, []),
      foundational: p.is_foundational == null ? null : Boolean(p.is_foundational),
    });
  }
  return out;
}

/** A quiz in a list, with how the asking user has done on it. */
function quizCard(q, userId) {
  const mine = db.prepare(`SELECT COUNT(*) AS n, MAX(100.0 * score / total) AS best FROM attempts
    WHERE quiz_id = ? AND user_id = ? AND kind = 'quiz' AND completed_at IS NOT NULL AND total > 0`).get(q.id, userId);
  return {
    id: q.slug, title: q.title, description: q.description, demo: Boolean(q.demo), created_at: q.created_at,
    questions: count('SELECT COUNT(*) AS n FROM questions WHERE quiz_id = ?', q.id),
    attempts: mine.n, best: mine.n ? Math.round(mine.best) : null,
  };
}

function ownerExtras(q) {
  return {
    is_public: Boolean(q.is_public),
    shares: count('SELECT COUNT(*) AS n FROM quiz_shares WHERE quiz_id = ?', q.id),
    plays: count('SELECT COUNT(*) AS n FROM attempts WHERE quiz_id = ? AND completed_at IS NOT NULL', q.id),
  };
}

function progress(collectionId) {
  const r = db.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(status = 'pending'), 0) AS pending,
    COALESCE(SUM(status = 'analyzed'), 0) AS analyzed, COALESCE(SUM(status = 'failed'), 0) AS failed
    FROM pages WHERE collection_id = ?`).get(collectionId);
  return { total: r.total, done: r.total - r.pending, remaining: r.pending, analyzed: r.analyzed, failed: r.failed };
}

// ---------------------------------------------------------------- home, profile

app.get('/api/home', { auth: true }, (req) => {
  const uid = req.user.id;
  const collections = db.prepare(`SELECT c.id, c.title, c.description, c.updated_at,
      (SELECT COUNT(*) FROM pages p WHERE p.collection_id = c.id) AS pages,
      (SELECT COUNT(*) FROM pages p WHERE p.collection_id = c.id AND p.status = 'analyzed') AS analyzed,
      (SELECT COUNT(*) FROM quizzes z WHERE z.collection_id = c.id) AS quizzes,
      (SELECT p.id FROM pages p WHERE p.collection_id = c.id ORDER BY p.page_number LIMIT 1) AS cover
    FROM collections c WHERE c.user_id = ? ORDER BY c.updated_at DESC, c.id DESC`).all(uid);
  const recent = db.prepare('SELECT * FROM quizzes WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 5').all(uid);
  const shared = db.prepare(`SELECT z.*, u.display_name AS owner_name FROM quiz_shares s
    JOIN quizzes z ON z.id = s.quiz_id JOIN users u ON u.id = z.user_id
    WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 20`).all(uid);
  return {
    collections,
    quizzes: recent.map((q) => ({ ...quizCard(q, uid), ...ownerExtras(q), collection_id: q.collection_id })),
    shared: shared.map((q) => ({ ...quizCard(q, uid), from: q.owner_name })),
    game: game(uid),
    limits: LIMITS,
  };
});

app.get('/api/usage', { auth: true }, (req) => {
  const uid = req.user.id;
  const used = db.prepare('SELECT calls FROM ai_usage WHERE user_id = ? AND day = ?').get(uid, today());
  return {
    collections: count('SELECT COUNT(*) AS n FROM collections WHERE user_id = ?', uid),
    pages: count('SELECT COUNT(*) AS n FROM pages p JOIN collections c ON c.id = p.collection_id WHERE c.user_id = ?', uid),
    quizzes: count('SELECT COUNT(*) AS n FROM quizzes WHERE user_id = ?', uid),
    ai: { configured: ai.configured(), today: used ? used.calls : 0, daily_limit: Number(process.env.AI_DAILY_LIMIT || 30) },
    limits: LIMITS,
  };
});

app.post('/api/profile', { auth: true }, (req) => {
  const name = line(req.body.display_name, 40);
  if (name.length < 1) throw new HttpError(400, 'Skriv vad du vill kallas.');
  db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(name, req.user.id);
  return { display_name: name };
});

// ---------------------------------------------------------------- collections

function collectionFields(body) {
  const title = line(body.title, 80);
  if (title.length < 1) throw new HttpError(400, 'Ge samlingen ett namn.');
  return { title, description: line(body.description, 300) };
}

app.post('/api/collections', { auth: true }, (req) => {
  const f = collectionFields(req.body);
  if (count('SELECT COUNT(*) AS n FROM collections WHERE user_id = ?', req.user.id) >= LIMITS.collections) {
    throw new HttpError(403, `Du har redan ${LIMITS.collections} samlingar. Ta bort en du är klar med, så får en ny plats.`, { code: 'limit' });
  }
  const t = now();
  const r = db.prepare('INSERT INTO collections (user_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, f.title, f.description, t, t);
  return { collection: { id: Number(r.lastInsertRowid), ...f } };
});

app.get('/api/collections/:id', { auth: true }, (req) => {
  const c = ownCollection(req);
  const pages = db.prepare('SELECT * FROM pages WHERE collection_id = ? ORDER BY page_number').all(c.id);
  const quizzes = db.prepare('SELECT * FROM quizzes WHERE collection_id = ? ORDER BY created_at DESC, id DESC').all(c.id);
  return {
    collection: { id: c.id, title: c.title, description: c.description },
    pages: pages.map((p) => pageOut(p, false)),
    quizzes: quizzes.map((q) => ({ ...quizCard(q, req.user.id), ...ownerExtras(q) })),
    progress: progress(c.id),
    hard: hardQuestions(req.user.id, c.id).length,
    limits: LIMITS,
    ai: { configured: ai.configured() },
  };
});

app.post('/api/collections/:id/update', { auth: true }, (req) => {
  const c = ownCollection(req);
  const f = collectionFields(req.body);
  db.prepare('UPDATE collections SET title = ?, description = ?, updated_at = ? WHERE id = ?').run(f.title, f.description, now(), c.id);
  return { collection: { id: c.id, ...f } };
});

app.post('/api/collections/:id/delete', { auth: true }, (req) => {
  const c = ownCollection(req);
  tx(() => {
    db.prepare('DELETE FROM attempts WHERE user_id IS NULL AND quiz_id IN (SELECT id FROM quizzes WHERE collection_id = ?)').run(c.id);
    db.prepare('DELETE FROM collections WHERE id = ?').run(c.id);
  });
  remove(pageDir(req.user.id, c.id));
  return { ok: true };
});

// ---------------------------------------------------------------- pages

app.post('/api/collections/:id/pages', { auth: true, maxBody: 6e6 }, (req) => {
  const c = ownCollection(req);
  limit(`upload:${req.user.id}`, 150, 3600, 'Det var många sidor på kort tid – ta en paus och fortsätt om en stund.');
  if (count('SELECT COUNT(*) AS n FROM pages WHERE collection_id = ?', c.id) >= LIMITS.pages) {
    throw new HttpError(403, `En samling rymmer ${LIMITS.pages} sidor. Skapa en ny samling för resten!`, { code: 'limit' });
  }
  const { mime, buffer } = parseImage(req.body.image);
  if (!looksLike(mime, buffer)) throw new HttpError(400, 'Bilden gick inte att läsa. Ta ett nytt foto och försök igen.');
  const type = PAGE_TYPES.includes(req.body.type) ? req.body.type : 'content';
  const dir = pageDir(req.user.id, c.id);
  const file = crypto.randomBytes(12).toString('hex') + EXT[mime];
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), buffer);
  try {
    const pageId = tx(() => {
      const number = db.prepare('UPDATE collections SET next_page = next_page + 1, updated_at = ? WHERE id = ? RETURNING next_page - 1 AS n').get(now(), c.id).n;
      const r = db.prepare(`INSERT INTO pages (collection_id, page_number, file, mime, size, type, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?)`).run(c.id, number, file, mime, buffer.length, type, now());
      return Number(r.lastInsertRowid);
    });
    return { page: pageOut(db.prepare('SELECT * FROM pages WHERE id = ?').get(pageId), false), progress: progress(c.id) };
  } catch (e) {
    remove(path.join(dir, file));
    throw e;
  }
});

app.get('/api/pages/:id/image', { auth: true }, (req) => {
  const p = ownPage(req);
  const file = path.join(pageDir(req.user.id, p.collection_id), path.basename(p.file));
  if (!fs.existsSync(file)) throw new HttpError(404, 'Bilden finns inte kvar.');
  return { buffer: fs.readFileSync(file), type: p.mime };
});

app.post('/api/pages/:id/type', { auth: true }, (req) => {
  const p = ownPage(req);
  const type = req.body.type;
  if (!PAGE_TYPES.includes(type)) throw new HttpError(400, 'Okänd sidtyp.');
  // The original kept the old analysis after a change of type. Learning goals are read with
  // another prompt than study material and reference, so that change sends the page back.
  const again = promptKind(type) !== promptKind(p.type) && p.status !== 'pending';
  db.prepare(`UPDATE pages SET type = ?, status = CASE WHEN ? THEN 'pending' ELSE status END, error = CASE WHEN ? THEN NULL ELSE error END
              WHERE id = ?`).run(type, again ? 1 : 0, again ? 1 : 0, p.id);
  return { page: pageOut(db.prepare('SELECT * FROM pages WHERE id = ?').get(p.id), false), progress: progress(p.collection_id) };
});

app.post('/api/pages/:id/delete', { auth: true }, (req) => {
  const p = ownPage(req);
  db.prepare('DELETE FROM pages WHERE id = ?').run(p.id);
  remove(path.join(pageDir(req.user.id, p.collection_id), path.basename(p.file)));
  return { ok: true, progress: progress(p.collection_id) };
});

// ---------------------------------------------------------------- analysis: one page per request

// The job's state is the pages' status in the database, so it survives a restart: the browser
// asks for "the next page" until none is pending, and can pick up where it stopped at any time.
const reading = new Set();          // pages being read right now – only to avoid paying twice for a double tap

app.post('/api/collections/:id/analyze-next', { auth: true }, async (req) => {
  const c = ownCollection(req);
  if (req.body.retry) db.prepare("UPDATE pages SET status = 'pending', error = NULL WHERE collection_id = ? AND status = 'failed'").run(c.id);
  const page = db.prepare("SELECT * FROM pages WHERE collection_id = ? AND status = 'pending' ORDER BY page_number LIMIT 1").get(c.id);
  const demo = !ai.configured();
  if (!page) return { ...progress(c.id), page: null, demo };
  if (reading.has(page.id)) throw new HttpError(409, 'Den sidan läses redan – vänta en liten stund.');
  reading.add(page.id);
  try {
    let result;
    try {
      if (demo) {
        await new Promise((r) => setTimeout(r, 300));        // long enough to see the progress move
        result = demoAnalysis(page.type, page.page_number);
      } else {
        const file = path.join(pageDir(req.user.id, c.id), path.basename(page.file));
        if (!fs.existsSync(file)) throw new HttpError(422, 'Bilden saknas – ladda upp sidan igen.');
        ai.spend(req.user.id);
        result = await ai.json({
          user: analysisPrompt(page.type),
          images: [`data:${page.mime};base64,${fs.readFileSync(file).toString('base64')}`],
          maxTokens: 4000, temperature: 0.2,
        });
      }
    } catch (e) {
      // The day's allowance, a busy or unreachable AI: stop the run, the page stays pending.
      // Anything else is about this page: mark it and let the run go on with the next.
      const stop = !(e instanceof HttpError) || e.status === 429 || e.status === 503 || e.extra.code === 'ai_unreachable';
      if (stop) throw e;
      db.prepare("UPDATE pages SET status = 'failed', error = ? WHERE id = ? AND status = 'pending'").run(e.message.slice(0, 200), page.id);
      return { ...progress(c.id), page: pageOut(db.prepare('SELECT * FROM pages WHERE id = ?').get(page.id), false), demo };
    }
    const text = tidyText(result.extracted_text);
    // "AND type = ?": if the type was changed while the page was being read, it stays pending.
    db.prepare(`UPDATE pages SET status = 'analyzed', error = NULL, demo = ?, extracted_text = ?, major_topics = ?, key_concepts = ?,
        definitions = ?, formulas = ?, visual_elements = ?, emphasis_markers = ?, learning_objectives = ?,
        is_foundational = ?, token_count = ?, analyzed_at = ? WHERE id = ? AND type = ?`).run(
      demo ? 1 : 0, text,
      JSON.stringify(strings(result.major_topics, 5, 80)),
      JSON.stringify(strings(result.key_concepts, 12, 120)),
      JSON.stringify(definitions(result.definitions)),
      JSON.stringify(strings(result.formulas, 30, 300)),
      JSON.stringify(strings(result.visual_elements, 20, 200)),
      JSON.stringify(strings(result.emphasis_markers, 20, 300)),
      JSON.stringify(strings(result.learning_objectives, 40, 400)),
      result.is_foundational ? 1 : 0, Math.ceil(text.length / 4), now(), page.id, page.type);
    const fresh = db.prepare('SELECT * FROM pages WHERE id = ?').get(page.id);
    return { ...progress(c.id), page: fresh ? pageOut(fresh, false) : null, demo };
  } finally {
    reading.delete(page.id);
  }
});

function definitions(v) {
  const out = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [term, meaning] of Object.entries(v).slice(0, 40)) {
      const t = line(term, 100);
      const m = line(typeof meaning === 'string' ? meaning : JSON.stringify(meaning), 600);
      if (t && m) out[t] = m;
    }
  }
  return out;
}

app.get('/api/collections/:id/study', { auth: true }, (req) => {
  const c = ownCollection(req);
  const pages = db.prepare("SELECT * FROM pages WHERE collection_id = ? AND status = 'analyzed' ORDER BY page_number").all(c.id);
  return { collection: { id: c.id, title: c.title }, pages: pages.map((p) => pageOut(p, true)), progress: progress(c.id) };
});

// ---------------------------------------------------------------- quiz generation

const ENUMS = {
  difficulty: ['easy', 'medium', 'hard'],
  bloom_level: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'],
  question_type: ['recall', 'application', 'analysis', 'synthesis'],
  exam_likelihood: ['low', 'medium', 'high', 'very_high'],
};
const oneOf = (key, v) => (ENUMS[key].includes(v) ? v : null);

/** The model's questions, checked: one right answer, two or three different wrong ones. */
function cleanQuestions(list) {
  const out = [];
  for (const q of Array.isArray(list) ? list : []) {
    if (!q || typeof q !== 'object') continue;
    const question = line(q.question, 700);
    const correct = line(q.correct_answer, 400);
    const seen = new Set([correct.toLowerCase()]);
    const wrong = [];
    for (const w of strings(q.wrong_answers, 6, 400)) {
      if (seen.has(w.toLowerCase())) continue;
      seen.add(w.toLowerCase());
      wrong.push(w);
    }
    if (!question || !correct || wrong.length < 2) continue;
    out.push({
      question, correct, wrong: wrong.slice(0, 3),
      explanation: line(q.explanation, 1500),
      difficulty: oneOf('difficulty', q.difficulty), bloom_level: oneOf('bloom_level', q.bloom_level),
      question_type: oneOf('question_type', q.question_type), exam_likelihood: oneOf('exam_likelihood', q.exam_likelihood),
      topic: line(q.topic_category, 80),
      exam_tip: line(q.exam_tip, 600),
      page_references: strings(q.page_references, 10, 40),
      misconception: line(q.misconception_targeted, 400),
    });
    if (out.length >= 20) break;
  }
  return out;
}

const writing = new Set();          // collections with a quiz being written – a double tap must not make two

app.post('/api/collections/:id/quizzes', { auth: true }, async (req) => {
  const c = ownCollection(req);
  const existing = count('SELECT COUNT(*) AS n FROM quizzes WHERE collection_id = ?', c.id);
  if (existing >= LIMITS.quizzes) {
    throw new HttpError(403, `Samlingen har redan ${LIMITS.quizzes} quiz. Ta bort ett gammalt, eller öva på det svåra!`, { code: 'limit' });
  }
  const rows = db.prepare("SELECT * FROM pages WHERE collection_id = ? AND status = 'analyzed' ORDER BY page_number").all(c.id);
  if (!rows.length) throw new HttpError(400, 'Låt Quizla läsa minst en sida först.');
  if (writing.has(c.id)) throw new HttpError(409, 'Ett quiz skrivs redan – det är strax klart.');
  limit(`quiz:${req.user.id}`, 10, 600, 'Du har skapat många quiz på kort tid. Gör ett av dem först!');
  writing.add(c.id);
  try {
    const demo = !ai.configured();
    let data;
    if (demo) {
      await new Promise((r) => setTimeout(r, 300));
      data = demoQuiz(existing);
    } else {
      const earlier = db.prepare(`SELECT q.question_text, q.topic FROM questions q JOIN quizzes z ON z.id = q.quiz_id
                                  WHERE z.collection_id = ? ORDER BY z.id DESC, q.order_index`).all(c.id);
      ai.spend(req.user.id);
      data = await ai.json({
        system: quizSystemPrompt(existing),
        user: quizUserMessage(c, rows.map((p) => pageOut(p, true)), earlier),
        maxTokens: 12000, temperature: 0.6,
      });
    }
    const questions = cleanQuestions(data.questions);
    if (questions.length < 3) throw new HttpError(502, 'Det blev inget bra quiz den här gången. Försök igen!', { code: 'ai_bad_quiz' });
    const slug = random(9);
    const title = line(data.title, 80) || `${c.title} – quiz ${existing + 1}`;
    tx(() => {
      const quizId = Number(db.prepare(`INSERT INTO quizzes (slug, collection_id, user_id, title, description, demo, teaching_reasoning, content_analysis, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(slug, c.id, req.user.id, title, line(data.description, 300), demo ? 1 : 0,
        line(data.teaching_reasoning, 1500), JSON.stringify(data.content_analysis && typeof data.content_analysis === 'object' ? data.content_analysis : {}).slice(0, 4000),
        now()).lastInsertRowid);
      const insert = db.prepare(`INSERT INTO questions (quiz_id, order_index, question_text, options, correct_id, explanation, difficulty,
        bloom_level, question_type, topic, exam_likelihood, exam_tip, page_references, misconception) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      questions.forEach((q, i) => {
        const ids = new Set();
        while (ids.size < 1 + q.wrong.length) ids.add(crypto.randomBytes(4).toString('hex'));
        const [correctId, ...wrongIds] = [...ids];
        const options = [{ id: correctId, text: q.correct }, ...q.wrong.map((text, k) => ({ id: wrongIds[k], text }))]
          .sort((a, b) => (a.id < b.id ? -1 : 1));
        insert.run(quizId, i, q.question, JSON.stringify(options), correctId, q.explanation, q.difficulty, q.bloom_level,
          q.question_type, q.topic, q.exam_likelihood, q.exam_tip, JSON.stringify(q.page_references), q.misconception);
      });
      db.prepare('UPDATE collections SET updated_at = ? WHERE id = ?').run(now(), c.id);
    });
    return { quiz: { id: slug, title, questions: questions.length, demo } };
  } finally {
    writing.delete(c.id);
  }
});

// ---------------------------------------------------------------- quizzes: open, share, delete

app.get('/api/quizzes/:id', (req) => {
  const { quiz, role } = quizFor(req);
  const out = {
    quiz: {
      id: quiz.slug, title: quiz.title, description: quiz.description, demo: Boolean(quiz.demo), role,
      questions: count('SELECT COUNT(*) AS n FROM questions WHERE quiz_id = ?', quiz.id),
    },
    latest: null,
  };
  if (role === 'owner') {
    Object.assign(out.quiz, ownerExtras(quiz), { collection_id: quiz.collection_id });
  } else if (role === 'shared') {
    out.quiz.from = db.prepare('SELECT display_name FROM users WHERE id = ?').get(quiz.user_id).display_name;
  }
  if (req.user) {
    // Reopening a quiz shows the latest result.
    const last = db.prepare(`SELECT * FROM attempts WHERE quiz_id = ? AND user_id = ? AND kind = 'quiz' AND completed_at IS NOT NULL
                             ORDER BY completed_at DESC, id DESC LIMIT 1`).get(quiz.id, req.user.id);
    if (last) out.latest = resultOf(last, true);
  }
  return out;
});

app.get('/api/quizzes/:id/shares', { auth: true }, (req) => {
  const { quiz } = quizFor(req, 'owner');
  return { is_public: Boolean(quiz.is_public), shares: sharesOf(quiz.id) };
});

const sharesOf = (quizId) => db.prepare(`SELECT u.id, u.username, u.display_name FROM quiz_shares s JOIN users u ON u.id = s.user_id
  WHERE s.quiz_id = ? ORDER BY s.created_at`).all(quizId);

app.post('/api/quizzes/:id/public', { auth: true }, (req) => {
  const { quiz } = quizFor(req, 'owner');
  const on = req.body.is_public ? 1 : 0;
  db.prepare('UPDATE quizzes SET is_public = ? WHERE id = ?').run(on, quiz.id);
  return { is_public: Boolean(on) };
});

app.post('/api/quizzes/:id/shares', { auth: true }, (req) => {
  const { quiz } = quizFor(req, 'owner');
  limit(`share:${req.user.id}`, 30, 600);
  const name = String(req.body.username || '').trim().replace(/^@/, '');
  const other = name ? db.prepare('SELECT id FROM users WHERE username = ?').get(name) : null;
  if (!other) throw new HttpError(404, 'Hittar ingen med det användarnamnet. Kolla stavningen med din kompis.');
  if (other.id === req.user.id) throw new HttpError(400, 'Det är du! Skriv en kompis användarnamn.');
  if (count('SELECT COUNT(*) AS n FROM quiz_shares WHERE quiz_id = ?', quiz.id) >= LIMITS.shares) {
    throw new HttpError(403, 'Så många kan inte få quizet var för sig – gör det öppet med länken i stället.', { code: 'limit' });
  }
  db.prepare('INSERT OR IGNORE INTO quiz_shares (quiz_id, user_id, created_at) VALUES (?, ?, ?)').run(quiz.id, other.id, now());
  return { shares: sharesOf(quiz.id) };
});

app.post('/api/quizzes/:id/shares/remove', { auth: true }, (req) => {
  const { quiz } = quizFor(req, 'owner');
  db.prepare('DELETE FROM quiz_shares WHERE quiz_id = ? AND user_id = ?').run(quiz.id, Number(req.body.user_id) || 0);
  return { shares: sharesOf(quiz.id) };
});

app.post('/api/quizzes/:id/delete', { auth: true }, (req) => {
  const { quiz } = quizFor(req, 'owner');
  tx(() => {
    db.prepare('DELETE FROM attempts WHERE quiz_id = ? AND (user_id IS NULL OR completed_at IS NULL)').run(quiz.id);
    db.prepare('DELETE FROM quizzes WHERE id = ?').run(quiz.id);
  });
  return { ok: true };
});

// ---------------------------------------------------------------- playing: start, submit, result

const questionsById = (ids) => new Map(db.prepare('SELECT * FROM questions WHERE id IN (SELECT value FROM json_each(?))')
  .all(JSON.stringify(ids)).map((q) => [q.id, q]));

/** What the player gets: no correct answer, no explanation, nothing that tells them apart. */
function playable(attempt) {
  const layout = parse(attempt.layout, []);
  const qs = questionsById(layout.map((x) => x.q));
  const questions = [];
  for (const item of layout) {
    const q = qs.get(item.q);
    if (!q) continue;                                    // its quiz was deleted meanwhile
    const texts = new Map(parse(q.options, []).map((o) => [o.id, o.text]));
    questions.push({ id: q.id, text: q.question_text, topic: q.topic, options: item.o.map((oid) => ({ id: oid, text: texts.get(oid) || '' })) });
  }
  return { attempt: { token: attempt.token, kind: attempt.kind, title: attempt.title, total: questions.length }, questions };
}

function newAttempt({ kind, quizId, collectionId, userId, title, questions }) {
  const layout = questions.map((q) => ({ q: q.id, o: shuffle(parse(q.options, []).map((o) => o.id)) }));
  const token = random(18);
  db.prepare(`INSERT INTO attempts (token, kind, quiz_id, collection_id, user_id, title, layout, total, started_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(token, kind, quizId, collectionId, userId, title, JSON.stringify(layout), layout.length, now());
  return db.prepare('SELECT * FROM attempts WHERE token = ?').get(token);
}

const stale = () => new Date(Date.now() - 2 * 864e5).toISOString();
const sweep = () => db.prepare('DELETE FROM attempts WHERE completed_at IS NULL AND started_at < ?').run(stale());

app.post('/api/quizzes/:id/start', (req) => {
  const { quiz } = quizFor(req);
  sweep();
  // A reload in the middle of a quiz continues the same attempt, with the options in the same order.
  let open = null;
  if (req.user) {
    open = db.prepare(`SELECT * FROM attempts WHERE quiz_id = ? AND user_id = ? AND kind = 'quiz' AND completed_at IS NULL
                       ORDER BY id DESC LIMIT 1`).get(quiz.id, req.user.id);
  } else if (typeof req.body.resume === 'string') {
    open = db.prepare('SELECT * FROM attempts WHERE token = ? AND quiz_id = ? AND user_id IS NULL AND completed_at IS NULL').get(req.body.resume, quiz.id);
  }
  if (!open) {
    if (!req.user) limit(`anon:${clientIp(req)}`, 60, 3600, 'Många quiz härifrån på kort tid – vänta en stund.');
    const questions = db.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index').all(quiz.id);
    open = newAttempt({ kind: 'quiz', quizId: quiz.id, collectionId: null, userId: req.user ? req.user.id : null, title: quiz.title, questions });
  }
  return { ...playable(open), quiz: { id: quiz.slug, title: quiz.title, demo: Boolean(quiz.demo) } };
});

/** question id -> 1/0: how the user answered each question the last time it was asked. */
function lastAnswers(userId, where, arg) {
  const rows = db.prepare(`SELECT a.question_id, a.is_correct FROM answers a
    JOIN attempts t ON t.id = a.attempt_id JOIN questions q ON q.id = a.question_id JOIN quizzes z ON z.id = q.quiz_id
    WHERE t.user_id = ? AND t.completed_at IS NOT NULL AND ${where}
    ORDER BY t.completed_at DESC, t.id DESC`).all(userId, arg);
  const last = new Map();
  for (const r of rows) if (!last.has(r.question_id)) last.set(r.question_id, r.is_correct);
  return last;
}

/** "Det svåra": the collection's questions the user got wrong the last time, most recent first. */
function hardQuestions(userId, collectionId) {
  return [...lastAnswers(userId, 'z.collection_id = ?', collectionId)].filter(([, ok]) => !ok).map(([qid]) => qid);
}

app.post('/api/collections/:id/practice', { auth: true }, (req) => {
  const c = ownCollection(req);
  sweep();
  const ids = hardQuestions(req.user.id, c.id).slice(0, PRACTICE_SIZE);
  let open = db.prepare(`SELECT * FROM attempts WHERE collection_id = ? AND user_id = ? AND kind = 'practice' AND completed_at IS NULL
                         ORDER BY id DESC LIMIT 1`).get(c.id, req.user.id);
  // A round left open is continued only while it still is what is hard now (a quiz done since changes that).
  if (open && JSON.stringify(parse(open.layout, []).map((x) => x.q)) !== JSON.stringify(ids)) {
    db.prepare('DELETE FROM attempts WHERE id = ?').run(open.id);
    open = null;
  }
  if (!open) {
    if (!ids.length) throw new HttpError(400, 'Inget svårt att öva på just nu – snyggt! Gör ett quiz så fyller vi på.');
    const qs = questionsById(ids);
    open = newAttempt({ kind: 'practice', quizId: null, collectionId: c.id, userId: req.user.id, title: `Öva på det svåra – ${c.title}`.slice(0, 120),
      questions: ids.map((qid) => qs.get(qid)).filter(Boolean) });
  }
  return { ...playable(open), collection: { id: c.id, title: c.title } };
});

app.post('/api/attempts/:token/submit', (req) => {
  const attempt = db.prepare('SELECT * FROM attempts WHERE token = ?').get(String(req.params.token));
  // An attempt belongs to the account that started it; one started without an account to whoever holds its token.
  if (!attempt || (attempt.user_id && (!req.user || req.user.id !== attempt.user_id))) throw new HttpError(404, NOT_FOUND);
  if (attempt.completed_at) return finished(attempt, req.user);        // a double tap gets the same result
  // A quiz that stopped being shared or public while it was being played is closed: no review of its answers.
  if (attempt.quiz_id && !roleIn(db.prepare('SELECT * FROM quizzes WHERE id = ?').get(attempt.quiz_id), req.user)) throw new HttpError(404, NOT_FOUND);
  const given = req.body.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
  const layout = parse(attempt.layout, []);
  const qs = questionsById(layout.map((x) => x.q));
  const asked = layout.filter((x) => qs.has(x.q));
  if (!asked.length) throw new HttpError(410, 'Det här quizet finns inte längre.');

  const userId = attempt.user_id;
  tx(() => {
    const before = userId ? lastAnswers(userId, 'q.id IN (SELECT value FROM json_each(?))', JSON.stringify(asked.map((x) => x.q))) : new Map();
    const insert = db.prepare('INSERT INTO answers (attempt_id, question_id, selected, is_correct) VALUES (?, ?, ?, ?)');
    let score = 0;
    let fixed = 0;
    for (const item of asked) {
      const q = qs.get(item.q);
      const picked = given[item.q];
      const selected = typeof picked === 'string' && item.o.includes(picked) ? picked : null;
      const ok = selected === q.correct_id;
      insert.run(attempt.id, q.id, selected, ok ? 1 : 0);
      if (ok) score++;
      if (ok && before.get(q.id) === 0) fixed++;
    }
    const total = asked.length;
    let xp = 0;
    let improved = 0;
    const day = localDay();
    if (userId && attempt.kind === 'practice') {
      xp = PRACTICE_XP * fixed;
    } else if (userId && attempt.quiz_id) {
      const earlier = db.prepare(`SELECT score, total, day FROM attempts WHERE user_id = ? AND quiz_id = ? AND kind = 'quiz'
                                  AND completed_at IS NOT NULL`).all(userId, attempt.quiz_id);
      const best = earlier.length ? Math.max(...earlier.map((a) => share(a.score, a.total))) : null;
      xp = quizXp(share(score, total), best, earlier.some((a) => a.day === day));
      improved = best !== null && share(score, total) > best ? 1 : 0;
    }
    db.prepare('UPDATE attempts SET score = ?, total = ?, xp = ?, fixed = ?, improved = ?, day = ?, completed_at = ? WHERE id = ?')
      .run(score, total, xp, fixed, improved, day, now(), attempt.id);
  });
  return finished(db.prepare('SELECT * FROM attempts WHERE id = ?').get(attempt.id), req.user);
});

function finished(attempt, user) {
  // Without an account: the score only (the review is the reason to make one).
  if (!attempt.user_id || !user) return { result: resultOf(attempt, false) };
  return { result: resultOf(attempt, true), game: game(user.id) };
}

/** The result of a completed attempt; with review = true also every question with its right answer. */
function resultOf(attempt, review) {
  const out = {
    token: attempt.token, kind: attempt.kind, title: attempt.title, score: attempt.score, total: attempt.total,
    pct: pct(attempt.score, attempt.total), completed_at: attempt.completed_at,
  };
  if (!review) return out;
  Object.assign(out, { xp: attempt.xp, fixed: attempt.fixed, improved: Boolean(attempt.improved) });
  const answers = new Map(db.prepare('SELECT * FROM answers WHERE attempt_id = ?').all(attempt.id).map((a) => [a.question_id, a]));
  const layout = parse(attempt.layout, []);
  const qs = questionsById(layout.map((x) => x.q));
  const topics = new Map();
  out.review = [];
  for (const item of layout) {
    const q = qs.get(item.q);
    const a = answers.get(item.q);
    if (!q || !a) continue;
    const texts = new Map(parse(q.options, []).map((o) => [o.id, o.text]));
    const t = topics.get(q.topic || '') || { topic: q.topic || '', correct: 0, total: 0 };
    t.total++;
    t.correct += a.is_correct;
    topics.set(q.topic || '', t);
    out.review.push({
      id: q.id, text: q.question_text, topic: q.topic,
      options: item.o.map((oid) => ({ id: oid, text: texts.get(oid) || '' })),
      selected: a.selected, correct: q.correct_id, is_correct: Boolean(a.is_correct),
      explanation: q.explanation, misconception: q.misconception, exam_tip: q.exam_tip, exam_likelihood: q.exam_likelihood,
      difficulty: q.difficulty, bloom_level: q.bloom_level, page_references: parse(q.page_references, []),
    });
  }
  out.topics = [...topics.values()];
  return out;
}

// ---------------------------------------------------------------- statistics

app.get('/api/stats', { auth: true }, (req) => {
  const uid = req.user.id;
  const attempts = db.prepare(`SELECT t.kind, t.title, t.score, t.total, t.xp, t.completed_at, z.slug FROM attempts t
    LEFT JOIN quizzes z ON z.id = t.quiz_id
    WHERE t.user_id = ? AND t.completed_at IS NOT NULL AND t.total > 0 ORDER BY t.completed_at DESC, t.id DESC`).all(uid);
  const row = (a) => ({ kind: a.kind, title: a.title, score: a.score, total: a.total, pct: pct(a.score, a.total), xp: a.xp, at: a.completed_at, quiz: a.slug || null });
  const topics = db.prepare(`SELECT q.topic, SUM(a.is_correct) AS correct, COUNT(*) AS total FROM answers a
    JOIN attempts t ON t.id = a.attempt_id JOIN questions q ON q.id = a.question_id
    WHERE t.user_id = ? AND t.completed_at IS NOT NULL AND q.topic <> '' GROUP BY q.topic
    ORDER BY 1.0 * SUM(a.is_correct) / COUNT(*) DESC, COUNT(*) DESC LIMIT 8`).all(uid);
  return {
    done: attempts.length,
    average: attempts.length ? Math.round(attempts.reduce((n, a) => n + 100 * share(a.score, a.total), 0) / attempts.length) : null,
    collections: count('SELECT COUNT(*) AS n FROM collections WHERE user_id = ?', uid),
    chart: attempts.slice(0, 20).reverse().map(row),
    recent: attempts.slice(0, 10).map(row),
    topics: topics.map((t) => ({ topic: t.topic, correct: t.correct, total: t.total, pct: pct(t.correct, t.total) })),
    game: game(uid),
  };
});

sweep();
db.prepare('DELETE FROM attempts WHERE user_id IS NULL AND quiz_id IS NULL').run();
app.listen();
