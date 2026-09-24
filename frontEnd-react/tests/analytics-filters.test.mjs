import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterTrendTransactions,
  isRecurringTrendTransaction,
  summarizeRecurringExpenses
} from '../src/utils/analyticsFilters.js';

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
