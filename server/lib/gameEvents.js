// Creates the event bus for a server instance. Everything that happens during
// a game (question served, right or wrong answer, login) is emitted on it, so
// the logging, the leaderboard pusher and the live updates each just listen
// for the events they care about.
const { EventEmitter } = require('node:events');

function createGameBus() {
  const bus = new EventEmitter();
  bus.setMaxListeners(50);
  return bus;
}

module.exports = { createGameBus };
