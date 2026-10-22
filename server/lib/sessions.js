// Server side sessions. The cookie only carries a random id, the username and
// expiry live in the server's memory so the browser cannot edit them.
// Cookie rules follow the MDN session article:
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies
const crypto = require('node:crypto');

const SESSION_TTL_MS = 60 * 60 * 1000;

function createSessionStore({ ttlMs = SESSION_TTL_MS } = {}) {
  const sessions = new Map();

  return {
    create(username) {
      const id = crypto.randomBytes(32).toString('hex');
      sessions.set(id, { username, expiresAt: Date.now() + ttlMs });
      return id;
    },

    get(id) {
      const session = sessions.get(id);
      if (!session) {
        return null;
      }
      if (session.expiresAt < Date.now()) {
        sessions.delete(id);
        return null;
      }
      return session;
    },

    destroy(id) {
      sessions.delete(id);
    }
  };
}

function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name) {
      cookies[name] = rest.join('=');
    }
  }
  return cookies;
}

module.exports = { createSessionStore, parseCookies, SESSION_TTL_MS };
