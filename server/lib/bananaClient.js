// Client for the Banana API by Marc Conrad, University of Bedfordshire.
// API documentation: https://marcconrad.com/uob/banana/doc.php
const DEFAULT_BASE_URL = 'https://marcconrad.com/uob/banana/api.php';
const REQUEST_TIMEOUT_MS = 5000;

class BananaApiError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = 'BananaApiError';
    this.kind = kind;
  }
}

async function fetchRawQuestion(baseUrl = DEFAULT_BASE_URL, timeoutMs = REQUEST_TIMEOUT_MS) {
  let response;
  try {
    response = await fetch(`${baseUrl}?out=json&base64=no`, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new BananaApiError('banana api did not answer within 5 seconds', 'timeout');
    }
    throw new BananaApiError('could not reach the banana api', 'unreachable');
  }

  if (!response.ok) {
    throw new BananaApiError(`banana api responded with status ${response.status}`, 'bad-status');
  }

  let data;
  try {
    // the api sends content-type text/html even for json, so parse the body
    // ourselves instead of trusting the header
    data = await response.json();
  } catch (err) {
    throw new BananaApiError('banana api response was not valid json', 'bad-body');
  }

  if (typeof data.question !== 'string' || typeof data.solution !== 'number') {
    throw new BananaApiError('banana api response is missing question or solution', 'bad-body');
  }
  return data;
}

module.exports = { fetchRawQuestion, BananaApiError, DEFAULT_BASE_URL };
