// browser side behaviour for the quiz page

const statusLine = document.getElementById('status');
const questionImage = document.getElementById('question-image');
const answerForm = document.getElementById('answer-form');
const answerInput = document.getElementById('answer-input');
const feedbackLine = document.getElementById('feedback');
const scoreLine = document.getElementById('score-line');
const newQuestionButton = document.getElementById('new-question');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authStatus = document.getElementById('auth-status');
const authBox = document.getElementById('auth-box');
const questionBox = document.getElementById('question-box');
const userBar = document.getElementById('user-bar');
const whoLabel = document.getElementById('who');
const logoutButton = document.getElementById('logout');

async function requestJson(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    // session expired or never existed, send the player back to the login
    showLoggedOut();
  }
  if (!res.ok) {
    throw new Error(data.error || `request failed with status ${res.status}`);
  }
  return data;
}

function showLoggedIn(user) {
  whoLabel.textContent = user;
  userBar.hidden = false;
  authBox.hidden = true;
  questionBox.hidden = false;
  loadQuestion();
}

function showLoggedOut() {
  userBar.hidden = true;
  authBox.hidden = false;
  questionBox.hidden = true;
}

async function checkSession() {
  try {
    const data = await requestJson('/api/session');
    showLoggedIn(data.user);
  } catch (err) {
    showLoggedOut();
  }
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

async function handleAuth(form, path, successMessage) {
  const username = form.elements.username.value.trim().toLowerCase();
  const password = form.elements.password.value;
  try {
    const data = await requestJson(path, {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    form.reset();
    authStatus.hidden = true;
    if (path === '/api/login') {
      showLoggedIn(data.user);
      return;
    }
    authStatus.textContent = successMessage;
    authStatus.className = 'feedback good';
    authStatus.hidden = false;
  } catch (err) {
    authStatus.textContent = err.message;
    authStatus.className = 'feedback bad';
    authStatus.hidden = false;
  }
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  handleAuth(loginForm, '/api/login');
});

registerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  handleAuth(registerForm, '/api/register', 'Account created, log in with it now.');
});

logoutButton.addEventListener('click', async () => {
  try {
    await requestJson('/api/logout', { method: 'POST' });
  } catch (err) {
    console.error(err);
  }
  showLoggedOut();
});

answerForm.addEventListener('submit', submitAnswer);
newQuestionButton.addEventListener('click', loadQuestion);

document.addEventListener('DOMContentLoaded', checkSession);
