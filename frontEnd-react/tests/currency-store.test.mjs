import './helpers/vite-resolve.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';

// The store reads the saved choice once, when it loads. A stale "USD" from an older
// deployment must not survive when this build has no published exchange rate.
const saved = new Map([['caltdhy_curr', 'USD']]);
let storageWorks = true;
globalThis.localStorage = {
  getItem: (key) => { if (!storageWorks) throw new Error('blocked'); return saved.get(key) ?? null; },
  setItem: (key, value) => { if (!storageWorks) throw new Error('blocked'); saved.set(key, String(value)); },
};

const { useCurrencyStore } = await import('../src/stores/useCurrencyStore.js');
const { formatCompactCurrency } = await import('../src/utils/compactFormatters.js');
const store = () => useCurrencyStore.getState();

test('without a usable exchange rate the display currency stays VND, even if USD was saved', () => {
  assert.equal(store().usdAvailable, false);
  assert.equal(store().displayCurrency, 'VND');
  assert.equal(formatCompactCurrency(1_500_000, { locale: 'vi' }), '1,5tr', 'formatters follow the store');
});

test('asking for USD is refused and remembered as VND; asking for VND succeeds', () => {
  assert.equal(store().setDisplayCurrency('USD'), false);
  assert.equal(store().displayCurrency, 'VND');
  assert.equal(saved.get('caltdhy_curr'), 'VND');
  assert.equal(store().setDisplayCurrency('EUR'), false, 'unknown currencies fall back to VND');
  assert.equal(store().setDisplayCurrency('VND'), true);
  assert.equal(store().displayCurrency, 'VND');
});

test('blocked storage does not break switching currency', () => {
  storageWorks = false;
  try {
    assert.equal(store().setDisplayCurrency('VND'), true);
    assert.equal(store().displayCurrency, 'VND');
  } finally { storageWorks = true; }
});
