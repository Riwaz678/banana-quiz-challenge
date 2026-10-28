# Video script draft

**Read this first.** This is a draft to learn from, not to read out. The brief
says the video must use your own voice and must not be made with AI, and
substantive editing is discouraged. Say it in your own words, pause where you
need to, and let mistakes stay in. Replace everything in `[square brackets]`
with your own experience — if you cannot fill a bracket with something true,
delete it.

Total target: 9 to 10 minutes. Record in one take where you can, demo first.

---

## 0:00–1:00 — Demo of the working system

Start both processes on camera (`npm run start:leaderboard`, then
`npm run start`), open localhost:3000.

Talk while you click:

- "This is the Banana Quiz Challenge. I register an account — username `x`,
  password has to be eight characters. Log in."
- Show the game area appearing after login. "New question goes to my server,
  my server asks the Banana API, I get the picture, the digit is hidden behind
  the banana."
- Answer wrong on purpose: "wrong, attempts goes up."
- Answer correctly: "correct, plus one, and watch the second tab I already
  open — the activity feed and the leaderboard update there without me
  refreshing."
- Log out: "the game area disappears because every game route now answers 401
  without a session."

Keep this tight. The detail comes later.

## 1:00–2:00 — Architecture and interoperability

Show `docs/DESIGN.md` diagram or just point at the three windows/processes.

- "Three separate parts: the browser, my game server on port 3000, and the
  leaderboard service on port 4000. They only talk over HTTP with JSON, so
  neither imports the other's code — that is what makes this a distributed
  architecture and not one program."
- **Locate:** "`bananaClient.js` is the only file that touches the external
  service."
- **Show:** the saved response in `docs/evidence/banana-api-response.txt` —
  real call, real body: `{ "question": "<image url>", "solution": 7 }`.
- **Explain:** "GET request, `out=json`, response parsed, then validated —
  question must be a string, solution must be a number, because the service
  actually replies with `Content-Type: text/html` even for JSON. I found that
  with curl, it is in the evidence file."
- **Mention errors:** "five second timeout, connection refused → 502, too
  slow → 504, the browser just gets a friendly message, and the game survives
  the API being down. There is a test for exactly that."
- Interop beyond the API: "the game server to the leaderboard is the same
  protocol, JSON over HTTP, POST /scores, GET /scores — REST verbs, status
  codes 201/400/404/502."
- Terminology: HTTP, REST, JSON, status codes, timeout, proxy.

## 2:00–3:45 — Version control

Terminal with `git log --oneline --graph`.

- "Git from day one, not at the end." Show the first commit and today's.
- **Locate:** open one small commit (`git show --stat`) — e.g. the tests
  commit — and say what changed and why it was separate.
- **Branching:** "I built the leaderboard on `feature/leaderboard`, two
  commits there including a wip one, then merged back with `--no-ff` so the
  branch is still visible in the graph."
- **Granularity:** "commits are small on purpose: timeout handling is one
  commit, login is another, the SSE feature another. Two quick fixes got
  their own commits — the env var regression after the refactor, and the bus
  where events logged twice. That is the point of version control: I can show
  you the exact step where a bug was introduced."
- **Code organization:** "one file per job — `auth.js`, `sessions.js`,
  `gameStore.js` — so commits touch one concern. If two people worked on
  this, `bananaClient.js` and `scoreStore.js` would not clash."
- **Evaluate:** "Alternatives: I did everything on main plus one branch
  because I am the only developer; with a team I would add short lived
  feature branches, pull requests and reviews, and tags per release — there
  is a `v1.0` tag here. Monolithic files would have been simpler to write but
  worse for review."

## 3:45–5:30 — Event-driven programming

- **Locate:** `server/lib/gameEvents.js` creates the bus, an `EventEmitter`.
  In `server.js` the routes `bus.emit('answer:correct', ...)`.
- **Explain:** "The route does not know who cares about the result. Three
  listeners hang off that one event: one logs to the terminal, one broadcasts
  an activity line to every open SSE connection, one posts the score to the
  leaderboard service. Decoupled — last week I added logging by writing a
  listener, not by editing the route."
- **Show:** play a question, terminal `[event]` lines appear; dev tools
  Network tab shows the `text/event-stream` and the frames
  `hello`, `activity`, `leaderboard-changed`. The browser then re-fetches the
  leaderboard.
- **Client side:** "in `app.js` the events are DOM ones — `submit` on the
  form, `click` on the buttons, `DOMContentLoaded` for the startup session
  check, and `onmessage` on the EventSource. Handler runs, UI updates, that
  is the event loop in the browser."
- **Justify:** "I chose SSE over WebSockets because traffic only goes one way
  and the browser reconnects itself; polling would have been wasteful.
  EventEmitter over a custom dispatcher because it is built in and everyone
  reads it instantly. Downside: the bus is in-memory, so if I ever run two
  game server processes the broadcasts would not reach each other — for that
  I would move to a real message broker."

## 5:30–7:15 — Virtual identity

- **Locate:** `auth.js` (hashing), `sessions.js` (cookie store), `/api/login`
  (Set-Cookie), `requireUser` (gating).
- **Show:** register, `users.json` shows `salt:hash` — "no plaintext, each
  hash has its own random salt, so identical passwords do not produce
  identical lines."
- **Explain:** "login verifies with `scryptSync` and `timingSafeEqual` so the
  comparison itself does not leak timing. Success creates a session: 32 random
  bytes as the cookie value, the username lives server side. Cookie flags:
  `HttpOnly` so JavaScript cannot read it (XSS protection), `SameSite=Lax`
  so cross-site POSTs do not carry it (CSRF), `Max-Age` one hour."
- **Access control:** "`requireUser` sits in front of question, answer, score
  and the event stream; without a session you get 401 — shown in the curl
  evidence file. Logout deletes the session server side and clears the
  cookie; the old cookie value is then dead, which the integration test
  asserts."
- **Evaluate:** "Why not store the username in the cookie itself? Anyone can
  edit a cookie. Why not JWT? Revocation and expiry are easier to reason
  about with server sessions for a small app; a JWT would need a blocklist
  anyway on logout. Risks I know about: no rate limiting on login attempts,
  sessions in memory restart with a logout, scrypt is fine today but I would
  move to argon2 with a library in production, and passwords are only as
  good as the user picks — I enforce eight characters but no breach check."

## 7:15–9:15 — Critical evaluation of the whole thing

Pick three or four, do not read all of them:

- **Interop risk:** "I depend on a third party that says it can vanish
  without notice. I hide it behind my own route, validate the shape, cache
  nothing — a per-question cache would smooth over a slow minute but risks
  repeating questions."
- **Data:** "JSON files were the right call for a demo — zero install.
  Concurrent writes from two processes are a real hazard; SQLite or a proper
  database is the next step, and my data already matches JSON documents."
- **Architecture trade-off:** "Two processes cost a startup line and an extra
  failure mode, but they bought an honest distributed story — and I can demo
  the failure: kill the leaderboard, the game still scores."
- **Testing:** "12 tests, the integration one runs the real servers against
  a mock API so it works offline. What I would add: a test for session
  expiry, and load testing is missing entirely."
- **[Your own moment]:** the bug you hit, how you found it, what you changed.
  Use one from the table in `docs/TESTING.md` — it has to be your voice.

## 9:15–10:00 — Conclusion

- What works: login, questions from a real external API, live leaderboard
  across tabs, tests green.
- What I learned about the four themes in practice, one line each, your words.
- What I would improve: argon2 + rate limiting, message broker for the bus,
  SQLite, CI running `npm test`.
- Stop. Do not add a polished outro.
