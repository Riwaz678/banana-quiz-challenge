# Testing evidence

## Automated tests

```
npm test
```

Result on 31 Oct 2026, Node 24, Windows:

```
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3600.5702
```

| file | what it covers |
|---|---|
| `tests/scoreStore.test.js` | best score kept, sorting, top-10 limit, scores survive a restart, `score:updated` fires only on improvement |
| `tests/auth.test.js` | register + verify, wrong password, salt makes hashes differ, plain password never hits the file, username/password rules, duplicate username |
| `tests/integration.test.js` | the whole system on random ports with a mock Banana API: 401 without login, register/login/logout, cookie flags, solution hidden from client, right/wrong answers, score arriving at the other process, SSE frame arriving, API down → 502, leaderboard down → answer still works |

The integration test needs no internet: it starts its own mock Banana API, so
it also works in an exam room with no network.

## Manual checks in the browser

| what I did | what happened |
|---|---|
| register with a 5 character password | red message, nothing written to `users.json` |
| login with wrong password | `401 wrong username or password`, same message as for an unknown name (no user enumeration) |
| refresh the page while logged in | game area comes straight back, `/api/session` returns the username |
| log out, then click New question | nothing to click (area hidden), `curl` to `/api/question` gives `401` |
| answer with a wrong digit | red feedback, attempts counter goes up, activity feed line appears |
| answer correctly | `+1`, score line updates, leaderboard row appears |
| open a second browser tab and score in the first | second tab's activity feed and leaderboard update without a refresh (SSE) |
| stop the leaderboard process, then answer | answer still scores, board shows "leaderboard service is not answering", terminal logs `[error] could not save score` |
| run with `BANANA_URL=http://localhost:4999` (nothing there) | friendly message in the page, `502 could not reach the banana api` |
| `curl` the http (non-https) API URL | `301` redirect, Node's fetch follows it automatically — see `docs/evidence/banana-api-response.txt` |

## Bugs I hit and what I did about them

| what broke | when I noticed | fix |
|---|---|---|
| `BANANA_URL` stopped being read after I wrapped the server in a factory, so tests silently hit the real API | testing right after the refactor | fall back to `process.env` in `createGameServer` (commit `bdc531f`) |
| every event logged twice once a second server existed in one test process: listeners stacked on one shared bus | reading the test output | each server now creates its own bus (commit `44743a1`) |
| my first integration test answered a question that was never opened, so no event fired and no SSE frame arrived | `npm test` red | fetch a new question before answering in the test |
| test usernames `li` were rejected by my own 3 character minimum, so login tests failed for the wrong reason | `npm test` red | longer test usernames |
| `curl -d '{...}'` through PowerShell mangled the JSON body | manual API checks | write the body to a file and use `--data-binary @file` (test tooling, not app code) |
