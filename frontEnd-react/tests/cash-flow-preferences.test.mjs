import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cashFlowEntryView, isCashFlowView, normalizeCashFlowPreferences, updateCashFlowView,
} from '../src/utils/cashFlowPreferences.js';

const lastUsed = { mode: '3months', series: 'income', excludeRecurring: false };
const pinnedDefault = { mode: 'daily', series: 'expense', excludeRecurring: true };

test('new account starts with expense per day and preserves the legacy recurring preference', () => {
  assert.deepEqual(cashFlowEntryView(), { mode: 'daily', series: 'expense', excludeRecurring: false });
  assert.deepEqual(cashFlowEntryView({ analyticsExcludeRecurring: true }), pinnedDefault);
});

test('entry selects the pin before last use and clearing it restores last use', () => {
  const preferences = { cashFlow: { lastUsed, pinnedDefault } };
  assert.deepEqual(cashFlowEntryView(preferences), pinnedDefault);
  preferences.cashFlow.pinnedDefault = null;
  assert.deepEqual(cashFlowEntryView(preferences), lastUsed);
  assert.notEqual(cashFlowEntryView(preferences), lastUsed, 'return a copy independent of server data');
});

test('remembered choices contain no literal dates and reject malformed or injected fields', () => {
  for (const bad of [null, [], {}, { ...lastUsed, mode: 'year' }, { ...lastUsed, series: 'all' },
    { ...lastUsed, excludeRecurring: 1 }, { ...lastUsed, selectedMonth: '2026-10' }]) {
    assert.equal(isCashFlowView(bad), false);
    assert.deepEqual(normalizeCashFlowPreferences({ lastUsed: bad, pinnedDefault: bad }),
      { lastUsed: null, pinnedDefault: null });
  }
});

test('changing one deliberate control preserves the other view options', () => {
  assert.deepEqual(updateCashFlowView(lastUsed, { series: 'both' }), { ...lastUsed, series: 'both' });
  assert.deepEqual(updateCashFlowView(lastUsed, previous => ({ excludeRecurring: !previous.excludeRecurring })),
    { ...lastUsed, excludeRecurring: true });
  for (const bad of [{ selectedMonth: '2026-10' }, { mode: null }, { series: 'expense', extra: true }, []]) {
    assert.throws(() => updateCashFlowView(lastUsed, bad), TypeError);
  }
  assert.deepEqual(lastUsed, { mode: '3months', series: 'income', excludeRecurring: false });
});
