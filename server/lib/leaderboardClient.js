// The game server talks to its own leaderboard service over http + json,
// the same protocol it uses for the banana api, just on localhost.
async function request(url, options) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(3000), ...options });
  } catch (err) {
    throw new Error('leaderboard service is not reachable');
  }
  if (!response.ok) {
    throw new Error(`leaderboard service answered with status ${response.status}`);
  }
  return response;
}

async function getScores(baseUrl = process.env.LEADERBOARD_URL || 'http://localhost:4000') {
  const response = await request(`${baseUrl}/scores`);
  const data = await response.json();
  return Array.isArray(data.scores) ? data.scores : [];
}

async function postScore(entry, baseUrl = process.env.LEADERBOARD_URL || 'http://localhost:4000') {
  await request(`${baseUrl}/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry)
  });
}

module.exports = { getScores, postScore };
