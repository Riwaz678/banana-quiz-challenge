// Leaderboard microservice, wip: scores only live in memory for now.
// Runs as its own process, separate from the game server.
const http = require('node:http');

const PORT = process.env.LEADERBOARD_PORT || 4000;
const scores = new Map();

const server = http.createServer(async (req, res) => {
  const urlPath = new URL(req.url, `http://${req.headers.host}`).pathname;

  if (urlPath === '/scores' && req.method === 'GET') {
    const table = [...scores]
      .map(([username, score]) => ({ username, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ scores: table }));
    return;
  }

  if (urlPath === '/scores' && req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
    }
    let body;
    try {
      body = JSON.parse(raw);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid json' }));
      return;
    }
    if (typeof body.username !== 'string' || typeof body.score !== 'number') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'expected { username, score }' }));
      return;
    }
    scores.set(body.username, body.score);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ saved: true }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log(`leaderboard service on http://localhost:${PORT}`);
});
