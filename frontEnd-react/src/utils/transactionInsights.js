import { isRecurringTrendTransaction } from './analyticsFilters.js';

export const transactionTotal = (transaction) => (
  (Number(transaction?.amount) || 0) + (Number(transaction?.fee) || 0)
);

export function transactionsForDay(transactions, date, { type = 'expense', excludeRecurring = false } = {}) {
  return (Array.isArray(transactions) ? transactions : [])
    .filter((transaction) => transaction.date === date &&
      (type === 'all' || transaction.type === type) &&
      (!excludeRecurring || !isRecurringTrendTransaction(transaction)))
    .sort((a, b) => transactionTotal(b) - transactionTotal(a));
}

export function summarizeTransactions(transactions) {
  return (Array.isArray(transactions) ? transactions : []).reduce((summary, transaction) => {
    if (transaction.type === 'income') summary.income += Number(transaction.amount) || 0;
    if (transaction.type === 'expense') summary.expense += transactionTotal(transaction);
    summary.count += 1;
    return summary;
  }, { income: 0, expense: 0, count: 0 });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// Only compare a day with earlier nonzero spending days. Recurring payments are
// excluded so a regular rent/installment date does not look like a surprise.
export function unusualSpendingDays(transactions, month, expectedDates = [], today) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const todayString = today || new Date().toISOString().slice(0, 10);
  const dayTotals = new Map();
  for (const transaction of Array.isArray(transactions) ? transactions : []) {
    if (transaction.type !== 'expense' || !/^\d{4}-\d{2}-\d{2}$/.test(transaction.date || '') ||
      isRecurringTrendTransaction(transaction)) continue;
    dayTotals.set(transaction.date, (dayTotals.get(transaction.date) || 0) + transactionTotal(transaction));
  }
  const expected = new Set(expectedDates);
  const dates = [...dayTotals.keys()].sort();
  return dates.filter((date) => date.startsWith(month) && date <= todayString && !expected.has(date))
    .map((date) => {
      const currentTime = Date.parse(`${date}T00:00:00.000Z`);
      const previous = dates.filter((candidate) => candidate < date &&
        currentTime - Date.parse(`${candidate}T00:00:00.000Z`) <= 90 * 86400000)
        .map((candidate) => dayTotals.get(candidate)).filter((amount) => amount > 0);
      if (previous.length < 7) return null;
      const baseline = median(previous);
      const deviation = median(previous.map((amount) => Math.abs(amount - baseline)));
      const amount = dayTotals.get(date);
      if (baseline <= 0 || amount < baseline * 2.5 || amount <= baseline + deviation * 3) return null;
      return { date, amount, baseline, ratio: amount / baseline };
    })
    .filter(Boolean)
    .sort((a, b) => b.amount - a.amount);
}
