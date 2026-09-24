export function isRecurringTrendTransaction(transaction) {
  if (!transaction) return false;
  if (transaction.installmentId) return true;
  return /^Thanh toán định kỳ:/iu.test(String(transaction.desc || '').trim());
}

export function filterTrendTransactions(transactions, excludeRecurring) {
  const source = Array.isArray(transactions) ? transactions : [];
  return excludeRecurring
    ? source.filter((transaction) => !isRecurringTrendTransaction(transaction))
    : source;
}

export function summarizeRecurringExpenses(transactions, monthPrefixes) {
  const prefixes = Array.isArray(monthPrefixes) ? monthPrefixes : [];
  return (Array.isArray(transactions) ? transactions : []).reduce((summary, transaction) => {
    if (transaction.type !== 'expense' || !isRecurringTrendTransaction(transaction)) return summary;
    if (prefixes.length > 0 && !prefixes.some((prefix) => transaction.date?.startsWith(prefix))) return summary;
    summary.count += 1;
    summary.amount += (Number(transaction.amount) || 0) + (Number(transaction.fee) || 0);
    return summary;
  }, { count: 0, amount: 0 });
}
