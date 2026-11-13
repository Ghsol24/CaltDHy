import { calculateAvailableToSpend } from './financeMath.js';

const pad = (value) => String(value).padStart(2, '0');
const iso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const total = (transaction) => (Number(transaction.amount) || 0) + (Number(transaction.fee) || 0);

/**
 * Month-end forecast from what is already recorded: today's spendable balance, minus everyday spending
 * continued at this month's daily pace, minus/plus recurring items still due this month.
 * Days the person marked as "expected high spend" and recurring payments are left out of the pace,
 * because they are one-offs or already counted as scheduled items.
 */
export function forecastMonthEnd({ transactions = [], wallets = [], jars = [], installments = [], expectedDays = [], now = new Date() }) {
  const today = iso(now);
  const month = today.slice(0, 7);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthEnd = `${month}-${pad(daysInMonth)}`;
  const elapsed = now.getDate();
  const expected = new Set(expectedDays);
  const { availableToSpend, monthlyIncome, monthlyExpense } = calculateAvailableToSpend({ wallets, transactions, jars, currentMonthPrefix: month });

  let everyday = 0;
  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || !String(transaction.date || '').startsWith(month)) continue;
    if (transaction.date > today || transaction.installmentId || expected.has(transaction.date)) continue;
    everyday += total(transaction);
  }
  const dailyPace = everyday / elapsed;
  const remainingDays = daysInMonth - elapsed;
  const projectedSpend = Math.round(dailyPace * remainingDays);

  const upcoming = installments
    .filter((item) => item.isActive !== false && item.nextDueDate && item.nextDueDate.slice(0, 10) > today && item.nextDueDate.slice(0, 10) <= monthEnd)
    .map((item) => ({ id: item.id, name: item.name, type: item.type, amount: item.monthlyAmount || item.amount, date: item.nextDueDate.slice(0, 10) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const upcomingExpense = upcoming.filter((item) => item.type !== 'income').reduce((sum, item) => sum + item.amount, 0);
  const upcomingIncome = upcoming.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);

  return {
    balanceNow: availableToSpend, dailyPace: Math.round(dailyPace), remainingDays, projectedSpend,
    upcoming, upcomingExpense, upcomingIncome,
    projectedBalance: availableToSpend - projectedSpend - upcomingExpense + upcomingIncome,
    income: monthlyIncome, expense: monthlyExpense,
    // Share of this month's income that has not been spent; null until there is income to compare with.
    savingsRate: monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpense) * 100) / monthlyIncome) : null,
    hasData: everyday > 0 || upcoming.length > 0
  };
}

/**
 * When a savings jar should reach its target at the pace of the last 90 days of net deposits.
 * Returns { done } | { date, monthly } | { stalled } so the caller never shows an invented date.
 */
export function estimateJarCompletion(jar, now = new Date()) {
  const remaining = (Number(jar.target) || 0) - (Number(jar.current) || 0);
  if (remaining <= 0) return { done: true };
  const windowStart = now.getTime() - 90 * 86400000;
  let net = 0;
  let first = now.getTime();
  for (const entry of jar.history || []) {
    const time = new Date(entry.date).getTime();
    if (Number.isNaN(time) || time < windowStart || time > now.getTime()) continue;
    net += entry.type === 'withdraw' ? -entry.amount : entry.amount;
    first = Math.min(first, time);
  }
  // A jar opened last week is judged over at least 30 days, so one large first deposit is not read as the pace.
  const days = Math.max(30, Math.ceil((now.getTime() - first) / 86400000));
  const daily = net / days;
  if (daily <= 0) return { stalled: true };
  const date = new Date(now.getTime() + Math.ceil(remaining / daily) * 86400000);
  if (date.getFullYear() - now.getFullYear() > 30) return { stalled: true };
  return { date: iso(date), monthly: Math.round(daily * 30), late: Boolean(jar.targetDate && iso(date) > jar.targetDate) };
}

/** Monday-to-Sunday week containing `now`, as ISO dates. */
export function currentWeekRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { from: iso(start), to: iso(end) };
}

export function expenseBetween(transactions, from, to) {
  return transactions.reduce((sum, transaction) => (transaction.type === 'expense' && transaction.date >= from && transaction.date <= to
    ? sum + total(transaction) : sum), 0);
}
