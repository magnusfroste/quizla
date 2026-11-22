'use strict';
// The shared foundation of the app's server: HTTP routing, static files, SQLite, accounts and
// sessions, and the call to the AI model. No packages – Node's standard library only
// (node:http, node:sqlite, node:crypto), so the app builds in seconds and has nothing to update.
//
// What it gives the app (see server.js):
//   const { app, db, ai, HttpError } = require('./lib/core');
//   app.migrate([`CREATE TABLE …`, …]);                       // run once each, in order
//   app.get('/api/things', { auth: true }, (req) => ({ … }));  // return an object -> JSON
//   app.post('/api/scan', { auth: true, maxBody: 8e6 }, async (req) => { req.body, req.user … });
//   app.listen();
//
// Accounts are deliberately small: a username and a password, nothing else. The apps are for
// school children, so no e-mail address, no real name and no tracking is asked for or stored.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 8080);
const SESSION_DAYS = 30;
const COOKIE = 'sid';

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'app.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra || {};
  }
}

// ---------------------------------------------------------------- database

function migrate(steps) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (n INTEGER NOT NULL)');
  const row = db.prepare('SELECT n FROM schema_version').get();
  let done = row ? row.n : 0;
  if (!row) db.prepare('INSERT INTO schema_version (n) VALUES (0)').run();
  for (let i = done; i < steps.length; i++) {
    db.exec('BEGIN');
    try {
      db.exec(steps[i]);
      db.prepare('UPDATE schema_version SET n = ?').run(i + 1);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw new Error(`migration ${i + 1} failed: ${e.message}`);
    }
  }
}

const CORE_MIGRATIONS = [
  `CREATE TABLE users (
     id INTEGER PRIMARY KEY,
     username TEXT NOT NULL UNIQUE COLLATE NOCASE,
     display_name TEXT NOT NULL,
     pass_hash TEXT NOT NULL,
     pass_salt TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
     expires_at TEXT NOT NULL
   );
   CREATE INDEX sessions_user ON sessions(user_id);
   CREATE TABLE ai_usage (
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     day TEXT NOT NULL,
     calls INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (user_id, day)
   );`,
];

function tx(fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const today = () => now().slice(0, 10);

// ---------------------------------------------------------------- accounts

const USERNAME_RE = /^[a-z0-9åäö_-]{3,24}$/i;

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex');
}

function createUser(username, password, displayName) {
  username = String(username || '').trim();
  displayName = String(displayName || username).trim().slice(0, 40) || username;
  if (!USERNAME_RE.test(username)) {
    throw new HttpError(400, 'Användarnamnet ska vara 3–24 tecken: bokstäver, siffror, - eller _.');
  }
  if (String(password || '').length < 6) throw new HttpError(400, 'Lösenordet behöver minst 6 tecken.');
  if (String(password).length > 200) throw new HttpError(400, 'Lösenordet är för långt.');
  const salt = crypto.randomBytes(16).toString('hex');
  try {
    const r = db.prepare('INSERT INTO users (username, display_name, pass_hash, pass_salt) VALUES (?, ?, ?, ?)')
      .run(username, displayName, hashPassword(password, salt), salt);
    return Number(r.lastInsertRowid);
  } catch (e) {
    if (/UNIQUE/.test(e.message)) throw new HttpError(409, 'Det användarnamnet är upptaget – välj ett annat.');
    throw e;
  }
}

function checkLogin(username, password) {
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').trim());
  // Hash even when the user does not exist, so the answer takes the same time either way.
  const hash = hashPassword(String(password || ''), u ? u.pass_salt : '00'.repeat(16));
  if (!u || !crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(u.pass_hash, 'hex'))) {
    throw new HttpError(401, 'Fel användarnamn eller lösenord.');
  }
  return u.id;
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function startSession(res, req, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(sha(token), userId, expires.toISOString());
  setCookie(res, req, token, SESSION_DAYS * 86400);
}

function setCookie(res, req, value, maxAge) {
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(req.headers.host || '');
  res.appendHeader('Set-Cookie',
    `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${local ? '' : '; Secure'}`);
}

function sessionUser(req) {
  const m = /(?:^|;\s*)sid=([A-Za-z0-9_-]{20,})/.exec(req.headers.cookie || '');
  if (!m) return null;
  const row = db.prepare(
    `SELECT u.id, u.username, u.display_name, u.created_at, s.token_hash FROM sessions s
     JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`).get(sha(m[1]), new Date().toISOString());
  return row || null;
}

// ---------------------------------------------------------------- small guards

const hits = new Map();   // key -> [timestamps]; in memory is enough for one replica
function limit(key, max, perSeconds, message) {
  const t = Date.now();
  const list = (hits.get(key) || []).filter((x) => t - x < perSeconds * 1000);
  if (list.length >= max) throw new HttpError(429, message || 'För många försök – vänta en stund.');
  list.push(t);
  hits.set(key, list);
  if (hits.size > 5000) for (const k of hits.keys()) { hits.delete(k); if (hits.size < 2500) break; }
}

