// browser side behaviour for the quiz page

const statusLine = document.getElementById('status');
const rawOutput = document.getElementById('raw-output');

document.addEventListener('DOMContentLoaded', () => {
  statusLine.textContent = 'Ready. Fetch a question when you are.';
});

document.getElementById('load-raw').addEventListener('click', async () => {
  statusLine.textContent = 'Asking the banana api...';
  try {
    const res = await fetch('/api/banana');
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'request failed');
    }
    rawOutput.textContent = JSON.stringify(data, null, 2);
    statusLine.textContent = 'Got a question back from the api.';
  } catch (err) {
    statusLine.textContent = `Could not get a question: ${err.message}`;
  }
});
