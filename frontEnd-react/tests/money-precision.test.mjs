import test from 'node:test';
import assert from 'node:assert/strict';
import { moneyInteger, moneyNumber, sumMoney, inspectMoneyDisplay } from '../src/utils/moneyPrecision.js';
import { calculateWalletBalances, calculateMonthlyStats, calculateAvailableToSpend } from '../src/utils/financeMath.js';
import { formatCurrency } from '../src/utils/formatters.js';
import { sortWalletsByBalance } from '../src/utils/walletSort.js';

const max = Number.MAX_SAFE_INTEGER;

test('exact sums survive intermediate overflow and cancellation', () => {
  assert.equal(sumMoney([max, 2, -max]), 2n);
  assert.equal(moneyNumber(sumMoney([max, 2, -max])), 2);
  assert.throws(() => moneyNumber(sumMoney([max, 2])), RangeError);
  for (const invalid of [max + 1, 1.5, NaN, Infinity, '123', null]) {
    assert.throws(() => moneyInteger(invalid), RangeError);
  }
});

test('wallet ledger computes exact final balance independent of intermediate size', () => {
  const entries = [
    { type: 'income', walletId: 'cash', amount: max },
    { type: 'income', walletId: 'cash', amount: 2 },
    { type: 'expense', walletId: 'cash', amount: max }
  ];
  assert.equal(calculateWalletBalances([{ id: 'cash', initialBalance: 0 }], entries).balances.cash, 2);
});

test('monthly turnover and aggregate holdings refuse lossy Number conversion', () => {
  const transactions = [
    { type: 'income', amount: max, date: '2026-09-01' },
    { type: 'income', amount: 2, date: '2026-09-02' }
  ];
  assert.throws(() => calculateMonthlyStats(transactions, '2026-09'), RangeError);
  assert.throws(() => calculateAvailableToSpend({ wallets: [
    { id: 'a', initialBalance: max }, { id: 'b', initialBalance: 2 }
  ] }), RangeError);
  assert.equal(calculateMonthlyStats([{ type: 'expense', amount: 10, fee: 2, category: 'Food' }]).expense, 12);
  assert.equal(calculateMonthlyStats([{ type: 'expense', amount: 10, category: '__proto__' }]).byCategory.__proto__, 10);
});

test('display guard detects oversized turnover despite conserved safe wallet balances', () => {
  const transactions = [
    { type: 'income', amount: max }, { type: 'expense', amount: max },
    { type: 'income', amount: 2 }, { type: 'expense', amount: 2 }
  ];
  const result = inspectMoneyDisplay({ transactions });
  assert.equal(result.safe, false);
  assert.equal(result.turnover, BigInt(max) * 2n + 4n);
  assert.equal(inspectMoneyDisplay({ transactions: [{ amount: 12, fee: 1 }] }).safe, true);
  assert.equal(inspectMoneyDisplay({ transactions: [{ amount: max + 1 }] }).invalid, true);
  assert.equal(inspectMoneyDisplay({ jars: [{ current: max, target: max }] }).safe, false);
});

test('currency formatting preserves every digit of oversized exact aggregates', () => {
  assert.match(formatCurrency(9007199254740993n, { locale: 'vi', currency: 'VND' }), /^9\.007\.199\.254\.740\.993\s*₫$/);
  assert.match(formatCurrency(-9007199254740993n, { locale: 'vi', currency: 'VND' }), /^−9\.007\.199\.254\.740\.993\s*₫$/);
  assert.match(formatCurrency(0n, { showSign: true, locale: 'vi', currency: 'VND' }), /^0\s*₫$/);
  assert.equal(formatCurrency(max + 1), 'Ngoài giới hạn hiển thị');
});

test('transfer wallet order follows current balance without mutating default order', () => {
  const wallets = Object.freeze([
    Object.freeze({ id: 'default', isDefault: true, currentBalance: 24_000, initialBalance: 9_000_000 }),
    Object.freeze({ id: 'zalo', currentBalance: 3_180_957 }),
    Object.freeze({ id: 'momo', currentBalance: 1_165_556 }),
    Object.freeze({ id: 'bank', currentBalance: 1_725_888 }),
    Object.freeze({ id: 'tie', currentBalance: 1_165_556 }),
    Object.freeze({ id: 'credit', type: 'credit', currentBalance: -200_000, creditLimit: 10_000_000 }),
    Object.freeze({ id: 'zero', currentBalance: 0, initialBalance: 8_000_000 }),
  ]);
  const sorted = sortWalletsByBalance(wallets);
  assert.deepEqual(sorted.map(w => w.id), ['zalo', 'bank', 'momo', 'tie', 'default', 'zero', 'credit']);
  assert.equal(wallets[0].id, 'default');
  assert.equal(sorted[4], wallets[0]);
  assert.deepEqual(sorted.filter(w => w.id !== 'zalo').map(w => w.id), ['bank', 'momo', 'tie', 'default', 'zero', 'credit']);
});

test('transfer wallet ordering handles empty lists, missing current balances and precise extremes', () => {
  assert.deepEqual(sortWalletsByBalance(), []);
  const sorted = sortWalletsByBalance([
    { id: 'negative', currentBalance: -max },
    { id: 'near-max', currentBalance: max - 1 },
    { id: 'max', currentBalance: max },
    { id: 'missing' },
    { id: 'initial', initialBalance: 50 },
  ]);
  assert.deepEqual(sorted.map(w => w.id), ['max', 'near-max', 'initial', 'missing', 'negative']);
});