function clientIp(req) {
  return String(req.headers['x-real-ip'] || req.socket.remoteAddress || '').slice(0, 60);
}

// ---------------------------------------------------------------- the AI model

// Any OpenAI-compatible endpoint: OPENAI_API_KEY (a secret variable on the app), and optionally
// OPENAI_BASE_URL and OPENAI_MODEL. Without a key the app says so and offers its demo answers –
// nothing is sent anywhere.
const AI = {
  key: () => process.env.OPENAI_API_KEY || '',
  base: () => (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
  model: () => process.env.OPENAI_MODEL || 'gpt-4.1',     // gpt-4o-mini was too kind and too vague – tried live 2026-11-22
  dailyLimit: () => Number(process.env.AI_DAILY_LIMIT || 30),
};

const ai = {
  configured: () => Boolean(AI.key()),
  model: AI.model,

  /** Count one call for the user today; refuses when the day's allowance is used up. */
  spend(userId) {
    const day = today();
    const row = db.prepare('SELECT calls FROM ai_usage WHERE user_id = ? AND day = ?').get(userId, day);
    if (row && row.calls >= AI.dailyLimit()) {
      throw new HttpError(429, `Du har använt dagens ${AI.dailyLimit()} AI-analyser. Kom tillbaka i morgon!`);
    }
    db.prepare(`INSERT INTO ai_usage (user_id, day, calls) VALUES (?, ?, 1)
                ON CONFLICT (user_id, day) DO UPDATE SET calls = calls + 1`).run(userId, day);
  },

  /**
   * One chat completion that must answer with a JSON object.
   * images: data URLs ("data:image/jpeg;base64,…"). Returns the parsed object.
   */
  async json({ system, user, images = [], maxTokens = 2000, temperature = 0.4 }) {
    if (!ai.configured()) throw new HttpError(503, 'AI är inte påslagen för den här appen ännu.', { code: 'ai_not_configured' });
    const content = [{ type: 'text', text: user }, ...images.map((url) => ({ type: 'image_url', image_url: { url } }))];
    const messages = [...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: images.length ? content : user }];
    let res;
    try {
      res = await fetch(`${AI.base()}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${AI.key()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: AI.model(), messages, max_tokens: maxTokens, temperature,
          response_format: { type: 'json_object' } }),
        signal: AbortSignal.timeout(120000),
      });
    } catch (e) {
      throw new HttpError(502, 'AI-tjänsten svarade inte. Försök igen om en stund.', { code: 'ai_unreachable' });
    }
    if (res.status === 429) throw new HttpError(429, 'AI-tjänsten har mycket att göra just nu. Vänta lite och försök igen.');
    if (!res.ok) {
      console.error(`ai: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
      throw new HttpError(502, 'AI-tjänsten kunde inte svara. Försök igen om en stund.', { code: 'ai_failed' });
    }
    const body = await res.json();
    let text = body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content || '';
    text = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) { /* fall through */ }
    console.error(`ai: not JSON: ${text.slice(0, 200)}`);
    throw new HttpError(502, 'AI-tjänsten gav ett svar som inte gick att läsa. Försök igen.', { code: 'ai_bad_json' });
  },
};

/** "data:image/jpeg;base64,…" -> { mime, buffer }; refuses anything that is not a small image. */
function parseImage(dataUrl, maxBytes = 3.5e6) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new HttpError(400, 'Bilden gick inte att läsa. Ta ett nytt foto och försök igen.');
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length < 1000) throw new HttpError(400, 'Bilden verkar tom. Ta ett nytt foto.');
  if (buffer.length > maxBytes) throw new HttpError(413, 'Bilden är för stor.');
  return { mime: m[1], buffer };
}

// ---------------------------------------------------------------- HTTP

const routes = [];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};
const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; " +
    "script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

function route(method, pattern, opts, handler) {
  if (typeof opts === 'function') { handler = opts; opts = {}; }
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:[a-zA-Z]+/g, (k) => { keys.push(k.slice(1)); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, opts, handler });
}

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > max) { chunks = null; if (size > max * 4) req.destroy(); return; }   // keep reading a little, so the answer gets through
      if (chunks) chunks.push(c);
    });
    req.on('end', () => (chunks ? resolve(Buffer.concat(chunks)) : reject(new HttpError(413, 'Det som skickades är för stort.'))));
    req.on('error', reject);
  });
}

function send(res, status, body, headers = {}) {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': data.length,
    'Cache-Control': 'no-store', ...HEADERS, ...headers });
  res.end(data);
}

