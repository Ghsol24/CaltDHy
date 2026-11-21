import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginOAuth,
  getCachedOAuthProviders,
  hasFreshOAuthProviders,
  loadOAuthProviders,
  resetOAuthProvidersCache,
} from '../src/services/oauthFlow.js';
import { consumeOAuthSignIn } from '../src/services/oauthReturn.js';
import { getSocialCopy, socialErrorText } from '../src/components/auth/socialLoginCopy.js';

function fakeBrowser(search = '', origin = 'https://app.example.test') {
  const store = new Map();
  const localStore = new Map();
  const visited = [];
  globalThis.sessionStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  globalThis.localStorage = {
    getItem: (key) => (localStore.has(key) ? localStore.get(key) : null),
    setItem: (key, value) => localStore.set(key, String(value)),
    removeItem: (key) => localStore.delete(key),
  };
  globalThis.window = { location: { origin, search, assign: (url) => visited.push(url) } };
  return { store, localStore, visited, go: (next) => { globalThis.window.location.search = next; } };
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

test('oauth provider loader deduplicates requests and caches canonical providers per origin', async () => {
  const originalFetch = globalThis.fetch;
  resetOAuthProvidersCache();
  try {
    const browser = fakeBrowser('', 'https://app.example.test');
    let calls = 0;
    let resolveFetch;
    globalThis.fetch = () => {
      calls += 1;
      return new Promise((resolve) => { resolveFetch = resolve; });
    };

    assert.equal(getCachedOAuthProviders(), null);
    assert.equal(hasFreshOAuthProviders(), false);

    const p1 = loadOAuthProviders();
    const p2 = loadOAuthProviders();
    assert.equal(calls, 1);

    resolveFetch({
      ok: true,
      json: async () => ({
        success: true,
        origin: 'https://app.example.test',
        providers: ['facebook', 'unknown-provider', 'google'],
      }),
    });

    const [first, second] = await Promise.all([p1, p2]);
    assert.deepEqual(first, ['google', 'facebook']);
    assert.deepEqual(second, ['google', 'facebook']);
    assert.equal(hasFreshOAuthProviders(), true);
    assert.deepEqual(getCachedOAuthProviders(), ['google', 'facebook']);
    assert.deepEqual(
      JSON.parse(browser.localStore.get('caltdhy_oauth_providers')),
      { origin: 'https://app.example.test', providers: ['google', 'facebook'] },
    );

    // Subsequent calls within the same origin reuse the memory cache without fetching again.
    assert.deepEqual(await loadOAuthProviders(), ['google', 'facebook']);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    resetOAuthProvidersCache();
  }
});

test('oauth provider cache ignores mismatched origins or malformed entries and preserves hint on refresh failure', async () => {
  const originalFetch = globalThis.fetch;
  resetOAuthProvidersCache();
  try {
    const browser = fakeBrowser('', 'https://app.example.test');

    browser.localStore.set('caltdhy_oauth_providers', JSON.stringify({
      origin: 'https://other.example.test',
      providers: ['google'],
    }));
    assert.equal(getCachedOAuthProviders(), null);

    browser.localStore.set('caltdhy_oauth_providers', JSON.stringify({
      origin: 'https://app.example.test',
      providers: ['google', 'github'],
    }));
    assert.equal(getCachedOAuthProviders(), null);

    browser.localStore.set('caltdhy_oauth_providers', '{not-json');
    assert.equal(getCachedOAuthProviders(), null);

    // Valid cached hint survives when background refresh fails.
    const validHint = JSON.stringify({ origin: 'https://app.example.test', providers: ['google', 'facebook'] });
    browser.localStore.set('caltdhy_oauth_providers', validHint);
    assert.deepEqual(getCachedOAuthProviders(), ['google', 'facebook']);
    assert.equal(hasFreshOAuthProviders(), false);

    globalThis.fetch = async () => { throw new Error('network down'); };
    await assert.rejects(() => loadOAuthProviders(), /không ổn định|network|kết nối/i);
    assert.equal(hasFreshOAuthProviders(), false);
    assert.equal(browser.localStore.get('caltdhy_oauth_providers'), validHint);
    assert.deepEqual(getCachedOAuthProviders(), ['google', 'facebook']);
  } finally {
    globalThis.fetch = originalFetch;
    resetOAuthProvidersCache();
  }
});
