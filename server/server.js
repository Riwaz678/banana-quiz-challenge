// HTTP server for the quiz: serves the static files in client/ and a small
// json api. Uses the Node http module docs: https://nodejs.org/api/http.html
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { fetchRawQuestion } = require('./lib/bananaClient');
const { createGameStore } = require('./lib/gameStore');
const bus = require('./lib/gameEvents');

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = path.join(__dirname, '..', 'client');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

const gameStore = createGameStore();

bus.on('question:served', (e) => {
  console.log(`[event] question served to player ${e.playerId.slice(0, 8)}`);
});
bus.on('answer:correct', (e) => {
  console.log(`[event] correct answer, score is now ${e.score}`);
});
bus.on('answer:wrong', (e) => {
  console.log(`[event] wrong answer: ${e.answer}`);
});

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

// hands out a random id cookie on first contact, later replaced by the login
function getPlayerId(req, res) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)playerid=([a-f0-9]+)/);
  if (match) {
    return match[1];
  }
  const id = gameStore.newPlayerId();
  res.setHeader('Set-Cookie', `playerid=${id}; Path=/; HttpOnly; SameSite=Lax`);
  return id;
}

const server = http.createServer(async (req, res) => {
  const urlPath = new URL(req.url, `http://${req.headers.host}`).pathname;

  try {
    // proxy to the banana api so the browser never talks to it directly
    if (urlPath === '/api/banana' && req.method === 'GET') {
      const data = await fetchRawQuestion(process.env.BANANA_URL);
      json(res, 200, data);
      return;
    }

    if (urlPath === '/api/question' && req.method === 'GET') {
      const playerId = getPlayerId(req, res);
      const data = await fetchRawQuestion(process.env.BANANA_URL);
      // the solution stays on the server, the client only gets the image
      gameStore.setQuestion(playerId, {
        image: data.question,
        solution: String(data.solution)
      });
      bus.emit('question:served', { playerId, image: data.question });
      json(res, 200, { image: data.question });
      return;
    }

    if (urlPath === '/api/answer' && req.method === 'POST') {
      const playerId = getPlayerId(req, res);
      const body = await readJsonBody(req);
      const result = gameStore.checkAnswer(playerId, body.answer);
      if (!result.ok) {
        json(res, 400, { error: result.reason });
        return;
      }
      bus.emit(result.correct ? 'answer:correct' : 'answer:wrong', {
        playerId,
        answer: body.answer,
        score: result.score
      });
      json(res, 200, result);
      return;
    }

    if (urlPath === '/api/score' && req.method === 'GET') {
      const playerId = getPlayerId(req, res);
      json(res, 200, { score: gameStore.stateFor(playerId).score });
      return;
    }

    // static files, same as before
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

server.listen(PORT, () => {
  console.log(`banana quiz running on http://localhost:${PORT}`);
});
