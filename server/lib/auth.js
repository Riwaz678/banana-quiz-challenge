// User accounts with salted password hashes, never plaintext.
// scrypt and timingSafeEqual follow the Node crypto docs:
// https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-options-callback
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const USERS_FILE = process.env.USERS_FILE || path.join(__dirname, '..', 'data', 'users.json');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== candidate.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, candidate);
}

function createUserStore({ file = USERS_FILE } = {}) {
  function load() {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') {
        return {};
      }
      throw err;
    }
  }

  function save(users) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(users, null, 2));
  }

  return {
    register(username, password) {
      if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        return { ok: false, error: 'username must be 3-20 characters: a-z, 0-9 or _' };
      }
      if (typeof password !== 'string' || password.length < 8) {
        return { ok: false, error: 'password must be at least 8 characters' };
      }
      const users = load();
      if (users[username]) {
        return { ok: false, error: 'that username is taken' };
      }
      users[username] = hashPassword(password);
      save(users);
      return { ok: true };
    },

    verify(username, password) {
      const users = load();
      const stored = users[username];
      if (!stored || typeof password !== 'string') {
        return false;
      }
      return verifyPassword(password, stored);
    }
  };
}

module.exports = { createUserStore, hashPassword, verifyPassword };
