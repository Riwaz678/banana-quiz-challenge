// Keeps the current question and score for each player.
// State is keyed by the logged in username.
function createGameStore() {
  const players = new Map();

  function stateFor(id) {
    if (!players.has(id)) {
      players.set(id, { score: 0, question: null, attempts: 0 });
    }
    return players.get(id);
  }

  return {
    stateFor,

    setQuestion(id, question) {
      const state = stateFor(id);
      state.question = question;
      state.attempts = 0;
    },

    checkAnswer(id, answer) {
      const state = stateFor(id);
      if (!state.question) {
        return { ok: false, reason: 'no question open, fetch one first' };
      }
      if (!/^\d$/.test(String(answer))) {
        return { ok: false, reason: 'answer must be a single digit' };
      }
      state.attempts += 1;
      const correct = String(answer) === state.question.solution;
      if (correct) {
        state.score += 1;
        state.question = null;
      }
      return { ok: true, correct, score: state.score, attempts: state.attempts };
    }
  };
}

module.exports = { createGameStore };
