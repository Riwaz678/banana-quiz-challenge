// Leaderboard microservice. Runs as its own process and only speaks http + json,
// so it does not care what the game server is written in.
// Uses the Node http module docs: https://nodejs.org/api/http.html
const http = require('node:http');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createScoreStore } = require('./lib/scoreStore');

const PORT = process.env.LEADERBOARD_PORT || 4000;
const SCORES_FILE = process.env.LEADERBOARD_FILE || path.join(__dirname, 'data', 'leaderboard.json');

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

function createLeaderboardService({ file = SCORES_FILE, events = new EventEmitter() } = {}) {
  const store = createScoreStore({ file, events });

  events.on('score:updated', (top) => {
    const leader = top[0];
    if (leader) {
      console.log(`[event] leaderboard updated, leader is ${leader.username} with ${leader.score}`);
    }
  });

  const server = http.createServer(async (req, res) => {
    const urlPath = new URL(req.url, `http://${req.headers.host}`).pathname;

    try {
      if (urlPath === '/scores' && req.method === 'GET') {
        json(res, 200, { scores: store.top(10) });
        return;
      }

      if (urlPath === '/scores' && req.method === 'POST') {
        const body = await readJsonBody(req);
        if (typeof body.username !== 'string' || typeof body.score !== 'number') {
          json(res, 400, { error: 'expected { username, score }' });
          return;
        }
        store.submit(body.username, Math.floor(body.score));
        json(res, 201, { saved: true });
        return;
      }

      json(res, 404, { error: 'not found' });
    } catch (err) {
      const status = err.message === 'invalid json' || err.message === 'body too large' ? 400 : 500;
      json(res, status, { error: err.message });
    }
  });

  return { server, store, events };
}

module.exports = { createLeaderboardService };

if (require.main === module) {
  const { server } = createLeaderboardService();
  server.listen(PORT, () => {
    console.log(`leaderboard service on http://localhost:${PORT}`);
  });
}
