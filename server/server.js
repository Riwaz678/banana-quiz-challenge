// HTTP server for the quiz: serves the static files in client/ and a small
// json api. Uses the Node http module docs: https://nodejs.org/api/http.html
// Exported as a factory so the tests can spin one up on a random port.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { fetchRawQuestion } = require('./lib/bananaClient');
const { createGameStore } = require('./lib/gameStore');
const { createUserStore } = require('./lib/auth');
const { createSessionStore, parseCookies, SESSION_TTL_MS } = require('./lib/sessions');
const leaderboardClient = require('./lib/leaderboardClient');
const bus = require('./lib/gameEvents');

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = path.join(__dirname, '..', 'client');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 100000) {
        reject(new Error('body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch (err) {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

function createGameServer(options = {}) {
  const bananaUrl = options.bananaUrl;
  const leaderboardUrl = options.leaderboardUrl;
  const userStore = createUserStore(options.usersFile ? { file: options.usersFile } : {});
  const sessionStore = createSessionStore(
    options.sessionTtlMs ? { ttlMs: options.sessionTtlMs } : {}
  );
  const gameStore = createGameStore();

  // every open event stream gets every broadcast
  const sseClients = new Set();

  function broadcastSse(event) {
    const frame = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of sseClients) {
      client.write(frame);
    }
  }

  // walks the session cookie, returns null for anonymous visitors
  function currentUsername(req) {
    const cookies = parseCookies(req.headers.cookie);
    const session = sessionStore.get(cookies.sid);
    return session ? session.username : null;
  }

  // for routes only logged in players may use, answers 401 and returns null
  function requireUser(req, res) {
    const username = currentUsername(req);
    if (!username) {
      json(res, 401, { error: 'log in first' });
      return null;
    }
    return username;
  }

  // --- event handlers, one job each, all hanging off the shared bus ---
  bus.on('user:registered', (e) => {
    console.log(`[event] new account: ${e.username}`);
  });
  bus.on('user:logged-in', (e) => {
    console.log(`[event] ${e.username} logged in`);
    broadcastSse({ type: 'activity', text: `${e.username} came online` });
  });
  bus.on('user:logged-out', (e) => {
    console.log(`[event] ${e.username} logged out`);
  });
  bus.on('question:served', (e) => {
    console.log(`[event] question served to ${e.username}`);
  });
  bus.on('answer:correct', (e) => {
    console.log(`[event] correct answer, score is now ${e.score}`);
    broadcastSse({ type: 'activity', text: `${e.username} got one right and is on ${e.score}` });
    // score goes to the other process, a failure there must not fail the answer
    leaderboardClient
      .postScore({ username: e.username, score: e.score }, leaderboardUrl)
      .then(() => broadcastSse({ type: 'leaderboard-changed' }))
      .catch((err) => console.error(`[error] could not save score: ${err.message}`));
  });
  bus.on('answer:wrong', (e) => {
    console.log(`[event] wrong answer: ${e.answer}`);
    broadcastSse({ type: 'activity', text: `${e.username} guessed ${e.answer}, not the digit` });
  });

  const server = http.createServer(async (req, res) => {
    const urlPath = new URL(req.url, `http://${req.headers.host}`).pathname;

    try {
      // proxy to the banana api so the browser never talks to it directly
      if (urlPath === '/api/banana' && req.method === 'GET') {
        const data = await fetchRawQuestion(bananaUrl);
        json(res, 200, data);
        return;
      }

      if (urlPath === '/api/register' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const username = String(body.username || '').trim().toLowerCase();
        const result = userStore.register(username, body.password);
        if (!result.ok) {
          json(res, 400, { error: result.error });
          return;
        }
        bus.emit('user:registered', { username });
        json(res, 201, { created: true });
        return;
      }

      if (urlPath === '/api/login' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const username = String(body.username || '').trim().toLowerCase();
        if (!userStore.verify(username, body.password)) {
          // same message for unknown user and wrong password on purpose
          json(res, 401, { error: 'wrong username or password' });
          return;
        }
        const sid = sessionStore.create(username);
        res.setHeader(
          'Set-Cookie',
          `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`
        );
        bus.emit('user:logged-in', { username });
        json(res, 200, { user: username });
        return;
      }

      if (urlPath === '/api/session' && req.method === 'GET') {
        const username = currentUsername(req);
        if (!username) {
          json(res, 401, { error: 'no active session' });
          return;
        }
        json(res, 200, { user: username });
        return;
      }

      if (urlPath === '/api/logout' && req.method === 'POST') {
        const cookies = parseCookies(req.headers.cookie);
        const session = sessionStore.get(cookies.sid);
        if (session) {
          sessionStore.destroy(cookies.sid);
          bus.emit('user:logged-out', { username: session.username });
        }
        res.setHeader('Set-Cookie', 'sid=; Path=/; HttpOnly; Max-Age=0');
        json(res, 200, { loggedOut: true });
        return;
      }

      if (urlPath === '/api/question' && req.method === 'GET') {
        const username = requireUser(req, res);
        if (!username) return;
        const data = await fetchRawQuestion(bananaUrl);
        // the solution stays on the server, the client only gets the image
        gameStore.setQuestion(username, {
          image: data.question,
          solution: String(data.solution)
        });
        bus.emit('question:served', { username, image: data.question });
        json(res, 200, { image: data.question });
        return;
      }

      if (urlPath === '/api/answer' && req.method === 'POST') {
        const username = requireUser(req, res);
        if (!username) return;
        const body = await readJsonBody(req);
        const result = gameStore.checkAnswer(username, body.answer);
        if (!result.ok) {
          json(res, 400, { error: result.reason });
          return;
        }
        bus.emit(result.correct ? 'answer:correct' : 'answer:wrong', {
          username,
          answer: body.answer,
          score: result.score
        });
        json(res, 200, result);
        return;
      }

      if (urlPath === '/api/score' && req.method === 'GET') {
        const username = requireUser(req, res);
        if (!username) return;
        json(res, 200, { score: gameStore.stateFor(username).score });
        return;
      }

      if (urlPath === '/api/leaderboard' && req.method === 'GET') {
        try {
          const scores = await leaderboardClient.getScores(leaderboardUrl);
          json(res, 200, { scores });
        } catch (err) {
          json(res, 502, { error: err.message });
        }
        return;
      }

      // server sent events: the client holds this open and the bus pushes
      // frames down it whenever something happens in the game
      if (urlPath === '/api/events' && req.method === 'GET') {
        const username = requireUser(req, res);
        if (!username) return;
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        });
        res.write(`data: ${JSON.stringify({ type: 'hello', user: username })}\n\n`);
        sseClients.add(res);
        const keepAlive = setInterval(() => {
          res.write(': ping\n\n');
        }, 25000);
        req.on('close', () => {
          clearInterval(keepAlive);
          sseClients.delete(res);
        });
        return;
      }

      // static files
      const relative = urlPath === '/' ? 'index.html' : urlPath.slice(1);
      const filePath = path.join(CLIENT_DIR, relative);
      if (!filePath.startsWith(CLIENT_DIR)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
        res.end(content);
      });
    } catch (err) {
      if (err.name === 'BananaApiError') {
        json(res, err.kind === 'timeout' ? 504 : 502, { error: err.message });
        return;
      }
      if (err.message === 'invalid json' || err.message === 'body too large') {
        json(res, 400, { error: err.message });
        return;
      }
      console.error(err);
      json(res, 500, { error: 'something went wrong on the server' });
    }
  });

  return { server, bus, gameStore, sessionStore };
}

module.exports = { createGameServer };

if (require.main === module) {
  const { server } = createGameServer();
  server.listen(PORT, () => {
    console.log(`banana quiz running on http://localhost:${PORT}`);
  });
}
