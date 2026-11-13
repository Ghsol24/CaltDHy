import { calculateMonthlyStats, getBudgetStatus } from './financeMath.js';

/**
 * Everything the budget page shows for one month, from that month's spending and
 * that month's limits only, so the two can never come from different months.
 */
export function buildBudgetModel({ transactions = [], month, budgets = {}, categoryNames = [], rollover = null }) {
  const monthlyStats = calculateMonthlyStats(transactions, month);
  // Limits name their own categories, so a limited category always has a row.
  const names = Array.from(new Set([...categoryNames, ...Object.keys(budgets || {}),
    ...Object.keys(monthlyStats.byCategory || {})]));

  let totalLimit = 0;
  let totalSpent = 0;
  const items = names.map((category) => {
    const rawLimit = budgets && budgets[category] !== undefined ? Number(budgets[category]) : null;
    // Rollover: what was left of this category's limit last month is added to this month's limit.
    const carried = rawLimit && rawLimit > 0 ? Number(rollover?.[category]) || 0 : 0;
    const limit = rawLimit && rawLimit > 0 ? rawLimit + carried : null;
    const spent = monthlyStats.byCategory[category] || 0;
    const status = getBudgetStatus(spent, limit || 0);
    if (limit !== null) {
      totalLimit += limit;
      totalSpent += spent;
    }
    return {
      category, limit, spent, carried, hasLimit: limit !== null,
      percent: limit ? status.percent : 0,
      remaining: limit ? status.remaining : null,
      isOver: limit ? status.isOver : false
    };
  });

  // Limited categories first (most used first), then unlimited by spending.
  items.sort((a, b) => {
    if (a.hasLimit !== b.hasLimit) return a.hasLimit ? -1 : 1;
    return a.hasLimit ? b.percent - a.percent : b.spent - a.spent;
  });

  const limited = items.filter((item) => item.hasLimit);
  // Spending without a limit is not part of the totals, so it is listed separately.
  const unbudgeted = items.filter((item) => !item.hasLimit && item.spent > 0);
  const hasAnyLimit = limited.length > 0;
  const remaining = totalLimit - totalSpent;
  const usedRaw = hasAnyLimit && totalLimit > 0 ? (totalSpent * 100) / totalLimit : 0;
  return {
    limited,
    unbudgeted,
    unbudgetedTotal: unbudgeted.reduce((sum, item) => sum + item.spent, 0),
    totalLimit,
    totalCarried: limited.reduce((sum, item) => sum + item.carried, 0),
    totalSpent,
    totalExpense: monthlyStats.totalExpense,
    hasAnyLimit,
    remaining,
    isOver: hasAnyLimit && remaining < 0,
    usedRaw,
    usedPercent: Math.round(usedRaw),
    overCount: limited.filter((item) => item.isOver).length
  };
}
