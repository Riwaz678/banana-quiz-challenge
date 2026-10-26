// Puts the whole distributed system in one test: mock banana api,
// leaderboard service and game server, all on random local ports.
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createGameServer } = require('../server/server');
const { createLeaderboardService } = require('../leaderboard/service');

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function close(server) {
  if (typeof server.closeAllConnections === 'function') {
    server.closeAllConnections();
  }
  await new Promise((resolve) => server.close(resolve));
}

function startMockBanana({ solution = 7, status = 200 } = {}) {
  const server = http.createServer((req, res) => {
    if (status !== 200) {
      res.writeHead(status);
      res.end('nope');
      return;
    }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ question: 'https://example.com/mock.png', solution }));
  });
  return listen(server).then((port) => ({ server, url: `http://127.0.0.1:${port}` }));
}

test('the whole quiz works over http', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-e2e-'));
  const banana = await startMockBanana({ solution: 7 });
  const leaderboard = createLeaderboardService({ file: path.join(dir, 'leaderboard.json') });
  const lbPort = await listen(leaderboard.server);
  const game = createGameServer({
    bananaUrl: banana.url,
    leaderboardUrl: `http://127.0.0.1:${lbPort}`,
    usersFile: path.join(dir, 'users.json')
  });
  const gamePort = await listen(game.server);
  const base = `http://127.0.0.1:${gamePort}`;
  const jsonHeaders = { 'Content-Type': 'application/json' };

  t.after(async () => {
    await close(game.server);
    await close(leaderboard.server);
    await close(banana.server);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // 1. no session, no game
  let res = await fetch(`${base}/api/question`);
  assert.equal(res.status, 401);

  // 2. account creation and login
  res = await fetch(`${base}/api/register`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ username: 'omar', password: 'banana123' })
  });
  assert.equal(res.status, 201);

  res = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ username: 'omar', password: 'wrongpass1' })
  });
  assert.equal(res.status, 401, 'wrong password is rejected');

  res = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ username: 'omar', password: 'banana123' })
  });
  assert.equal(res.status, 200);
  const setCookie = res.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  const cookie = setCookie.split(';')[0];

  // 3. the question hides the solution from the client
  res = await fetch(`${base}/api/question`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const question = await res.json();
  assert.deepEqual(Object.keys(question), ['image'], 'only the image url is sent');

  // 4. answering
  res = await fetch(`${base}/api/answer`, {
    method: 'POST',
    headers: { ...jsonHeaders, cookie },
    body: JSON.stringify({ answer: '0' })
  });
  let result = await res.json();
  assert.equal(result.correct, false);
  assert.equal(result.score, 0);

  res = await fetch(`${base}/api/answer`, {
    method: 'POST',
    headers: { ...jsonHeaders, cookie },
    body: JSON.stringify({ answer: '7' })
  });
  result = await res.json();
  assert.equal(result.correct, true);
  assert.equal(result.score, 1);

  // 5. the score travelled to the other process
  await new Promise((resolve) => setTimeout(resolve, 300));
  res = await fetch(`http://127.0.0.1:${lbPort}/scores`);
  const table = await res.json();
  assert.deepEqual(table.scores, [{ username: 'omar', score: 1 }]);

  // 6. wrong answer is not a server error
  res = await fetch(`${base}/api/answer`, {
    method: 'POST',
    headers: { ...jsonHeaders, cookie },
    body: JSON.stringify({ answer: 'not a digit' })
  });
  assert.equal(res.status, 400);

  // 7. event stream: connect, play, see the frame arrive
  const controller = new AbortController();
  res = await fetch(`${base}/api/events`, { headers: { cookie }, signal: controller.signal });
  assert.equal(res.headers.get('content-type'), 'text/event-stream');

  const frames = (async () => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (!buffer.includes('"type":"activity"')) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
    return buffer;
  })();

  // the previous correct answer closed the question, so ask for a new one
  await fetch(`${base}/api/question`, { headers: { cookie } });
  await fetch(`${base}/api/answer`, {
    method: 'POST',
    headers: { ...jsonHeaders, cookie },
    body: JSON.stringify({ answer: '3' })
  });

  const received = await Promise.race([
    frames,
    new Promise((resolve, reject) =>
      setTimeout(() => reject(new Error('no activity frame within 3s')), 3000)
    )
  ]);
  assert.match(received, /hello/);
  assert.match(received, /omar guessed 3/);
  controller.abort();

  // 8. banana api down -> friendly 502, not a crash
  await close(banana.server);
  res = await fetch(`${base}/api/question`, { headers: { cookie } });
  assert.equal(res.status, 502);

  // 9. logout kills the session for good
  await fetch(`${base}/api/logout`, { method: 'POST', headers: { cookie } });
  res = await fetch(`${base}/api/question`, { headers: { cookie } });
  assert.equal(res.status, 401, 'destroyed session is refused');
});

test('a stopped leaderboard service does not break the answer', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-nolb-'));
  const banana = await startMockBanana({ solution: 4 });
  const game = createGameServer({
    bananaUrl: banana.url,
    leaderboardUrl: 'http://127.0.0.1:1',
    usersFile: path.join(dir, 'users.json')
  });
  const gamePort = await listen(game.server);
  const base = `http://127.0.0.1:${gamePort}`;

  t.after(async () => {
    await close(game.server);
    await close(banana.server);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await fetch(`${base}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'lina', password: 'banana123' })
  });
  const login = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'lina', password: 'banana123' })
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];

  await fetch(`${base}/api/question`, { headers: { cookie } });
  const res = await fetch(`${base}/api/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ answer: '4' })
  });
  const result = await res.json();
  assert.equal(res.status, 200, 'the answer still works');
  assert.equal(result.correct, true);

  const board = await fetch(`${base}/api/leaderboard`, { headers: { cookie } });
  assert.equal(board.status, 502, 'but the board reports the other service is down');
});
