import test from 'node:test';
import assert from 'node:assert/strict';
import { beginOAuth } from '../src/services/oauthFlow.js';
import { consumeOAuthSignIn } from '../src/services/oauthReturn.js';
import { getSocialCopy, socialErrorText } from '../src/components/auth/socialLoginCopy.js';

function fakeBrowser(search = '') {
  const store = new Map();
  const visited = [];
  globalThis.sessionStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  globalThis.window = { location: { search, assign: (url) => visited.push(url) } };
  return { store, visited, go: (next) => { globalThis.window.location.search = next; } };
}

test('starting a social sign-in stays on this app and only forwards a well-formed invite', () => {
  const browser = fakeBrowser();
  beginOAuth('google');
  beginOAuth('facebook', 'a'.repeat(64));
  beginOAuth('google', '../../evil?x=1');
  beginOAuth('https://evil.example');
  assert.deepEqual(browser.visited, ['/api/auth/oauth/google/start',
    `/api/auth/oauth/facebook/start?invite=${'a'.repeat(64)}`, '/api/auth/oauth/google/start']);
});

test('only a sign-in this tab started, and that the server finished, counts as a deliberate login', () => {
  // A crafted link alone must not lift the logout barrier.
  fakeBrowser('?oauth=done');
  assert.equal(consumeOAuthSignIn(), false);

  // Returning to a confirmation step or an error is not a completed sign-in, and it ends the attempt:
  // a crafted "done" link opened afterwards finds nothing to redeem.
  for (const search of ['?oauth=link', '?oauth=verify', '?oauth_error=failed', '?oauth=done-ish']) {
    const returned = fakeBrowser();
    beginOAuth('google');
    returned.go(search);
    assert.equal(consumeOAuthSignIn(), false, search);
    returned.go('?oauth=done');
    assert.equal(consumeOAuthSignIn(), false, search);
  }
  const browser = fakeBrowser();
  beginOAuth('google');
  // Ordinary page loads in between (no provider return) leave the attempt alone.
  assert.equal(consumeOAuthSignIn(), false);
  browser.go('?oauth=done');
  assert.equal(consumeOAuthSignIn(), true);
  // One use only: a reload of the same address is not a new login.
  assert.equal(consumeOAuthSignIn(), false);

  const stale = fakeBrowser('?oauth=done');
  stale.store.set('caltdhy_oauth_intent', String(Date.now() - 16 * 60 * 1000));
  assert.equal(consumeOAuthSignIn(), false);
});

test('every locale has the same social sign-in copy, and unknown error codes fall back safely', () => {
  const shape = (value) => Object.entries(value).map(([key, entry]) =>
    [key, typeof entry === 'object' ? Object.keys(entry).sort() : typeof entry]).sort();
  const vi = getSocialCopy('vi');
  for (const locale of ['en', 'zh-CN']) {
    assert.deepEqual(shape(getSocialCopy(locale)), shape(vi), locale);
    assert.notEqual(getSocialCopy(locale).errors.failed, vi.errors.failed);
  }
  assert.equal(getSocialCopy('zh-TW'), getSocialCopy('zh-CN'));
  assert.equal(getSocialCopy('fr'), vi);
  assert.equal(socialErrorText(vi, 'no_email'), vi.errors.no_email);
  for (const code of ['constructor', '__proto__', 'toString', '<script>', '']) {
    assert.equal(socialErrorText(vi, code), vi.errors.failed, code);
  }
  assert.match(vi.linkBody('google', 'a@example.test'), /a@example\.test.*Google/);
});

test('a Settings link result is read once from the return address, and only for known providers', async () => {
  const { captureLinkReturn, takeLinkReturn } = await import('../src/services/oauthFlow.js');
  assert.equal(captureLinkReturn('?linked=github'), false);
  assert.equal(takeLinkReturn(), null);
  assert.equal(captureLinkReturn('?linked=google'), true);
  assert.deepEqual(takeLinkReturn(), { provider: 'google', ok: true });
  assert.equal(takeLinkReturn(), null);
  captureLinkReturn('?link_error=in_use&provider=facebook');
  assert.deepEqual(takeLinkReturn(), { provider: 'facebook', ok: false, code: 'in_use' });
});

test('linked-account copy matches across locales and unknown link errors fall back safely', async () => {
  const { getLinkedAccountsCopy, linkErrorText } = await import('../src/features/account/settings/linkedAccountsCopy.js');
  const shape = (value) => Object.entries(value).map(([key, entry]) =>
    [key, typeof entry === 'object' ? Object.keys(entry).sort() : typeof entry]).sort();
  const vi = getLinkedAccountsCopy('vi');
  for (const locale of ['en', 'zh-CN']) assert.deepEqual(shape(getLinkedAccountsCopy(locale)), shape(vi), locale);
  assert.match(linkErrorText(vi, 'in_use', 'google'), /Google.*khác/);
  for (const code of ['__proto__', 'constructor', 'whatever']) assert.equal(linkErrorText(vi, code, 'facebook'), vi.errors.failed('facebook'));
});
