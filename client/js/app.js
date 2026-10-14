// browser side behaviour for the quiz page

const statusLine = document.getElementById('status');
const questionImage = document.getElementById('question-image');
const answerForm = document.getElementById('answer-form');
const answerInput = document.getElementById('answer-input');
const feedbackLine = document.getElementById('feedback');
const scoreLine = document.getElementById('score-line');
const newQuestionButton = document.getElementById('new-question');

async function requestJson(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `request failed with status ${res.status}`);
  }
  return data;
}

async function loadQuestion() {
  statusLine.textContent = 'Asking the banana api...';
  feedbackLine.hidden = true;
  try {
    const data = await requestJson('/api/question');
    questionImage.src = data.image;
    questionImage.hidden = false;
    answerForm.hidden = false;
    answerInput.value = '';
    answerInput.focus();
    statusLine.textContent = 'What is the missing digit?';
  } catch (err) {
    statusLine.textContent = `Could not load a question: ${err.message}`;
  }
}

async function submitAnswer(event) {
  event.preventDefault();
  try {
    const data = await requestJson('/api/answer', {
      method: 'POST',
      body: JSON.stringify({ answer: answerInput.value })
    });
    if (data.correct) {
      feedbackLine.textContent = 'Correct! +1 point';
      feedbackLine.className = 'feedback good';
      answerForm.hidden = true;
    } else {
      feedbackLine.textContent = `Not quite, try again (attempt ${data.attempts})`;
      feedbackLine.className = 'feedback bad';
    }
    feedbackLine.hidden = false;
    scoreLine.textContent = `Score: ${data.score}`;
    scoreLine.hidden = false;
  } catch (err) {
    feedbackLine.textContent = err.message;
    feedbackLine.className = 'feedback bad';
    feedbackLine.hidden = false;
  }
}

answerForm.addEventListener('submit', submitAnswer);
newQuestionButton.addEventListener('click', loadQuestion);

document.addEventListener('DOMContentLoaded', () => {
  statusLine.textContent = 'Ready when you are.';
  loadQuestion();
});
