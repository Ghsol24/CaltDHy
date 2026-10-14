import test from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch, clearApiSession } from '../src/services/api.js';
import { getUserErrorMessage } from '../src/utils/userErrors.js';
import { translate } from '../src/i18n/translations.js';
import { invalidateSession } from '../src/services/sessionRuntime.js';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function setup(t, fetch) {
  clearApiSession();
  const previous = globalThis.fetch;
  globalThis.fetch = fetch;
  t.after(() => { globalThis.fetch = previous; clearApiSession(); });
}

test('API preserves codes/status while replacing arbitrary failed-response text', async (t) => {
  setup(t, async () => json(400, { success: false, code: 'UNKNOWN_INTERNAL', message: 'getPixelForValue stack trace' }));
  await assert.rejects(apiFetch('/api/wallets'), (error) => {
    assert.equal(error.status, 400);
    assert.equal(error.code, 'UNKNOWN_INTERNAL');
    assert.equal(error.message, translate('vi', 'error.requestFailed'));
    return true;
  });
});

test('API retains a useful known validation message', async (t) => {
  setup(t, async () => json(409, { success: false, message: 'Số dư ví không đủ hoặc vượt hạn mức tín dụng.' }));
  await assert.rejects(apiFetch('/api/wallets'), { status: 409, message: 'Số dư ví không đủ hoặc vượt hạn mức tín dụng.' });
});

test('a login rejection uses sign-in guidance and preserves reviewed credential messages', async (t) => {
  let responseMessage = 'Private login error getPixelForValue';
  setup(t, async (endpoint) => endpoint === '/api/auth/csrf'
    ? json(200, { success: true, csrfToken: 'test-csrf' })
    : json(401, { success: false, code: 'LOGIN_REJECTED', message: responseMessage }));
  const options = { method: 'POST', body: '{"email":"synthetic@example.test","password":"incorrect"}' };
  await assert.rejects(apiFetch('/api/auth/login', options), (error) => {
    assert.equal(error.status, 401);
    assert.equal(error.code, 'LOGIN_REJECTED');
    assert.equal(error.message, translate('vi', 'auth.loginFailed'));
    assert.equal(getUserErrorMessage(error), translate('vi', 'auth.loginFailed'));
    return true;
  });
  responseMessage = 'Email hoặc mật khẩu không đúng.';
  await assert.rejects(apiFetch('/api/auth/login', options), { status: 401, message: responseMessage });
  responseMessage = 'Unknown session failure';
  await assert.rejects(apiFetch('/api/auth/session'), { status: 401, message: translate('vi', 'error.authExpired') });
});

test('invalid or HTML responses are safe, without misclassifying them as a network failure', async (t) => {
  setup(t, async () => new Response('<html>upstream private error</html>', { status: 200 }));
  await assert.rejects(apiFetch('/api/wallets'), { code: 'INVALID_RESPONSE', message: translate('vi', 'error.invalidResponse') });
});

test('a failed read invites checking connection', async (t) => {
  setup(t, async () => { throw new TypeError('Failed to fetch secret-host'); });
  await assert.rejects(apiFetch('/api/wallets'), { code: 'NETWORK_ERROR', message: translate('vi', 'error.network') });
});

test('ambiguous writes keep their idempotency key across retry and do not claim data was not saved', async (t) => {
  const writes = [];
  setup(t, async (endpoint, options) => {
    if (endpoint === '/api/auth/csrf') return json(200, { success: true, csrfToken: 'test-csrf' });
    writes.push(options.headers['Idempotency-Key']);
    if (writes.length === 1) throw new TypeError('Failed to fetch');
    return json(200, { success: true, data: {} });
  });
  const options = { method: 'POST', body: '{"amount":1000}' };
  await assert.rejects(apiFetch('/api/wallets', options), { code: 'WRITE_UNCONFIRMED', message: translate('vi', 'error.writeUnconfirmed') });
  await apiFetch('/api/wallets', options);
  assert.equal(writes.length, 2);
  assert.equal(writes[0], writes[1]);
});

test('aborts and session changes retain their control-flow identity', async (t) => {
  setup(t, async () => { throw new DOMException('Private cancellation detail', 'AbortError'); });
  await assert.rejects(apiFetch('/api/wallets'), (error) => {
    assert.equal(error.name, 'AbortError');
    assert.equal(getUserErrorMessage(error), '');
    return true;
  });
  globalThis.fetch = async () => { invalidateSession(); return json(200, { success: true }); };
  await assert.rejects(apiFetch('/api/wallets'), { code: 'SESSION_CHANGED' });
});

test('cancellation while reading a response body remains silent and keeps a write safe to retry', async (t) => {
  const keys = [];
  setup(t, async (endpoint, options) => {
    if (endpoint === '/api/auth/csrf') return json(200, { success: true, csrfToken: 'test-csrf' });
    keys.push(options.headers['Idempotency-Key']);
    if (keys.length === 1) return {
      ok: true, status: 200,
      async json() { throw new DOMException('Body reading cancelled', 'AbortError'); },
    };
    return json(200, { success: true });
  });
  const options = { method: 'POST', body: '{"amount":3000}' };
  await assert.rejects(apiFetch('/api/wallets', options), (error) => {
    assert.equal(error.name, 'AbortError');
    assert.equal(getUserErrorMessage(error), '');
    return true;
  });
  await apiFetch('/api/wallets', options);
  assert.equal(keys[0], keys[1]);
});

test('a cancellation after a failed response arrives does not show its error', async (t) => {
  const controller = new AbortController();
  setup(t, async () => ({
    ok: false, status: 503,
    async json() {
      controller.abort();
      return { success: false, message: 'Private internal error' };
    },
  }));
  await assert.rejects(apiFetch('/api/wallets', { signal: controller.signal }), (error) => {
    assert.equal(error.name, 'AbortError');
    assert.equal(getUserErrorMessage(error), '');
    return true;
  });
});

test('a successful HTTP write with an unreadable body stays unconfirmed and can be retried safely', async (t) => {
  const keys = [];
  setup(t, async (endpoint, options) => {
    if (endpoint === '/api/auth/csrf') return json(200, { success: true, csrfToken: 'test-csrf' });
    keys.push(options.headers['Idempotency-Key']);
    if (keys.length === 1) return new Response('<html>broken reply</html>', { status: 200 });
    return json(200, { success: true });
  });
  const options = { method: 'POST', body: '{"amount":2000}' };
  await assert.rejects(apiFetch('/api/wallets', options), { code: 'WRITE_UNCONFIRMED', message: translate('vi', 'error.writeUnconfirmed') });
  await apiFetch('/api/wallets', options);
  assert.equal(keys[0], keys[1]);
});
