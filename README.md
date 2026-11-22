# Quizla

*Snap. Quiz. Ace.* – a study app for school pupils and students (Swedish UI). Photograph textbook
pages or notes into a collection, an AI reads them into a knowledge base, and writes quizzes from it
with a teacher's craft: wrong answers built on real misconceptions, explanations, exam tips.

One small Node server: no packages, no build step, SQLite for data, plain files for the photos.
It replaces the first version of Quizla, which ran on a hosted database.

## Run it

```bash
DATA_DIR=./data PORT=8080 node server.js      # Node >= 22.13 (uses node:sqlite)
```

Open http://localhost:8080. Without an AI key the app runs in **demo mode**: analysis and quiz
generation answer with a built-in Swedish example (fotosyntesen), clearly marked in the UI, so the
whole flow can be tried and tested. Nothing is sent anywhere.

| Variable | Meaning |
|---|---|
| `PORT` | Port to listen on (default 8080). |
| `DATA_DIR` | The only place written to (default `./data`). Put it on the persistent disk. |
| `OPENAI_API_KEY` | Key for an OpenAI-compatible endpoint. Unset = demo mode. |
| `OPENAI_BASE_URL` | Optional, default `https://api.openai.com/v1`. |
| `OPENAI_MODEL` | Optional, default `gpt-4.1`. Must read images and answer in JSON mode. |
| `AI_DAILY_LIMIT` | Model calls per user and day (default 30). One page read = one call, one quiz = one call. |
| `APP_TIMEZONE` | Time zone for the day streak (default `Europe/Stockholm`). |

## Test

```bash
bash test/api-test.sh        # or: node test/api-test.js
```

Starts the server on a spare port with a temporary `DATA_DIR` and walks the whole flow in demo mode
(two users, collection, pages, analysis, quiz, server-side grading, retake, "Öva på det svåra",
statistics, sharing, the public link without an account, access control, limits, a restart in the
middle of an analysis, account deletion), then once more against a stand-in AI endpoint inside the
test to check what is sent to the model. Exits non-zero on a failure.

## What is stored where

- `DATA_DIR/app.db` – SQLite: `users`, `sessions`, `ai_usage` (from `lib/core.js`), and the app's
  `collections`, `pages` (the photo's file name, type, analysis status and the analysis as JSON
  text columns), `quizzes`, `questions`, `quiz_shares`, `attempts`, `answers`, `badges`.
- `DATA_DIR/uploads/<userId>/<collectionId>/<random>.jpg` – the page photos, downscaled in the
  browser (max 1800 px, JPEG). Served only to the owner.
- Nothing important lives in memory: an analysis is one request per page and the pages' status is
  in the database, so it continues after a restart.

An account is a username and a password – no e-mail, no real name (many users are minors). No
tracking and no third-party requests from the browser. Deleting the account (Profil) removes the
rows and the files.

## How it is built

- `server.js` – tables and every route. `lib/core.js` – the shared foundation (HTTP, sessions,
  SQLite, the model call). `lib/prompts.js` – the original's two prompts, word for word, and the
  user message for quiz generation. `lib/demo.js` – the example answers. `lib/game.js` – XP,
  levels, streak, badges.
- `public/` – the browser side: plain ES modules, one per screen, and one stylesheet. The page has
  a CSP with `script-src 'self'`; text is always put in with text nodes.
- **Access** is checked on the server for every route: a collection, its pages and images are the
  owner's only; a quiz can be opened by its owner, by a user it is shared with (by username), or by
  anyone when it is public (`/quiz/<id>`, an unguessable id).
- **Grading** is on the server. A started attempt fixes the questions and the order of the options;
  the player gets question text and options with ids – never the right answer or the explanation.
  Without an account the result is the score only.
- **Gamification** follows learning: a new quiz gives 20 XP plus up to 80 by score; a retake pays
  only for what was improved; "Öva på det svåra" re-asks the questions answered wrong the last time
  (no AI call) and gives 8 XP per question now answered right. Day streak, levels and eleven badges
  are computed from the stored attempts.
- Fair use: 30 collections, 40 pages per collection, 12 quizzes per collection, and the daily AI limit.

## Left out of the port

- Read-aloud (ElevenLabs) and PDF export of the study view.
- Plans, pricing, the admin page with cost statistics, user roles.
- E-mail accounts – so sharing is by username, not by e-mail address.
- HEIC conversion in the browser (iOS hands a JPEG to a web page; other HEIC files get a friendly error).
- Realtime progress – replaced by the browser asking for one page at a time.
- Sharing a whole collection (the original had a table for it but no UI).

Fixed along the way (the original's quirks): page numbers are stable and unique within a collection;
changing a page to or from "Lärandemål" sends it back for analysis; limits, grading and access are
enforced on the server; an attempt is submitted in one request; `misconception_targeted` is kept and
shown in the review as "Vanligt misstag".
