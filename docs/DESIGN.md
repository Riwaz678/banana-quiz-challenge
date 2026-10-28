# Design notes

## What the system is

A quiz game. The Banana API sends a picture with one digit hidden behind a
banana, the player types the digit. There are accounts, a score per player and
a leaderboard that updates in every open browser tab.

## Components and how they talk

```
   browser (client/)
        |  HTTP + JSON            fetch(), EventSource()
        v
   game server :3000 (server/)  -- node process A
        |  HTTPS + JSON           GET ?out=json&base64=no
        v
   Banana API (marcconrad.com)   external, required by the unit

   game server :3000
        |  HTTP + JSON            POST /scores, GET /scores
        v
   leaderboard service :4000 (leaderboard/) -- node process B
        |
        v
   data/leaderboard.json, data/users.json (plain files on disk)
```

Three programs run separately: the browser, the game server and the
leaderboard service. The browser never contacts the Banana API or the
leaderboard directly. Everything goes through the game server, which is the
only component that decides what each side is allowed to see.

### 1. Browser — `client/`

Plain HTML, CSS and JavaScript. No framework, no build step. Three jobs:

- send login/answers with `fetch`
- show the question image, score, leaderboard, activity feed
- hold the event stream open with `EventSource`

### 2. Game server — `server/`, port 3000

| file | responsibility |
|---|---|
| `server.js` | routing, wiring the event handlers, static files |
| `lib/bananaClient.js` | talks to the Banana API (timeout, validation, error kinds) |
| `lib/leaderboardClient.js` | talks to the leaderboard service |
| `lib/auth.js` | register/verify, scrypt password hashes, users file |
| `lib/sessions.js` | session cookie store, cookie parsing |
| `lib/gameStore.js` | per player question/score state, answer checking |
| `lib/gameEvents.js` | creates the event bus (EventEmitter) |

### 3. Leaderboard service — `leaderboard/`, port 4000

| file | responsibility |
|---|---|
| `service.js` | tiny REST API: `GET /scores`, `POST /scores` |
| `lib/scoreStore.js` | keeps the best score per player, writes the json file, emits `score:updated` |

Why a second process at all: it makes the "distributed" part real. Two
programs, two ports, one contract (HTTP + JSON), neither imports the other's
code. The leaderboard could be rewritten in Java tomorrow and the game server
would not notice, as long as `GET /scores` keeps returning the same shape.

## Data flow of one question

1. player clicks **New question** → browser `fetch GET /api/question`
2. server checks the session cookie, no session → `401`
3. server calls the Banana API (`?out=json&base64=no`, 5 second timeout)
4. server stores `{ image, solution }` in `gameStore` under the username and
   sends **only the image** to the browser — the solution never leaves the
   server, otherwise the player could cheat with dev tools
5. player submits a digit → `POST /api/answer` → compare happens server side
6. correct → `bus.emit('answer:correct', ...)` and three listeners react:
   - log line for the terminal
   - SSE broadcast of an activity line to every connected browser
   - `POST /scores` to the leaderboard service (fire and forget, a failure
     there is logged but does not fail the answer)
7. leaderboard stores the score, emits `score:updated`, service broadcasts
   `leaderboard-changed` → browsers re-fetch `GET /api/leaderboard`

## Where each theme lives in the code

| theme | files | what to show |
|---|---|---|
| version control | `.git` | `git log --oneline --graph`, the `feature/leaderboard` branch and merge, tag `v1.0`, small commit messages |
| interoperability | `bananaClient.js`, `leaderboardClient.js`, `client/js/app.js` | real API response in `docs/evidence/`, REST + JSON over HTTP, status codes, timeouts |
| event-driven programming | `gameEvents.js`, `/api/events` in `server.js`, `scoreStore.js`, `client/js/app.js` | `bus.emit` in the routes, SSE frames in the network tab, DOM events in the browser |
| virtual identity | `auth.js`, `sessions.js`, `/api/login` in `server.js` | hashed passwords in `users.json`, `Set-Cookie` flags, `401` on protected routes, logout |

## Choices I would defend in the video (and their alternatives)

- **Server-side sessions instead of JWT.** Revoking a session is one map
  delete; with a stateless JWT you have to wait for expiry or keep a
  blocklist, which is a second store anyway. Downside: sessions live in
  memory, a restart logs everyone out, and it does not scale past one
  process without a shared store.
- **scrypt instead of bcrypt/argon2.** scrypt ships with Node, so the
  project stays at zero npm packages. bcrypt needs a native build; argon2 is
  the stronger choice today but a dependency either way.
- **SSE instead of WebSockets or polling.** The events only travel one way
  (server to browser) and browsers reconnect on their own. Polling would
  hammer the server; WebSockets would add a protocol I do not need.
- **Proxying the Banana API through my server.** The response contains the
  solution; it must stop at my server. A bonus: one place for timeouts and
  friendly errors, and the client does not depend on the API being online.
- **JSON files instead of a database.** No install for whoever runs the
  demo. At real scale (many writers, many rows) this would become SQLite or
  a proper database, because two processes writing files is asking for
  trouble.
- **Two processes with a REST contract instead of one process.** Costs a
  port and a startup line; buys an honest distributed architecture and a
  failure mode I can demonstrate (stop the leaderboard, the game survives).
