'use strict';
// Gamification, computed from stored attempts so nothing lives in memory: XP, levels, the day
// streak and badges. The rewards follow learning, not clicking: a new quiz pays by score, a
// retake pays only for what you improved, and "Öva på det svåra" pays per question you now get
// right that you had wrong before.

const { db, now } = require('./core');

// Days are counted in the pupils' time zone, so an evening session does not land on "tomorrow".
function dayFormatter() {
  const make = (timeZone) => new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  try { return make(process.env.APP_TIMEZONE || 'Europe/Stockholm'); } catch (e) { return make('Europe/Stockholm'); }
}
const dayFmt = dayFormatter();
const localDay = (date = new Date()) => dayFmt.format(date);          // "2026-11-22"
function shiftDay(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const LEVELS = ['Nyfiken', 'Pluggare', 'Antecknare', 'Kunskapsjägare', 'Quizräv', 'Tankesmed', 'Provproffs', 'Hjärntrust', 'Mästare', 'Geni'];
const levelStart = (level) => 50 * level * (level - 1);               // 0, 100, 300, 600, 1000 …

function levelFor(xp) {
  let level = 1;
  while (xp >= levelStart(level + 1)) level++;
  return { level, name: LEVELS[Math.min(level, LEVELS.length) - 1], floor: levelStart(level), next: levelStart(level + 1) };
}

function streaks(days) {            // days: unique, ascending
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    run = prev && shiftDay(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  const set = new Set(days);
  const today = localDay();
  let current = 0;
  let d = set.has(today) ? today : shiftDay(today, -1);   // yesterday still counts: the streak is alive until midnight
  while (set.has(d)) { current++; d = shiftDay(d, -1); }
  return { current, longest, today: set.has(today) };
}

/** XP for a finished quiz. bestBefore: the best share right on earlier attempts, or null. */
function quizXp(share, bestBefore, playedToday) {
  if (bestBefore === null) return 20 + Math.round(80 * share);
  return Math.max(0, Math.round(80 * (share - bestBefore))) + (playedToday ? 0 : 5);
}
const PRACTICE_XP = 8;              // per question answered right that was wrong before

const BADGES = [
  ['first_quiz', 'Första quizet', 'Gör klart ditt första quiz', 1, (s) => s.done],
  ['perfect', 'Alla rätt', 'Få alla rätt på ett quiz', 1, (s) => s.perfect],
  ['improved', 'Revansch', 'Gör om ett quiz och slå ditt eget resultat', 1, (s) => s.improved],
  ['practice', 'Modig', 'Gör en runda Öva på det svåra', 1, (s) => s.practice],
  ['fixed10', 'Nöten knäckt', 'Svara rätt på tio frågor du haft fel på förut', 10, (s) => s.fixed],
  ['streak3', 'Tre i rad', 'Plugga tre dagar i rad', 3, (s) => s.longest],
  ['streak7', 'En hel vecka', 'Plugga sju dagar i rad', 7, (s) => s.longest],
  ['quizzes10', 'Tio quiz', 'Gör klart tio quiz', 10, (s) => s.done],
  ['collections5', 'Samlare', 'Skapa fem samlingar', 5, (s) => s.collections],
  ['pages10', 'Skannare', 'Låt Quizla läsa tio sidor', 10, (s) => s.pages],
  ['sharer', 'Lagspelare', 'Dela ett quiz med en klasskompis', 1, (s) => s.shared],
];

/**
 * Everything the game shows for one user. Badges are remembered once earned (deleting a
 * collection later does not take "Samlare" away); `fresh` lists the ones earned just now.
 */
function game(userId) {
  const attempts = db.prepare(`SELECT kind, score, total, xp, fixed, improved, day FROM attempts
    WHERE user_id = ? AND completed_at IS NOT NULL ORDER BY completed_at, id`).all(userId);
  const one = (sql) => db.prepare(sql).get(userId).n;
  const s = {
    done: attempts.length,
    perfect: attempts.filter((a) => a.kind === 'quiz' && a.total >= 3 && a.score === a.total).length,
    improved: attempts.filter((a) => a.improved).length,
    practice: attempts.filter((a) => a.kind === 'practice').length,
    fixed: attempts.reduce((n, a) => n + a.fixed, 0),
    collections: one('SELECT COUNT(*) AS n FROM collections WHERE user_id = ?'),
    pages: one(`SELECT COUNT(*) AS n FROM pages p JOIN collections c ON c.id = p.collection_id
                WHERE c.user_id = ? AND p.status = 'analyzed'`),
    shared: one(`SELECT (SELECT COUNT(*) FROM quiz_shares s JOIN quizzes z ON z.id = s.quiz_id WHERE z.user_id = ?1)
                      + (SELECT COUNT(*) FROM quizzes WHERE user_id = ?1 AND is_public = 1) AS n`),
  };
  const streak = streaks([...new Set(attempts.map((a) => a.day).filter(Boolean))].sort());
  s.longest = streak.longest;

  const earned = new Map(db.prepare('SELECT badge, earned_at FROM badges WHERE user_id = ?').all(userId).map((b) => [b.badge, b.earned_at]));
  const fresh = [];
  const badges = BADGES.map(([id, name, description, target, value]) => {
    const have = Math.min(value(s), target);
    if (have >= target && !earned.has(id)) {
      const at = now();
      db.prepare('INSERT OR IGNORE INTO badges (user_id, badge, earned_at) VALUES (?, ?, ?)').run(userId, id, at);
      earned.set(id, at);
      fresh.push(id);
    }
    return { id, name, description, target, have: earned.has(id) ? target : have, earned: earned.has(id), earned_at: earned.get(id) || null };
  });
  const xp = attempts.reduce((n, a) => n + a.xp, 0);
  return { xp, ...levelFor(xp), streak, badges, fresh: badges.filter((b) => fresh.includes(b.id)) };
}

module.exports = { game, quizXp, levelFor, localDay, PRACTICE_XP };
