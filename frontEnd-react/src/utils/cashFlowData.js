const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function cashFlowMonths(endMonth, mode = 'daily') {
  if (!MONTH_PATTERN.test(endMonth || '')) return [];
  const count = mode === '6months' ? 6 : mode === '3months' ? 3 : 1;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(`${endMonth}-01T12:00:00`);
    date.setMonth(date.getMonth() - count + index + 1);
    return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}

function addTransaction(row, transaction) {
  const amount = Number(transaction.amount) || 0;
  if (transaction.type === 'income') row.income += amount;
  if (transaction.type === 'expense') row.expense += amount + (Number(transaction.fee) || 0);
}

export function cashFlowDays(transactions, month) {
  if (!MONTH_PATTERN.test(month || '')) return [];
  const lastDay = new Date(`${month}-01T12:00:00`);
  lastDay.setMonth(lastDay.getMonth() + 1, 0);
  const days = Array.from({ length: lastDay.getDate() }, (_, index) => ({
    day: index + 1,
    label: String(index + 1),
    date: `${month}-${String(index + 1).padStart(2, '0')}`,
    income: 0,
    expense: 0,
  }));
  const byDate = new Map(days.map((row) => [row.date, row]));
  for (const transaction of Array.isArray(transactions) ? transactions : []) {
    const row = byDate.get(transaction.date);
    if (row) addTransaction(row, transaction);
  }
  return days;
}

export function cashFlowMonthTotals(transactions, months) {
  const rows = months.map((prefix) => ({ prefix, income: 0, expense: 0 }));
  const byMonth = new Map(rows.map((row) => [row.prefix, row]));
  for (const transaction of Array.isArray(transactions) ? transactions : []) {
    const row = byMonth.get(transaction.date?.slice(0, 7));
    if (row) addTransaction(row, transaction);
  }
  return rows;
}

export function cashFlowSummary(rows) {
  const summary = rows.reduce((total, row) => ({
    income: total.income + row.income,
    expense: total.expense + row.expense,
  }), { income: 0, expense: 0 });
  return { ...summary, net: summary.income - summary.expense };
}

export function cashFlowTopDays(transactions, months, limit = 5) {
  const inPeriod = new Set(months);
  const totals = new Map();
  for (const transaction of Array.isArray(transactions) ? transactions : []) {
    if (transaction.type !== 'expense' || !inPeriod.has(transaction.date?.slice(0, 7))) continue;
    totals.set(transaction.date, (totals.get(transaction.date) || 0)
      + (Number(transaction.amount) || 0) + (Number(transaction.fee) || 0));
  }
  return [...totals].map(([date, expense]) => ({ date, expense }))
    .filter((row) => row.expense > 0)
    .sort((a, b) => b.expense - a.expense || a.date.localeCompare(b.date))
    .slice(0, limit);
}

export function cashFlowSeriesTypes(series) {
  return series === 'income' ? ['income'] : series === 'both' ? ['income', 'expense'] : ['expense'];
}

export function hasCashFlowData(rows, series) {
  const types = cashFlowSeriesTypes(series);
  return rows.some((row) => types.some((type) => row[type] > 0));
}
