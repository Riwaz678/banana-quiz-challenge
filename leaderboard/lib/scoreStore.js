// Score table for the leaderboard service. Keeps the best score per player
// and optionally writes the table to a json file so it survives a restart.
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');

function createScoreStore({ file, events = new EventEmitter() } = {}) {
  const scores = new Map();

  if (file && fs.existsSync(file)) {
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const entry of saved) {
        scores.set(entry.username, entry.score);
      }
    } catch (err) {
      console.error(`could not read saved scores (${err.message}), starting empty`);
    }
  }

  function persist() {
    if (!file) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const entries = [...scores].map(([username, score]) => ({ username, score }));
    fs.writeFileSync(file, JSON.stringify(entries, null, 2));
  }

  return {
    submit(username, score) {
      const previous = scores.has(username) ? scores.get(username) : -1;
      if (score <= previous) {
        return { improved: false, score: previous };
      }
      scores.set(username, score);
      persist();
      events.emit('score:updated', this.top(10));
      return { improved: true, score };
    },

    top(n = 10) {
      return [...scores]
        .map(([username, score]) => ({ username, score }))
        .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username))
        .slice(0, n);
    }
  };
}

module.exports = { createScoreStore };
