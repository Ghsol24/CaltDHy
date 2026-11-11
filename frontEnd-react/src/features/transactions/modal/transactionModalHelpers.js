import React from 'react';

export function describeBudgetMetrics(metrics, t) {
  for (const metric of Object.values(metrics)) {
    metric.color = metric.hasLimit ? `var(--color-${metric.status})` : 'var(--color-neutral-bg)';
    metric.statusLabel = !metric.hasLimit ? t('transaction.limitUnset') : metric.rawRemaining <= 0n
      ? t('transaction.limitReached') : t('transaction.limitLeft', { percent: metric.percent });
  }
  return metrics;
}

/** The category of the newest hand-entered transaction of this type (the list arrives newest first). */
export function recentCategoryName(transactions, type, categories) {
  const names = new Map(categories.map((cat) => [cat.name.toLowerCase(), cat.name]));
  let best = null;
  for (const txn of transactions || []) {
    if (txn.type !== type || txn.installmentId || txn.jarId || !txn.category) continue;
    const name = names.get(String(txn.category).toLowerCase());
    if (name && (!best || txn.date > best.date)) best = { date: txn.date, name };
  }
  return best?.name || '';
}
