# Evidence checklist

## 1. Week 8 tutor presentation (grade is capped at 58 without this)

- date of session: _______________
- tutor: _______________
- what I ran in front of the tutor:
  - [ ] started both processes, registered, logged in, played a question
  - [ ] showed `/api/events` or the activity feed working
  - [ ] showed `git log --oneline --graph` and talked through two commits
  - [ ] showed a `401` without a session and the `Set-Cookie` flags
  - [ ] said which code I wrote myself and which came from elsewhere
- feedback received and what I changed afterwards:

  ________________________________________________________________

Keep this file (filled in), plus a screenshot or the tutor's email/marking
note, in the submission. The brief is explicit: no evidence, capped grade.

## 2. Git

```
git log --oneline --graph          # includes the feature/leaderboard merge
git show --stat 3b2c500            # example: the tests commit
git branch -a                      # main + feature/leaderboard
git tag                            # v1.0
```

## 3. Banana API request and real response

Saved: `docs/evidence/banana-api-response.txt` (captured 31 Oct 2026).
Reproduce with:

```
curl -i "https://marcconrad.com/uob/banana/api.php?out=json&base64=no"
```

Points worth noting on screen: the `301` from http to https when using the
http URL, `Content-Type: text/html` even though the body is JSON (that is why
`bananaClient.js` validates the parsed object instead of trusting the header),
and `Access-Control-Allow-Origin: *`.

## 4. Session and identity

Saved: `docs/evidence/login-set-cookie.txt` — the login response with the
`HttpOnly; SameSite=Lax; Max-Age=3600` flags.

```
curl -i -X POST -H "Content-Type: application/json" \
  --data "@login.json" http://localhost:3000/api/login

curl -i http://localhost:3000/api/question        # expect 401, no session
```

Open `server/data/users.json` after registering: only `salt:hash` pairs, no
passwords.

## 5. Events

- terminal shows `[event] ...` lines as you play
- browser dev tools → Network → `events` → type `event-stream`, frames:
  `{"type":"hello"...}`, `{"type":"activity"...}`, `{"type":"leaderboard-changed"}`
- `npm test` prints the integration test that asserts an activity frame
  arrives after a wrong answer
