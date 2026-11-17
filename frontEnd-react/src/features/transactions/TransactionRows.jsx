import React from 'react';
import { useWalletStore } from '../../stores/useWalletStore';
import { useTranslation } from '../../i18n/useTranslation';
import { formatCurrency, formatDate, formatRelativeDate } from '../../utils/formatters';
import { transactionTotal } from '../../utils/transactionInsights';
import { CategoryOutlineIcon, Icon } from '../../components/ui/AppIcons';
import { WalletOutlineIcon } from '../../components/ui/WalletOutlineIcon';
import { TransactionItem } from './TransactionItem';

export function TransactionRows({ transactions, onEdit, onManage, showDate = false, variant = 'cards', emptyState = null }) {
  const { t, label, lang } = useTranslation();
  const wallets = useWalletStore((state) => state.wallets);
  const archivedWallets = useWalletStore((state) => state.archivedWallets);
  const walletNames = new Map([...wallets, ...archivedWallets].map((wallet) => [wallet.id, wallet.name]));

  if (transactions.length === 0) return <div className={variant === 'ledger' ? 'transaction-ledger-table' : undefined}>
    {emptyState || <p className="transaction-inspection-empty">{t('history.empty')}</p>}
  </div>;

  if (variant === 'ledger') return <LedgerDays transactions={transactions} onEdit={onEdit} onManage={onManage} walletNames={walletNames} />;

  return <div className="transaction-inspection-list">
    {transactions.map((transaction) => {
      const isWalletCreation = transaction.type === 'wallet_created';
      const locked = Boolean(isWalletCreation || transaction.systemGenerated || transaction.jarId || transaction.installmentId);
      const source = transaction.jarId ? 'jars' : transaction.installmentId ? 'recurring' : null;
      const action = locked ? (source && onManage ? () => onManage(source) : null) : () => onEdit(transaction);
      const amount = transaction.type === 'expense' ? transactionTotal(transaction) : Number(transaction.amount) || 0;
      const walletName = walletNames.get(transaction.walletId) || transaction.walletName || t('home.cash');
      const description = transaction.desc || label(transaction.category);
      const categoryIcon = <span className={`transaction-inspection-icon is-${transaction.type}`} aria-hidden="true">
        {isWalletCreation ? <WalletOutlineIcon size={19} />
          : <CategoryOutlineIcon name={transaction.category || transaction.type} size={19} />}
      </span>;
      const walletBadge = <span className="transaction-inspection-wallet">
        <Icon name="walletAlt" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />{walletName}
      </span>;
      const amountLabel = isWalletCreation ? <span className="transaction-inspection-amount">
        <small>{t('history.openingBalance')}</small>{' '}
        <strong>{formatCurrency(transaction.initialBalance)}</strong>
      </span> : <strong className={`transaction-inspection-amount is-${transaction.type}`}>
        {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '−' : '↔ '}{formatCurrency(amount)}
      </strong>;
      const content = <>
        {categoryIcon}
        <span className="transaction-inspection-main">
          <strong>{description}</strong>
          <span className="transaction-inspection-meta">
            <span>{label(transaction.category)}</span>
            {showDate && <time dateTime={transaction.date}>{formatDate(transaction.date, 'short', { locale: lang })}</time>}
          </span>
          {walletBadge}
          {Number(transaction.fee) > 0 && <small>{t('history.fee', { amount: formatCurrency(transaction.fee) })}</small>}
          {locked && !isWalletCreation && <small>{t(transaction.jarId ? 'history.lockedJar'
            : transaction.installmentId ? 'history.lockedRecurring' : 'history.lockedGeneric')}</small>}
        </span>
        {amountLabel}
      </>;
      const className = 'transaction-inspection-row';
      return action
        ? <button type="button" className={className} key={transaction.id} onClick={action}>{content}</button>
        : <div className={className} key={transaction.id}>{content}</div>;
    })}
  </div>;
}

/** History: transactions grouped by day, each day with its net total, built on the shared row. */
function LedgerDays({ transactions, onEdit, onManage, walletNames }) {
  const { t, label, lang } = useTranslation();
  const groups = [];
  for (const transaction of transactions) {
    const last = groups[groups.length - 1];
    if (last && last.date === transaction.date) last.rows.push(transaction);
    else groups.push({ date: transaction.date, rows: [transaction] });
  }
  const signed = (value) => `${value < 0 ? '−' : value > 0 ? '+' : ''}${formatCurrency(Math.abs(value))}`;
  const netOf = (rows) => rows.reduce((sum, row) => (row.type === 'income' ? sum + (Number(row.amount) || 0)
    : row.type === 'expense' ? sum - transactionTotal(row) : sum), 0);

  return <div className="transaction-ledger-table">
    {groups.map((group) => {
      const relative = formatRelativeDate(group.date, { locale: lang });
      const short = formatDate(group.date, 'short', { locale: lang });
      return <section className="txn-day" key={group.date} aria-label={relative === short ? short : `${relative}, ${short}`}>
        <h2 className="txn-day__header">
          <span><time dateTime={group.date}>{relative === short ? short : <><span>{relative}</span><span aria-hidden="true"> · </span><span>{short}</span></>}</time></span>
          <span className="txn-day__total">{signed(netOf(group.rows))}</span>
        </h2>
        {group.rows.map((transaction) => {
          const isWalletCreation = transaction.type === 'wallet_created';
          const locked = Boolean(isWalletCreation || transaction.systemGenerated || transaction.jarId || transaction.installmentId);
          const source = transaction.jarId ? 'jars' : transaction.installmentId ? 'recurring' : null;
          const action = locked ? (source && onManage ? () => onManage(source) : null) : () => onEdit(transaction);
          const amount = transaction.type === 'expense' ? transactionTotal(transaction) : Number(transaction.amount) || 0;
          const walletName = walletNames.get(transaction.walletId) || transaction.walletName || t('home.cash');
          const toName = transaction.toWalletId ? walletNames.get(transaction.toWalletId) : null;
          const tone = isWalletCreation ? 'neutral' : transaction.type;
          const lockedNote = locked && !isWalletCreation && t(transaction.jarId ? 'history.lockedJar'
            : transaction.installmentId ? 'history.lockedRecurring' : 'history.lockedGeneric');
          return <TransactionItem
            key={transaction.id}
            className="transaction-ledger-row"
            tone={tone}
            icon={isWalletCreation ? <WalletOutlineIcon size={19} /> : undefined}
            markName={transaction.category || transaction.type}
            title={transaction.desc || label(transaction.category)}
            meta={[label(transaction.category), toName ? `${walletName} → ${toName}` : walletName]}
            extra={<>
              {Number(transaction.fee) > 0 && <small className="txn-item__note">{t('history.fee', { amount: formatCurrency(transaction.fee) })}</small>}
              {lockedNote && <small className="txn-item__note">{lockedNote}</small>}
            </>}
            amount={isWalletCreation
              ? <span className="txn-item__amount"><small>{t('history.openingBalance')}</small><strong>{formatCurrency(transaction.initialBalance)}</strong></span>
              : <strong className={`txn-item__amount is-${transaction.type}`}>
                {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '−' : '↔ '}{formatCurrency(amount)}
              </strong>}
            onOpen={action || undefined}
          />;
        })}
      </section>;
    })}
  </div>;
}
