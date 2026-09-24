import React from 'react';
import { useWalletStore } from '../../stores/useWalletStore';
import { useTranslation } from '../../i18n/useTranslation';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { transactionTotal } from '../../utils/transactionInsights';
import { CategoryOutlineIcon } from '../../components/ui/AppIcons';

export function TransactionRows({ transactions, onEdit, onManage, showDate = false, variant = 'cards' }) {
  const { t, label, lang } = useTranslation();
  const wallets = useWalletStore((state) => state.wallets);
  const archivedWallets = useWalletStore((state) => state.archivedWallets);
  const walletNames = new Map([...wallets, ...archivedWallets].map((wallet) => [wallet.id, wallet.name]));

  if (transactions.length === 0) return <div className={variant === 'ledger' ? 'transaction-ledger-table' : undefined}>
    <p className="transaction-inspection-empty">{t('history.empty')}</p>
  </div>;

  return <div className={variant === 'ledger' ? 'transaction-ledger-table' : 'transaction-inspection-list'}>
    {variant === 'ledger' && <div className="transaction-ledger-head" aria-hidden="true">
      <span>{t('history.columnTransaction')}</span><span>{t('history.filterCategory')}</span>
      <span>{t('history.filterWallet')}</span><span>{t('history.columnDate')}</span>
      <span>{t('history.columnAmount')}</span>
    </div>}
    {transactions.map((transaction) => {
      const locked = Boolean(transaction.systemGenerated || transaction.jarId || transaction.installmentId);
      const source = transaction.jarId ? 'jars' : transaction.installmentId ? 'recurring' : null;
      const action = locked ? (source && onManage ? () => onManage(source) : null) : () => onEdit(transaction);
      const amount = transaction.type === 'expense' ? transactionTotal(transaction) : Number(transaction.amount) || 0;
      const walletName = walletNames.get(transaction.walletId) || t('home.cash');
      const description = transaction.desc || label(transaction.category);
      const categoryIcon = <span className={`transaction-inspection-icon is-${transaction.type}`} aria-hidden="true">
        <CategoryOutlineIcon name={transaction.category || transaction.type} size={19} />
      </span>;
      const walletBadge = <span className="transaction-inspection-wallet">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="5" width="20" height="16" rx="3" /><path d="M18 14h4M5 5V3h14" />
        </svg>{walletName}
      </span>;
      const amountLabel = <strong className={`transaction-inspection-amount is-${transaction.type}`}>
        {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '−' : '↔ '}{formatCurrency(amount)}
      </strong>;
      const content = variant === 'ledger' ? <>
        <span className="transaction-ledger-identity">
          {categoryIcon}
          <span className="transaction-ledger-main">
            <strong>{description}</strong>
            {Number(transaction.fee) > 0 && <small>{t('history.fee', { amount: formatCurrency(transaction.fee) })}</small>}
            {locked && <small>{t(transaction.jarId ? 'history.lockedJar'
              : transaction.installmentId ? 'history.lockedRecurring' : 'history.lockedGeneric')}</small>}
          </span>
        </span>
        <span className="transaction-ledger-category">{label(transaction.category)}</span>
        {walletBadge}
        <time dateTime={transaction.date} className="transaction-ledger-date">
          {formatDate(transaction.date, 'compact', { locale: lang })}
        </time>
        {amountLabel}
      </> : <>
        {categoryIcon}
        <span className="transaction-inspection-main">
          <strong>{description}</strong>
          <span className="transaction-inspection-meta">
            <span>{label(transaction.category)}</span>
            {showDate && <time dateTime={transaction.date}>{formatDate(transaction.date, 'short', { locale: lang })}</time>}
          </span>
          {walletBadge}
          {Number(transaction.fee) > 0 && <small>{t('history.fee', { amount: formatCurrency(transaction.fee) })}</small>}
          {locked && <small>{t(transaction.jarId ? 'history.lockedJar'
            : transaction.installmentId ? 'history.lockedRecurring' : 'history.lockedGeneric')}</small>}
        </span>
        {amountLabel}
      </>;
      const className = `transaction-inspection-row${variant === 'ledger' ? ' transaction-ledger-row' : ''}`;
      return action
        ? <button type="button" className={className} key={transaction.id} onClick={action}>{content}</button>
        : <div className={className} key={transaction.id}>{content}</div>;
    })}
  </div>;
}
