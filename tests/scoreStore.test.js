const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createScoreStore } = require('../leaderboard/lib/scoreStore');

test('keeps the best score when a player does worse later', () => {
  const store = createScoreStore({ events: new EventEmitter() });
  store.submit('marta', 3);
  store.submit('marta', 1);
  assert.equal(store.top()[0].score, 3);
});

test('table comes back sorted with the best score first', () => {
  const store = createScoreStore({ events: new EventEmitter() });
  store.submit('marta', 2);
  store.submit('omar', 7);
  store.submit('li', 5);
  assert.deepEqual(
    store.top().map((entry) => entry.username),
    ['omar', 'li', 'marta']
  );
});

test('scores are limited to the top 10', () => {
  const store = createScoreStore({ events: new EventEmitter() });
  for (let i = 0; i < 15; i += 1) {
    store.submit(`player${i}`, i);
  }
  assert.equal(store.top(10).length, 10);
  assert.equal(store.top(10)[0].score, 14);
});

test('scores survive a restart because they are written to the file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-scores-'));
  const file = path.join(dir, 'leaderboard.json');

  const first = createScoreStore({ file, events: new EventEmitter() });
  first.submit('marta', 5);

  const second = createScoreStore({ file, events: new EventEmitter() });
  assert.deepEqual(second.top(), [{ username: 'marta', score: 5 }]);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('score:updated event fires with the new table', () => {
  const events = new EventEmitter();
  const seen = [];
  events.on('score:updated', (table) => seen.push(table));
  const store = createScoreStore({ events });

  store.submit('omar', 4);
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], [{ username: 'omar', score: 4 }]);

  store.submit('omar', 2);
  assert.equal(seen.length, 1, 'no event when the score did not improve');
});
