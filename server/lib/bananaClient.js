// Client for the Banana API by Marc Conrad, University of Bedfordshire.
// API documentation: https://marcconrad.com/uob/banana/doc.php
const DEFAULT_BASE_URL = 'https://marcconrad.com/uob/banana/api.php';

async function fetchRawQuestion(baseUrl = DEFAULT_BASE_URL) {
  // out=json gives { question: <image url>, solution: <digit> }
  const response = await fetch(`${baseUrl}?out=json&base64=no`);
  if (!response.ok) {
    throw new Error(`banana api responded with status ${response.status}`);
  }
  return response.json();
}

module.exports = { fetchRawQuestion, DEFAULT_BASE_URL };
