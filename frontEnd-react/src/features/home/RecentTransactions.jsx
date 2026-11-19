import React from 'react';
import { TransactionItem } from '../transactions/TransactionItem';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { EmptyState } from '../../components/ui/EmptyState';
import { ArrowUpRightOutlineIcon } from '../../utils/categoryIcons';
import { formatCurrency, formatRelativeDate } from '../../utils/formatters';
import { isLockedTransaction, useDeleteTransaction } from '../transactions/useDeleteTransaction';
import { useTranslation } from '../../i18n/useTranslation';

import { Icon } from '../../components/ui/AppIcons';
export const RecentTransactions = React.memo(function RecentTransactions() {
  const { t, label } = useTranslation();
  const transactions = useTransactionStore((s) => s.transactions);
  const openEditTransaction = useTransactionStore((s) => s.openEditTransaction);
  const requestDelete = useDeleteTransaction();

  const wallets = useWalletStore((s) => s.wallets);
  const openAddTxnModal = useSpendingStore((s) => s.openAddTxnModal);
  const navigateTo = useSpendingStore((s) => s.navigateTo);
  const confirm = useConfirmStore((s) => s.confirm);

  // Create a map of walletId -> wallet object
  const walletMap = React.useMemo(() => {
    const map = {};
    wallets.forEach((w) => {
      if (w && w.id) {
        map[w.id] = w;
      }
    });
    return map;
  }, [wallets]);

  // Keep the dashboard glanceable; the full ledger lives in History.
  const recentList = React.useMemo(() => {
    return [...transactions]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 5);
  }, [transactions]);

  // Same confirm → delete → undo flow as the edit dialog.
  const handleDelete = (e, txn) => {
    e.stopPropagation();
    void requestDelete(txn);
  };

  const handleEdit = (e, txn) => {
    e.stopPropagation();
    if (isLockedTransaction(txn)) return;
    openEditTransaction(txn);
  };

  // A locked row explains why it cannot be edited here and offers the screen that can.
  const openLockedSource = (txn) => {
    const isJar = Boolean(txn.jarId);
    const key = isJar ? 'Jar' : 'Recurring';
    void confirm({
      title: t(`home.locked${key}Title`),
      message: t(`home.locked${key}Body`),
      confirmText: t(`home.locked${key}Action`),
      cancelText: t('common.close'),
      confirmVariant: 'info',
      onConfirm: () => (isJar ? navigateTo('jars', 'history') : navigateTo('plan', 'recurring')),
    });
  };

  return (
    <section className="home-recent-txns-section" aria-label={t('home.recent')}>
      {/* Section Header */}
      <div className="home-txns-header-row">
        <h2 className="home-txns-title">{t('home.recent')}</h2>
        <button type="button" className="home-txns-view-all-btn"
          onClick={() => navigateTo('analytics', 'transactions')}>
          <span>{t('home.viewAll')}</span>
          <Icon name="arrowRight" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
        </button>
      </div>

      {/* Transaction List Card Container */}
      <div className="home-txns-card-container">
        {recentList.length === 0 ? (
          <EmptyState
            icon={<ArrowUpRightOutlineIcon size={32} color="var(--color-text-muted, #94A3B8)" />}
            title={t('home.noRecent')}
            description={t('home.noRecentHint')}
            actionLabel={t('nav.addTransaction')}
            onAction={openAddTxnModal}
          />
        ) : (
          <div className="home-txns-list">
            {recentList.map((txn, index) => {
              const isIncome = txn.type === 'income';
              const isTransfer = txn.type === 'transfer';
              const isLocked = isLockedTransaction(txn);
              
              const walletName = txn.walletId && walletMap[txn.walletId]
                ? walletMap[txn.walletId].name
                : (txn.toWalletId && walletMap[txn.toWalletId]
                  ? walletMap[txn.toWalletId].name
                  : (isTransfer ? t('type.transfer') : t('home.cash')));
              
              const amountText = isIncome ? `+${formatCurrency(txn.amount)}` : isTransfer ? `⇄ ${formatCurrency(txn.amount)}` : `−${formatCurrency(txn.amount)}`;
              const tone = isIncome ? 'income' : isTransfer ? 'transfer' : 'expense';

              return (
                <TransactionItem
                  key={txn.id || index}
                  markName={isTransfer ? 'transfer' : txn.category}
                  tone={tone}
                  title={txn.desc || label(txn.category)}
                  meta={[label(txn.category || 'Other Expense'), walletName, formatRelativeDate(txn.date)]}
                  amount={<span className={`txn-item__amount is-${tone}`}>{amountText}</span>}
                  onOpen={isLocked ? () => openLockedSource(txn) : () => openEditTransaction(txn)}
                  ariaLabel={t(isLocked ? 'home.lockedOpenAria' : 'home.transactionAria', { name: txn.desc || label(txn.category), amount: formatCurrency(txn.amount) })}
                  lockedHint={isLocked ? (
                    <span className="txn-item__locked" title={t(txn.jarId ? 'home.jarLocked' : 'home.recurringLocked')}>
                      <Icon name="lock" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <span>{t(txn.jarId ? 'nav.jarShort' : 'nav.recurring')}</span>
                    </span>
                  ) : undefined}
                  actions={isLocked ? undefined : (
                    <div className="txn-item__actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="txn-item__action" onClick={(e) => handleEdit(e, txn)}
                        title={t('transaction.edit')} aria-label={t('transaction.edit')}>
                        <Icon name="editSquare" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
                      </button>
                      <button type="button" className="txn-item__action txn-item__action--delete" onClick={(e) => handleDelete(e, txn)}
                        title={t('home.deleteTitle')} aria-label={t('home.deleteTitle')}>
                        <Icon name="trash" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </button>
                    </div>
                  )}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
});
