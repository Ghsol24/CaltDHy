import test from 'node:test';
import assert from 'node:assert/strict';
import { getHomeOnboardingSteps } from '../src/utils/homeOnboarding.js';

const cash = { id: 'w1', name: 'Tiền mặt', initialBalance: 0, isDefault: true };
const ids = (result) => result.steps.filter((s) => s.done).map((s) => s.id);

test('a brand-new account has every step left, in order', () => {
  const result = getHomeOnboardingSteps({ wallets: [cash], walletHistory: [], budgets: {}, transactions: [] });
  assert.deepEqual(result.steps.map((s) => s.id), ['wallet', 'budget', 'transaction']);
  assert.equal(result.doneCount, 0);
  assert.equal(result.allDone, false);
});

test('wallet step: a non-zero starting balance, an extra wallet or wallet history', () => {
  assert.deepEqual(ids(getHomeOnboardingSteps({ wallets: [{ ...cash, initialBalance: 250000 }] })), ['wallet']);
  assert.deepEqual(ids(getHomeOnboardingSteps({ wallets: [{ ...cash, initialBalance: -50000 }] })), ['wallet']);
  assert.deepEqual(ids(getHomeOnboardingSteps({ wallets: [cash, { id: 'w2', initialBalance: 0 }] })), ['wallet']);
  assert.deepEqual(ids(getHomeOnboardingSteps({ wallets: [cash], walletHistory: [{ id: 'a1' }] })), ['wallet']);
  // Số dư chỉ đổi nhờ giao dịch không tính là đã nhập số dư ban đầu.
  assert.deepEqual(ids(getHomeOnboardingSteps({ wallets: [{ ...cash, balance: -30000 }], transactions: [{ id: 't1' }] })), ['transaction']);
  assert.deepEqual(ids(getHomeOnboardingSteps({ wallets: [{ ...cash, initialBalance: 'abc' }] })), []);
});

test('budget step needs a limit above zero', () => {
  assert.deepEqual(ids(getHomeOnboardingSteps({ wallets: [cash], budgets: { Coffee: 0, Food: '' } })), []);
  assert.deepEqual(ids(getHomeOnboardingSteps({ wallets: [cash], budgets: { Coffee: 500000 } })), ['budget']);
  assert.deepEqual(ids(getHomeOnboardingSteps({ wallets: [cash], budgets: null })), []);
});

test('transaction step ignores system-generated entries', () => {
  assert.deepEqual(ids(getHomeOnboardingSteps({ wallets: [cash], transactions: [{ id: 's', systemGenerated: true }] })), []);
  assert.deepEqual(ids(getHomeOnboardingSteps({ wallets: [cash], transactions: [{ id: 't' }] })), ['transaction']);
});

test('all three done means the card has nothing left to show', () => {
  const result = getHomeOnboardingSteps({
    wallets: [{ ...cash, initialBalance: 1 }], budgets: { Food: 1 }, transactions: [{ id: 't' }],
  });
  assert.equal(result.doneCount, 3);
  assert.equal(result.allDone, true);
});