function serveStatic(req, res, urlPath) {
  let rel;
  try { rel = decodeURIComponent(urlPath); } catch (e) { return send(res, 400, { error: 'bad path' }); }
  if (rel.includes('\0') || rel.includes('..')) return send(res, 400, { error: 'bad path' });
  let file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) return send(res, 400, { error: 'bad path' });
  if (!path.extname(file) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (path.extname(rel) && !rel.endsWith('.html')) return send(res, 404, { error: 'not found' });
    file = path.join(PUBLIC, 'index.html');          // one page: every address without a file is the app
  }
  const ext = path.extname(file);
  const data = fs.readFileSync(file);
  res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Content-Length': data.length,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300', ...HEADERS });
  res.end(req.method === 'HEAD' ? undefined : data);
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  if (p === '/healthz') return send(res, 200, { ok: true });
  if (!p.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' });
    return serveStatic(req, res, p);
  }
  const started = Date.now();
  let status = 200;
  try {
    const hit = routes.map((r) => ({ r, m: r.method === req.method && r.re.exec(p) })).find((x) => x.m);
    if (!hit) throw new HttpError(routes.some((r) => r.re.test(p)) ? 405 : 404, 'Den adressen finns inte.');
    const { r, m } = hit;
    if (req.method !== 'GET') {
      // A page on another site must not be able to act as the signed-in child: the cookie is
      // SameSite=Lax, and a request that changes something must come from this site, as JSON.
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, 'Fel avsändare.');
      if (!/^application\/json/.test(req.headers['content-type'] || '')) throw new HttpError(415, 'JSON förväntas.');
    }
    try {
      req.params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    } catch (e) { throw new HttpError(400, 'Den adressen går inte att läsa.'); }
    req.query = Object.fromEntries(url.searchParams);
    req.user = sessionUser(req);
    if (r.opts.auth && !req.user) throw new HttpError(401, 'Du behöver logga in.');
    if (req.method !== 'GET') {
      const raw = await readBody(req, r.opts.maxBody || 64 * 1024);
      try { req.body = raw.length ? JSON.parse(raw.toString('utf8')) : {}; } catch (e) { throw new HttpError(400, 'Trasig JSON.'); }
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new HttpError(400, 'Ett JSON-objekt förväntas.');
    }
    const out = await r.handler(req, res);
    if (res.writableEnded) return;
    if (Buffer.isBuffer(out && out.buffer)) {
      return send(res, 200, out.buffer, { 'Content-Type': out.type || 'application/octet-stream', 'Cache-Control': 'private, max-age=3600' });
    }
    send(res, 200, out === undefined ? { ok: true } : out);
  } catch (e) {
    status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(`${req.method} ${p}: ${e.stack || e}`);
    if (!res.headersSent) send(res, status, { error: status === 500 ? 'Något gick fel hos oss. Försök igen.' : e.message, ...(e.extra || {}) });
  } finally {
    console.log(`${req.method} ${p} ${status} ${Date.now() - started}ms`);
  }
}

// ---------------------------------------------------------------- the account routes every app has

function accountRoutes() {
  route('POST', '/api/auth/signup', (req, res) => {
    limit(`signup:${clientIp(req)}`, 10, 3600, 'För många nya konton härifrån – försök igen senare.');
    const id = createUser(req.body.username, req.body.password, req.body.display_name);
    startSession(res, req, id);
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) };
  });
  route('POST', '/api/auth/login', (req, res) => {
    limit(`login:${clientIp(req)}`, 12, 300);
    limit(`login-user:${String(req.body.username || '').toLowerCase()}`, 8, 300);
    const id = checkLogin(req.body.username, req.body.password);
    startSession(res, req, id);
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) };
  });
  route('POST', '/api/auth/logout', (req, res) => {
    if (req.user) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.user.token_hash);
    setCookie(res, req, '', 0);
    return { ok: true };
  });
  route('GET', '/api/me', (req) => ({ user: req.user ? publicUser(req.user) : null, ai: { configured: ai.configured() } }));
  // The right to be forgotten, for a child or a parent: everything the account has, gone.
  route('POST', '/api/auth/delete', { auth: true }, (req, res) => {
    checkLogin(req.user.username, req.body.password);
    for (const fn of onDeleteUser) fn(req.user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
    setCookie(res, req, '', 0);
    return { ok: true };
  });
}

const onDeleteUser = [];
const publicUser = (u) => ({ id: u.id, username: u.username, display_name: u.display_name, created_at: u.created_at });

// ---------------------------------------------------------------- start

function listen() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  const server = http.createServer((req, res) => { handle(req, res).catch((e) => { console.error(e); try { res.destroy(); } catch (_) { /* gone */ } }); });
  server.requestTimeout = 150000;
  server.listen(PORT, () => console.log(`listening on :${PORT}, data in ${DATA_DIR}, AI ${ai.configured() ? AI.model() : 'not configured (demo answers)'}`));
  const stop = () => { server.close(() => { try { db.close(); } catch (_) { /* closed */ } process.exit(0); }); setTimeout(() => process.exit(0), 5000).unref(); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  return server;
}

migrate(CORE_MIGRATIONS);
accountRoutes();

const app = {
  get: (p, o, h) => route('GET', p, o, h),
  post: (p, o, h) => route('POST', p, o, h),
  /** App tables: numbered after the core's own, so pass ALL the app's steps every time, in order. */
  migrate: (steps) => migrate([...CORE_MIGRATIONS, ...steps]),
  onDeleteUser: (fn) => onDeleteUser.push(fn),
  listen,
};

module.exports = { app, db, tx, ai, HttpError, limit, clientIp, parseImage, now, today, DATA_DIR, PUBLIC };
