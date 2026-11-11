// Shared harness for the store tests: loads the real Zustand stores in Node and
// replaces only the network boundary (globalThis.fetch) with a scripted API.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// The app is bundled by Vite, so its sources import siblings without an
// extension ('./useWalletStore'). Node needs the extension spelled out.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL?.includes('/frontEnd-react/src/')) {
      const candidate = new URL(specifier + '.js', context.parentURL);
      if (!/\.\w+$/.test(specifier) && existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(specifier, context);
  }
});

const { useTransactionStore } = await import('../../src/stores/useTransactionStore.js');
const { useWalletStore } = await import('../../src/stores/useWalletStore.js');
const { useJarStore } = await import('../../src/stores/useJarStore.js');
const { useSpendingStore } = await import('../../src/stores/useSpendingStore.js');
const { useToastStore } = await import('../../src/stores/useToastStore.js');
const { clearApiSession } = await import('../../src/services/api.js');
const { invalidateSession } = await import('../../src/services/sessionRuntime.js');
const { getLocalMonthString } = await import('../../src/utils/formatters.js');

export { useTransactionStore, useWalletStore, useJarStore, useSpendingStore, useToastStore, invalidateSession };

const stores = [useTransactionStore, useWalletStore, useJarStore, useSpendingStore, useToastStore];

/** The month the app treats as "this month", and one that never is. */
export const THIS_MONTH = getLocalMonthString();
export const OLD_MONTH = '2001-01';
export const inThisMonth = (day = '01') => `${THIS_MONTH}-${day}`;

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' }
});

/**
 * Starts every test from a signed-out-clean state and installs a scripted API.
 *
 * `routes` maps 'METHOD /api/path' (no query string) to a handler. A handler
 * receives { query, body, headers } and returns the JSON body of a 200 answer,
 * or { status, body } for a failure. Handlers may be replaced during a test
 * through `api.routes`. A request with no handler fails the test.
 */
export function setup(t, routes = {}) {
  // A new session epoch drops in-flight work and the per-session budget cache key.
  invalidateSession();
  clearApiSession();
  for (const store of stores) store.setState(store.getInitialState(), true);

  const calls = [];
  const unexpected = [];
  let pending = 0;
  const api = { routes: { ...routes }, calls };

  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (endpoint, options = {}) => {
    if (endpoint === '/api/auth/csrf') return json(200, { success: true, csrfToken: 'test-csrf' });
    const method = (options.method || 'GET').toUpperCase();
    const url = new URL(endpoint, 'http://app.test');
    const key = `${method} ${url.pathname}`;
    const call = {
      key, method, path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body: options.body ? JSON.parse(options.body) : undefined,
      headers: options.headers || {}
    };
    calls.push(call);
    const handler = api.routes[key];
    if (!handler) {
      unexpected.push(key);
      return json(500, { success: false, message: `No test route for ${key}` });
    }
    pending += 1;
    try {
      const result = await handler(call);
      if (result && typeof result.status === 'number' && 'body' in result) return json(result.status, result.body);
      return json(200, result);
    } finally {
      pending -= 1;
    }
  };

  /** Requests to one route, e.g. api.sent('POST /api/spending'). */
  api.sent = (key) => calls.filter((call) => call.key === key);
  /** Waits for refreshes the stores start without awaiting them. */
  api.settle = async () => {
    for (let quiet = 0; quiet < 3;) {
      await new Promise((resolve) => setImmediate(resolve));
      quiet = pending === 0 ? quiet + 1 : 0;
    }
  };

  t.after(async () => {
    await api.settle();
    globalThis.fetch = previousFetch;
    clearApiSession();
    assert.deepEqual(unexpected, [], 'the store called an API route the test did not script');
  });
  return api;
}

/** A promise the test resolves by hand, to hold a response open. */
export function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

export const ok = (data, extra = {}) => ({ success: true, data, ...extra });
export const fail = (status, message) => ({ status, body: { success: false, message } });

/** The three numbers the Home screen shows. */
export const metrics = () => {
  const { totalBalance, monthlyIncome, monthlyExpense } = useSpendingStore.getState();
  return { balance: totalBalance, income: monthlyIncome, expense: monthlyExpense };
};
