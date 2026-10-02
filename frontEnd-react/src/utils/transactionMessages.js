import { formatCurrency, formatDate } from './formatters.js';
import { transactionEditImpact } from './transactionEditing.js';

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
