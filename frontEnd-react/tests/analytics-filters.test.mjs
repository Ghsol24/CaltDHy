import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterTrendTransactions,
  isRecurringTrendTransaction,
  summarizeRecurringExpenses
} from '../src/utils/analyticsFilters.js';
import { transactionsForDay, summarizeTransactions, unusualSpendingDays } from '../src/utils/transactionInsights.js';
import { historyDateRange } from '../src/utils/historyDatePresets.js';

const transactions = [
  { id: 'ordinary', type: 'expense', amount: 120000, fee: 5000, date: '2026-09-02', desc: 'Ăn trưa' },
  { id: 'recurring', type: 'expense', amount: 250000, fee: 10000, date: '2026-09-03', desc: 'Thanh toán định kỳ: Internet' },
  { id: 'installment', type: 'expense', amount: 400000, fee: 0, date: '2026-08-03', installmentId: 'installment-1', desc: 'Điện thoại' },
  { id: 'income-recurring-label', type: 'income', amount: 1000000, fee: 0, date: '2026-09-05', desc: 'Thanh toán định kỳ: Hoàn tiền' }
];

test('nhận diện giao dịch định kỳ theo mã trả góp hoặc tiền tố mô tả', () => {
  assert.equal(isRecurringTrendTransaction(transactions[0]), false);
  assert.equal(isRecurringTrendTransaction(transactions[1]), true);
  assert.equal(isRecurringTrendTransaction(transactions[2]), true);
  assert.equal(isRecurringTrendTransaction(null), false);
});

test('bộ lọc dòng tiền giữ nguyên dữ liệu khi tắt và loại định kỳ ngay khi bật', () => {
  assert.equal(filterTrendTransactions(transactions, false), transactions);
  assert.deepEqual(filterTrendTransactions(transactions, true).map(({ id }) => id), ['ordinary']);
  assert.deepEqual(filterTrendTransactions(undefined, true), []);
});

test('tóm tắt chỉ đếm chi phí định kỳ trong đúng khoảng tháng, gồm cả phí', () => {
  assert.deepEqual(summarizeRecurringExpenses(transactions, ['2026-09']), { count: 1, amount: 260000 });
  assert.deepEqual(summarizeRecurringExpenses(transactions, ['2026-08', '2026-09']), { count: 2, amount: 660000 });
  assert.deepEqual(summarizeRecurringExpenses(transactions, ['2026-07']), { count: 0, amount: 0 });
});

test('chi tiết ngày khớp tổng cột chi tiêu, gồm phí và cùng bộ lọc định kỳ', () => {
  const all = transactionsForDay(transactions, '2026-09-03');
  assert.deepEqual(all.map((row) => row.id), ['recurring']);
  assert.deepEqual(summarizeTransactions(all), { income: 0, expense: 260000, count: 1 });
  assert.deepEqual(transactionsForDay(transactions, '2026-09-03', { excludeRecurring: true }), []);
  assert.deepEqual(transactionsForDay(transactions, '2026-09-05', { type: 'income' }).map((row) => row.id),
    ['income-recurring-label']);
});

test('gợi ý ngày cao so với lịch sử, bỏ khoản định kỳ và ngày đã xác nhận', () => {
  const history = Array.from({ length: 8 }, (_, index) => ({
    type: 'expense', date: `2026-08-${String(index + 20).padStart(2, '0')}`,
    amount: 100000 + index * 1000, fee: 0
  }));
  history.push({ type: 'expense', date: '2026-09-03', amount: 1000000, fee: 25000 });
  history.push({ type: 'expense', date: '2026-09-03', amount: 2000000,
    desc: 'Thanh toán định kỳ: thuê nhà' });
  const found = unusualSpendingDays(history, '2026-09', [], '2026-09-24');
  assert.equal(found.length, 1);
  assert.equal(found[0].date, '2026-09-03');
  assert.equal(found[0].amount, 1025000);
  assert.ok(found[0].ratio > 9);
  assert.deepEqual(unusualSpendingDays(history, '2026-09', ['2026-09-03'], '2026-09-24'), []);
  assert.deepEqual(unusualSpendingDays(history.slice(-2), '2026-09', [], '2026-09-24'), []);
});

test('bộ lọc kỳ lịch sử xử lý ngày địa phương và ranh giới tháng', () => {
  const today = new Date(2026, 2, 2);
  assert.deepEqual(historyDateRange('thisMonth', today), { from: '2026-03-01', to: '2026-03-31' });
  assert.deepEqual(historyDateRange('lastMonth', today), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(historyDateRange('last7Days', today), { from: '2026-02-24', to: '2026-03-02' });
  assert.deepEqual(historyDateRange('lastMonth', new Date(2024, 2, 1)),
    { from: '2024-02-01', to: '2024-02-29' });
  assert.deepEqual(historyDateRange('all', today), { from: '', to: '' });
});
