# References and acknowledgements

Everything in `server/`, `leaderboard/`, `client/` and `tests/` was written by
me for this assignment, except the items listed below. The assignment brief
requires any external code to be marked, so this file is part of the
submission.

## External services used

1. **Banana API by Marc Conrad, University of Bedfordshire**
   - documentation: https://marcconrad.com/uob/banana/doc.php
   - called from `server/lib/bananaClient.js`
   - a real request and its actual response are saved in
     `docs/evidence/banana-api-response.txt`
   - required integration for this unit, used as instructed

2. **Example code provided by the unit**
   - https://marcconrad.com/uob/banana/ (JavaScript example page)
   - https://github.com/marcconrad/comparativeintegratedsystems (Java examples)
   - I read the example page to work out the game rule (the answer is the one
     digit hidden behind the banana). I did not copy code from it; my
     structure (Node server + vanilla JS client) is my own.

## Documentation I used while writing the code

3. Node.js docs, http module — https://nodejs.org/api/http.html
   used for the structure of both servers (`server.js`, `leaderboard/service.js`)

4. Node.js docs, crypto scrypt —
   https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-options-callback
   used for password hashing in `server/lib/auth.js`

5. MDN, HTTP cookies — https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies
   used for the cookie flags in `server/lib/sessions.js` and the login route

6. MDN, Server-Sent Events —
   https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
   used for `/api/events` and the `EventSource` in `client/js/app.js`

7. Node.js test runner — https://nodejs.org/api/test.html
   used for `tests/`

## Generative AI

- **Declaration (required):** I used a large language model (ChatGPT/OpenAI)
  while developing parts of this code, which the assignment brief allows for
  code. No part of the video was produced with AI.
- *TODO before submission — replace this bullet with an honest list: which
  files or functions the model drafted, what you changed, and what you
  checked. Keep it short, e.g.: "The model drafted the first version of
  `bananaClient.js` and the timeout handling; I rewrote the validation after
  testing against the real API, and the session code I wrote myself."*

## Help from others

- *TODO before submission — list any hints from classmates, forum answers or
  tutor suggestions, or write "none beyond the tutor's practical session
  guidance."*
