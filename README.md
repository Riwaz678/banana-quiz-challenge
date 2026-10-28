# Banana Quiz Challenge

CIS046-3 Software for Enterprise — assignment 1. Quiz game: the question
image comes from the UoB Banana API (https://marcconrad.com/uob/banana/doc.php),
players log in and compete on a live leaderboard.

## Requirements

Node.js 18 or newer (built with Node 24). No npm packages, nothing to
`npm install`.

## Run it

Two terminals, two processes:

```
npm run start:leaderboard     # leaderboard service, port 4000
npm run start                 # game server, port 3000
```

Open http://localhost:3000, register (username 3-20 chars, password 8+
characters), log in, play. Ports can be changed with `PORT` and
`LEADERBOARD_PORT` env vars; `BANANA_URL` points at a different API endpoint
if you want to test with a fake one.

## Tests

```
npm test
```

12 tests: auth, scoring and a full run of all three processes against a mock
Banana API (works offline).

## Docs

- `docs/DESIGN.md` — architecture, data flow, where each of the four themes
  lives, choices I made
- `docs/TRANSCRIPT.md` — draft script for the video
- `docs/TESTING.md` — test results, manual checks, bugs I fixed
- `docs/EVIDENCE.md` — how to reproduce every piece of evidence
- `docs/REFERENCES.md` — external code and AI acknowledgement
