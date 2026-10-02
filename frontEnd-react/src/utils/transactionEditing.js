import { moneyInteger, moneyNumber } from './moneyPrecision.js';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const FINANCIAL_FIELDS = ['type', 'amount', 'category', 'walletId', 'toWalletId', 'date', 'fee'];
const comparable = (transaction, field) => field === 'amount' || field === 'fee'
  ? moneyInteger(transaction?.[field] ?? 0)
  : (transaction?.[field] ?? '');

export function transactionMonth(transaction) {
  const month = transaction?.date?.slice(0, 7) || '';
  return MONTH_PATTERN.test(month) ? month : '';
}

export function requiresHistoricalConfirmation(before, after, currentMonth) {
  if (!MONTH_PATTERN.test(currentMonth)) return false;
  const changesMoney = !before || !after || FINANCIAL_FIELDS.some((field) =>
    comparable(before, field) !== comparable(after, field));
  return changesMoney && [transactionMonth(before), transactionMonth(after)]
    .some((month) => month && month < currentMonth);
}

// Reverse the old entry and apply the new one, using the same fee semantics as financeMath.
export function transactionEditImpact(before, after) {
  const months = new Map();
  const wallets = new Map();
  const addWallet = (id, delta) => {
    if (id) wallets.set(id, (wallets.get(id) || 0n) + delta);
  };
  for (const [transaction, sign] of [[before, -1n], [after, 1n]]) {
    if (!transaction) continue;
    const amount = moneyInteger(transaction.amount ?? 0) * sign;
    const fee = moneyInteger(transaction.fee ?? 0) * sign;
    const month = transactionMonth(transaction);
    if (month) {
      const totals = months.get(month) || { income: 0n, expense: 0n };
      if (transaction.type === 'income') totals.income += amount;
      if (transaction.type === 'expense') totals.expense += amount + fee;
      months.set(month, totals);
    }
    if (transaction.type === 'income') addWallet(transaction.walletId, amount);
    if (transaction.type === 'expense' || transaction.type === 'transfer') {
      addWallet(transaction.walletId, -(amount + fee));
    }
    if (transaction.type === 'transfer') addWallet(transaction.toWalletId, amount);
  }
  return {
    months: [...months].sort(([a], [b]) => a.localeCompare(b))
      .map(([month, totals]) => ({ month, income: totals.income, expense: totals.expense })),
    wallets: [...wallets].filter(([, delta]) => delta !== 0n).map(([id, delta]) => ({ id, delta }))
  };
}

export function previewCategoryBudgets({ transactions, budgets, categories, month, editingId, draft }) {
  const spent = Object.create(null);
  const addExpense = (transaction) => {
    if (transaction.type !== 'expense' || transactionMonth(transaction) !== month) return;
    spent[transaction.category] = (spent[transaction.category] || 0n)
      + moneyInteger(transaction.amount ?? 0) + moneyInteger(transaction.fee ?? 0);
  };
  transactions.forEach((transaction) => { if (!editingId || transaction.id !== editingId) addExpense(transaction); });
  if (draft && Number.isSafeInteger(draft.amount) && draft.amount > 0) addExpense(draft);
  const metrics = Object.create(null);
  categories.forEach(({ name }) => {
    const limit = budgets[name] > 0 ? moneyInteger(budgets[name]) : null;
    const used = spent[name] || 0n;
    const remaining = limit === null ? 0n : limit - used;
    const percent = limit === null ? 0 : Number((remaining * 100n + limit / 2n) / limit);
    metrics[name] = {
      hasLimit: limit !== null,
      remaining: moneyNumber(remaining > 0n ? remaining : 0n),
      rawRemaining: remaining,
      percent: Math.max(0, Math.min(100, percent)),
      status: limit === null ? 'unset' : remaining <= 0n || percent < 15 ? 'danger'
        : percent <= 60 ? 'warning' : 'success'
    };
  });
  return metrics;
}
