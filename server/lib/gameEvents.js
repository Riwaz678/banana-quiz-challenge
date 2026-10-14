// One event bus for the game server. Everything that happens during a game
// (question served, right or wrong answer) goes through here so the logging,
// the leaderboard and the live updates can just listen for what they care about.
const { EventEmitter } = require('node:events');

const bus = new EventEmitter();
bus.setMaxListeners(50);

module.exports = bus;
