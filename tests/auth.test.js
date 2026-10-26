const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createUserStore, hashPassword, verifyPassword } = require('../server/lib/auth');

function withTempUsersFile(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-users-'));
  try {
    fn(path.join(dir, 'users.json'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('register and then verify the password', () => {
  withTempUsersFile((file) => {
    const store = createUserStore({ file });
    assert.deepEqual(store.register('omar', 'banana123'), { ok: true });
    assert.equal(store.verify('omar', 'banana123'), true);
    assert.equal(store.verify('omar', 'bananas123'), false);
    assert.equal(store.verify('nobody', 'banana123'), false);
  });
});

test('the same password gives a different hash every time', () => {
  const first = hashPassword('samepassword1');
  const second = hashPassword('samepassword1');
  assert.notEqual(first, second, 'random salt should change the hash');
  assert.equal(verifyPassword('samepassword1', first), true);
  assert.equal(verifyPassword('wrongpassword', first), false);
});

test('the file never contains the plain password', () => {
  withTempUsersFile((file) => {
    const store = createUserStore({ file });
    store.register('rita', 'supersecret123');
    const saved = fs.readFileSync(file, 'utf8');
    assert.equal(saved.includes('supersecret123'), false);
    // salt (32 hex) : scrypt hash (128 hex)
    assert.match(saved, /[0-9a-f]{32}:[0-9a-f]{128}/);
  });
});

test('short passwords and silly usernames are rejected', () => {
  withTempUsersFile((file) => {
    const store = createUserStore({ file });
    assert.match(store.register('omar', 'short').error, /8 characters/);
    assert.match(store.register('AB', 'longenough1').error, /3-20/);
    assert.match(store.register('has space', 'longenough1').error, /3-20/);
  });
});

test('a username can only be taken once', () => {
  withTempUsersFile((file) => {
    const store = createUserStore({ file });
    store.register('omar', 'banana123');
    const result = store.register('omar', 'anotherpass1');
    assert.equal(result.ok, false);
    assert.match(result.error, /taken/);
  });
});
