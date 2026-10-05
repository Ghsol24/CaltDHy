import test from 'node:test';
import assert from 'node:assert/strict';
import { cashFlowDays, cashFlowMonths, cashFlowMonthTotals, cashFlowSummary,
  cashFlowTopDays, cashFlowSeriesTypes, hasCashFlowData } from '../src/utils/cashFlowData.js';
import { filterTrendTransactions } from '../src/utils/analyticsFilters.js';

test('cash-flow periods end at selected month and cross the calendar-year boundary', () => {
  assert.deepEqual(cashFlowMonths('2026-01', '3months'), ['2025-11', '2025-12', '2026-01']);
  assert.deepEqual(cashFlowMonths('2026-03', '6months'),
    ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03']);
  assert.deepEqual(cashFlowMonths('2026-10', 'daily'), ['2026-10']);
  assert.deepEqual(cashFlowMonths('0099-01', '3months'), ['0098-11', '0098-12', '0099-01']);
  assert.deepEqual(cashFlowMonths('2026-13'), []);
});

test('daily rows respect leap years, fees and transaction types', () => {
  const days = cashFlowDays([
    { date: '2024-02-29', type: 'expense', amount: 120000, fee: 5000 },
    { date: '2024-02-29', type: 'income', amount: 7000000, fee: 9000 },
    { date: '2024-02-29', type: 'transfer', amount: 300000 },
    { date: '2024-03-01', type: 'expense', amount: 400000 },
  ], '2024-02');
  assert.equal(days.length, 29);
  assert.deepEqual(days.at(-1), { day: 29, label: '29', date: '2024-02-29',
    income: 7000000, expense: 125000 });
  assert.equal(cashFlowDays([], '2025-02').length, 28);
  assert.equal(cashFlowDays([], '0004-02').length, 29);
});

test('filtered chart summaries and ranked days reconcile over the whole selected period', () => {
  const transactions = [
    { date: '2026-08-01', type: 'income', amount: 7000000 },
    { date: '2026-08-02', type: 'expense', amount: 200000, fee: 22000 },
    { date: '2026-09-03', type: 'expense', amount: 448000 },
    { date: '2026-09-03', type: 'expense', amount: 250000, installmentId: 'rent' },
    { date: '2026-10-01', type: 'expense', amount: 152000 },
    { date: '2026-07-01', type: 'expense', amount: 9999999 },
  ];
  const months = cashFlowMonths('2026-10', '3months');
  const filtered = filterTrendTransactions(transactions, true);
  const rows = cashFlowMonthTotals(filtered, months);
  assert.deepEqual(cashFlowSummary(rows), { income: 7000000, expense: 822000, net: 6178000 });
  assert.deepEqual(cashFlowTopDays(filtered, months), [
    { date: '2026-09-03', expense: 448000 },
    { date: '2026-08-02', expense: 222000 },
    { date: '2026-10-01', expense: 152000 },
  ]);
  assert.equal(cashFlowSummary(cashFlowMonthTotals(transactions, months)).expense, 1072000);
});

test('income alone does not make an expense-only plot appear to have data', () => {
  const rows = [{ income: 7000000, expense: 0 }];
  assert.equal(hasCashFlowData(rows, 'expense'), false);
  assert.equal(hasCashFlowData(rows, 'income'), true);
  assert.equal(hasCashFlowData(rows, 'both'), true);
  assert.deepEqual(cashFlowSeriesTypes('expense'), ['expense']);
  assert.deepEqual(cashFlowSeriesTypes('both'), ['income', 'expense']);
});
