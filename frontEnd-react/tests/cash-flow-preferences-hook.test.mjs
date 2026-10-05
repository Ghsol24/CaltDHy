import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { create } from 'zustand';
import { act, createElement, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as preferences from '../src/utils/cashFlowPreferences.js';

// Load the real hook with injected account/API boundaries so deferred requests can
// deterministically exercise failures and account switches without a live server.
const source = (await readFile(new URL('../src/hooks/useCashFlowPreferences.js', import.meta.url), 'utf8'))
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace('export function useCashFlowPreferences', 'function useCashFlowPreferences');
const factory = new Function('useCallback', 'useEffect', 'useRef', 'useState',
  'useAuthStore', 'useSpendingStore', 'sessionEpoch', 'sessionChangedError',
  'cashFlowEntryView', 'normalizeCashFlowPreferences', 'sameCashFlowView', 'updateCashFlowView',
  `${source}\nreturn useCashFlowPreferences;`);

const firstView = { mode: 'daily', series: 'expense', excludeRecurring: false };
const pin = { mode: 'daily', series: 'income', excludeRecurring: true };
const makeUser = (id, cashFlow = { lastUsed: null, pinnedDefault: null }) => ({ id,
  preferences: { analyticsExcludeRecurring: false, cashFlow } });

async function harness(initial = makeUser('owner')) {
  const dom = new JSDOM('<div id="root"></div>');
  const previous = { window: globalThis.window, document: globalThis.document,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let epoch = 1;
  const requests = [];
  const useAuthStore = create(() => ({ user: initial,
    updatePreferences: update => new Promise((resolve, reject) => {
      requests.push({ update, reject, resolve: () => {
        const user = useAuthStore.getState().user;
        const next = { ...user.preferences, ...update,
          cashFlow: { ...user.preferences.cashFlow, ...update.cashFlow } };
        useAuthStore.setState({ user: { ...user, preferences: next } });
        resolve({ preferences: next });
      } });
    }) }));
  const useSpendingStore = create(set => ({ analyticsExcludeRecurring: false,
    setAnalyticsExcludeRecurring: value => set({ analyticsExcludeRecurring: value }) }));
  const useCashFlowPreferences = factory(useCallback, useEffect, useRef, useState,
    useAuthStore, useSpendingStore, () => epoch,
    () => Object.assign(new Error('Changed session'), { code: 'SESSION_CHANGED' }),
    preferences.cashFlowEntryView, preferences.normalizeCashFlowPreferences,
    preferences.sameCashFlowView, preferences.updateCashFlowView);
  let current;
  const root = createRoot(dom.window.document.getElementById('root'));
  function Probe({ active }) {
    current = useCashFlowPreferences({ active });
    return null;
  }
  const render = active => act(() => root.render(createElement(Probe, { active })));
  await render(true);
  return { requests, useAuthStore, useSpendingStore, render, get current() { return current; },
    async switchAccount(user) { await act(() => {
      epoch += 1;
      useAuthStore.setState({ user });
    }); },
    async close() {
      await act(() => root.unmount());
      dom.window.close();
      Object.assign(globalThis, previous);
    } };
}

test('fresh entry prioritizes pin, direct choice persists last use, and unpin restores it', async () => {
  const h = await harness(makeUser('owner', { lastUsed: firstView, pinnedDefault: pin }));
  try {
    assert.deepEqual(h.current.view, pin);
    let changing;
    await act(() => { changing = h.current.setView({ mode: '6months', series: 'both' }); });
    const selected = { ...pin, mode: '6months', series: 'both' };
    assert.deepEqual(h.current.view, selected);
    assert.deepEqual(h.requests[0].update, { analyticsExcludeRecurring: true,
      cashFlow: { lastUsed: selected } });
    await act(async () => { h.requests[0].resolve(); await changing; });
    assert.deepEqual(h.current.pinnedDefault, pin);
    await h.render(false);
    await h.render(true);
    assert.deepEqual(h.current.view, pin);
    let clearing;
    await act(() => { clearing = h.current.clearDefault(); });
    assert.deepEqual(h.current.view, selected);
    await act(async () => { h.requests[1].resolve(); await clearing; });
    assert.equal(h.current.pinnedDefault, null);
    assert.deepEqual(h.requests[1].update, { cashFlow: { pinnedDefault: null } });
  } finally { await h.close(); }
});

test('pinning a visible drilldown changes only the pin; success and failure leave last use and current view intact', async () => {
  const remembered = { mode: '3months', series: 'expense', excludeRecurring: false };
  const h = await harness(makeUser('owner', { lastUsed: remembered, pinnedDefault: null }));
  try {
    let pinning;
    await act(() => { pinning = h.current.pinDefault({ mode: 'daily' }); });
    assert.deepEqual(h.requests[0].update, { cashFlow: { pinnedDefault: firstView } });
    assert.deepEqual(h.current.view, remembered);
    await act(async () => { h.requests[0].resolve(); await pinning; });
    assert.deepEqual(h.current.view, remembered);
    assert.deepEqual(h.current.pinnedDefault, firstView);
    assert.deepEqual(h.useAuthStore.getState().user.preferences.cashFlow.lastUsed, remembered);
    let failedPin;
    await act(() => { failedPin = h.current.pinDefault({ mode: '6months' }).catch(error => error); });
    await act(async () => { h.requests[1].reject(new Error('Failure')); await failedPin; });
    assert.deepEqual(h.current.view, remembered);
    assert.deepEqual(h.current.pinnedDefault, firstView);
    assert.deepEqual(h.useAuthStore.getState().user.preferences.cashFlow.lastUsed, remembered);
    await h.render(false);
    await h.render(true);
    assert.deepEqual(h.current.view, firstView);
    let clearing;
    await act(() => { clearing = h.current.clearDefault(); });
    await act(async () => { h.requests[2].resolve(); await clearing; });
    assert.deepEqual(h.current.view, remembered);
  } finally { await h.close(); }
});

test('a late failed selection cannot roll back a newer choice and failed latest rolls back to committed state', async () => {
  const h = await harness();
  try {
    let first, second;
    await act(() => {
      first = h.current.setView({ series: 'income' }).catch(error => error);
      second = h.current.setView({ mode: '3months', series: 'both' }).catch(error => error);
    });
    assert.equal(h.current.saving, true);
    await act(async () => { h.requests[0].reject(new Error('First failure')); await first; });
    assert.deepEqual(h.current.view, { ...firstView, mode: '3months', series: 'both' });
    await act(async () => { h.requests[1].reject(new Error('Second failure')); await second; });
    assert.deepEqual(h.current.view, firstView);
    assert.equal(h.current.saving, false);
  } finally { await h.close(); }
});

test('latest save failure restores the previous successful view without changing its pin', async () => {
  const h = await harness(makeUser('owner', { lastUsed: firstView, pinnedDefault: pin }));
  try {
    let first, second;
    await act(() => {
      first = h.current.setView({ series: 'both' });
      second = h.current.setView({ mode: '3months' }).catch(error => error);
    });
    await act(async () => { h.requests[0].resolve(); await first; });
    await act(async () => { h.requests[1].reject(new Error('Failure')); await second; });
    assert.deepEqual(h.current.view, { ...pin, series: 'both' });
    assert.deepEqual(h.current.pinnedDefault, pin);
  } finally { await h.close(); }
});

test('a failed selection after successful unpin restores last use instead of the removed pin', async () => {
  const h = await harness(makeUser('owner', { lastUsed: firstView, pinnedDefault: pin }));
  try {
    let clearing;
    await act(() => { clearing = h.current.clearDefault(); });
    await act(async () => { h.requests[0].resolve(); await clearing; });
    assert.deepEqual(h.current.view, firstView);
    let changing;
    await act(() => { changing = h.current.setView({ mode: '6months' }).catch(error => error); });
    await act(async () => { h.requests[1].reject(new Error('Failure')); await changing; });
    assert.deepEqual(h.current.view, firstView);
    assert.equal(h.current.pinnedDefault, null);
  } finally { await h.close(); }
});

test('failed pin and selection restore a pinned view, and old account failures cannot alter a new account', async () => {
  const h = await harness(makeUser('owner', { lastUsed: null, pinnedDefault: pin }));
  try {
    let changing;
    await act(() => { changing = h.current.setView({ series: 'both' }).catch(error => error); });
    await act(async () => { h.requests[0].reject(new Error('Failure')); await changing; });
    assert.deepEqual(h.current.view, pin);
    let clearing;
    await act(() => { clearing = h.current.clearDefault().catch(error => error); });
    await act(async () => { h.requests[1].reject(new Error('Failure')); await clearing; });
    assert.deepEqual(h.current.view, pin);
    assert.deepEqual(h.current.pinnedDefault, pin);
    let stale;
    await act(() => { stale = h.current.setView({ mode: '6months' }).catch(error => error); });
    await h.switchAccount(makeUser('other'));
    assert.deepEqual(h.current.view, firstView);
    await act(async () => { h.requests[2].reject(new Error('Expired request')); await stale; });
    assert.deepEqual(h.current.view, firstView);
    assert.equal(h.current.pinnedDefault, null);
    assert.equal(h.useSpendingStore.getState().analyticsExcludeRecurring, false);
  } finally { await h.close(); }
});

test('auth preference writes serialize and never send an old queued update after an account switch', async () => {
  const dom = new JSDOM('', { url: 'https://example.test' });
  const previous = { window: globalThis.window, localStorage: globalThis.localStorage };
  globalThis.window = dom.window;
  globalThis.localStorage = dom.window.localStorage;
  let epoch = 0;
  const pending = [];
  const scopedError = () => Object.assign(new Error('Changed session'), { code: 'SESSION_CHANGED' });
  const fakeStore = () => create(() => ({ closeConfirm: () => {}, hydrateAnalyticsExcludeRecurring: () => {} }));
  const stores = Array.from({ length: 6 }, fakeStore);
  const authSource = (await readFile(new URL('../src/stores/useAuthStore.js', import.meta.url), 'utf8'))
    .replace(/^import[\s\S]*?;\n/gm, '')
    .replace('export const useAuthStore', 'const useAuthStore');
  const authFactory = new Function('create', 'authService', 'apiFetch', 'clearApiSession',
    'invalidateSession', 'sessionEpoch', 'assertSession', 'sessionChangedError',
    'normalizeCashFlowPreferences', 'isCashFlowView', 'useTransactionStore', 'useWalletStore',
    'useJarStore', 'useSpendingStore', 'useToastStore', 'useConfirmStore', `${authSource}\nreturn useAuthStore;`);
  const authStore = authFactory(create, { updatePreferences: update => new Promise((resolve, reject) => {
    pending.push({ update, resolve, reject });
  }) }, async () => {}, () => {}, () => { epoch += 1; }, () => epoch,
  value => { if (value !== epoch) throw scopedError(); }, scopedError,
  preferences.normalizeCashFlowPreferences, preferences.isCashFlowView, ...stores);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  try {
    authStore.setState({ user: makeUser('owner') });
    const first = authStore.getState().updatePreferences({ cashFlow: { lastUsed: firstView } }).catch(error => error);
    const second = authStore.getState().updatePreferences({ cashFlow: { pinnedDefault: pin } }).catch(error => error);
    await flush();
    assert.equal(pending.length, 1, 'second write waits for the first response');
    authStore.getState().expire();
    authStore.setState({ user: makeUser('other') });
    const other = authStore.getState().updatePreferences({ analyticsExcludeRecurring: true });
    await flush();
    assert.equal(pending.length, 2, 'new account does not wait for a revoked account request');
    pending[0].resolve({ preferences: { analyticsExcludeRecurring: false,
      cashFlow: { lastUsed: firstView, pinnedDefault: null } } });
    assert.equal((await first).code, 'SESSION_CHANGED');
    assert.equal((await second).code, 'SESSION_CHANGED');
    assert.equal(pending.length, 2, 'old queued pin update never reaches the server');
    pending[1].resolve({ preferences: { analyticsExcludeRecurring: true,
      cashFlow: { lastUsed: null, pinnedDefault: null } } });
    await other;
    assert.equal(authStore.getState().user.id, 'other');
    assert.deepEqual(authStore.getState().user.preferences, { analyticsExcludeRecurring: true,
      cashFlow: { lastUsed: null, pinnedDefault: null } });
  } finally {
    dom.window.close();
    Object.assign(globalThis, previous);
  }
});
