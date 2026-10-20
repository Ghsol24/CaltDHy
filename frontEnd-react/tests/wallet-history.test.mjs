import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { create } from 'zustand';
import { calculateWalletBalances } from '../src/utils/financeMath.js';
import { summarizeTransactions } from '../src/utils/transactionInsights.js';
import { invalidateSession, sessionEpoch, scopedSet, scopedGet } from '../src/services/sessionRuntime.js';

// Exercise the real store with controlled API responses, including late replies
// after logout, without requiring a live database or listening socket.
const source = (await readFile(new URL('../src/stores/useWalletStore.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '').replace('export const useWalletStore', 'const useWalletStore');
const factory = new Function('create', 'walletService', 'useTransactionStore', 'calculateWalletBalances',
  'sessionEpoch', 'scopedSet', 'scopedGet', 'getUserErrorMessage', `${source}\nreturn useWalletStore;`);
const wallet = { id: 'wallet-1', name: 'New wallet', initialBalance: 125000 };
const activity = { id: 'event-1', walletId: wallet.id, walletName: wallet.name,
  initialBalance: wallet.initialBalance, type: 'wallet_created', date: '2026-10-20' };
const response = { success: true, data: wallet, activity };

function harness(service) {
  return factory(create, service, { getState: () => ({ transactions: [] }) }, calculateWalletBalances,
    sessionEpoch, scopedSet, scopedGet, error => error.message || 'Request failed');
}

test('creation appears immediately, retries do not duplicate history, and reload restores it', async () => {
  const store = harness({ createWallet: async () => response,
    getWallets: async () => ({ success: true, data: [wallet], history: [activity] }) });
  await store.getState().createWallet(wallet);
  assert.deepEqual(store.getState().walletHistory, [activity]);
  await store.getState().createWallet(wallet);
  assert.equal(store.getState().walletHistory.length, 1);
  store.setState({ walletHistory: [] });
  await store.getState().fetchWallets();
  assert.deepEqual(store.getState().walletHistory, [activity]);
  assert.equal(calculateWalletBalances(store.getState().wallets, []).balances[wallet.id], 125000);
  assert.deepEqual(summarizeTransactions([activity]), { income: 0, expense: 0, count: 1 });
});

test('failed requests and late replies from a signed-out account cannot add history', async () => {
  const failed = harness({ createWallet: async () => { throw new Error('Failed'); } });
  await assert.rejects(failed.getState().createWallet(wallet), /Failed/);
  assert.deepEqual(failed.getState().walletHistory, []);
  let finish;
  const store = harness({ createWallet: () => new Promise(resolve => { finish = resolve; }) });
  const pending = store.getState().createWallet(wallet);
  invalidateSession();
  store.setState(store.getInitialState(), true);
  finish(response);
  await assert.rejects(pending, error => error.code === 'SESSION_CHANGED');
  assert.deepEqual(store.getState().walletHistory, []);
  assert.deepEqual(store.getState().wallets, []);
});
