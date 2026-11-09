import { formatCurrency, formatDate } from './formatters.js';
import { requiresHistoricalConfirmation, transactionEditImpact } from './transactionEditing.js';

/** Body of the delete confirmation: what is removed, then any previous-month impact. */
export function deleteConfirmMessage(transaction, { t, label, wallets, locale, intlLocale, currentMonth }) {
  const walletName = (id) => (id ? wallets.find((wallet) => wallet.id === id)?.name : null);
  const walletText = transaction.type === 'transfer'
    ? [walletName(transaction.walletId), walletName(transaction.toWalletId)].filter(Boolean).join(' → ')
    : walletName(transaction.walletId) || walletName(transaction.toWalletId);
  const details = [
    transaction.date ? formatDate(transaction.date, 'compact', { locale }) : null,
    walletText,
    Number(transaction.fee) > 0 ? t('history.fee', { amount: formatCurrency(transaction.fee) }) : null
  ].filter(Boolean).join(' · ');
  const summary = [t('home.deleteMessage', {
    type: t(`type.${transaction.type}`).toLocaleLowerCase(intlLocale),
    name: transaction.desc || label(transaction.category),
    amount: formatCurrency(transaction.amount)
  }), details].filter(Boolean).join('\n');
  return requiresHistoricalConfirmation(transaction, null, currentMonth)
    ? `${summary}\n\n${historicalImpactMessage(transaction, null, { t, wallets, locale })}`
    : summary;
}

export function historicalImpactMessage(before, after, { t, wallets, locale }) {
  const impact = transactionEditImpact(before, after);
  const signed = (amount) => `${amount > 0n ? '+' : '−'}${formatCurrency(amount < 0n ? -amount : amount)}`;
  const lines = [t('transaction.historicalImpact', {
    months: impact.months.map(({ month }) => formatDate(`${month}-01`, 'month', { locale })).join(', ')
  })];
  for (const totals of impact.months) {
    const month = formatDate(`${totals.month}-01`, 'month', { locale });
    if (totals.income !== 0n) lines.push(t('transaction.monthIncomeImpact', { month, amount: signed(totals.income) }));
    if (totals.expense !== 0n) lines.push(t('transaction.monthExpenseImpact', { month, amount: signed(totals.expense) }));
  }
  for (const { id, delta } of impact.wallets) {
    lines.push(t('transaction.walletImpact', {
      wallet: wallets.find((wallet) => wallet.id === id)?.name || t('history.filterWallet'), amount: signed(delta)
    }));
  }
  if (before) lines.push(t('transaction.changeRecorded'));
  return lines.join('\n\n');
}
