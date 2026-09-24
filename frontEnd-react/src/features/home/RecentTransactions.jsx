import React from 'react';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useToastStore } from '../../stores/useToastStore';
import { EmptyState } from '../../components/ui/EmptyState';
import { CategoryOutlineIcon, ArrowUpRightOutlineIcon } from '../../utils/categoryIcons';
import { formatCurrency, formatRelativeDate } from '../../utils/formatters';
import { useTranslation } from '../../i18n/useTranslation';

export const RecentTransactions = React.memo(function RecentTransactions() {
  const { t, label, intlLocale } = useTranslation();
  const transactions = useTransactionStore((s) => s.transactions);
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction);
  const undoDeleteTransaction = useTransactionStore((s) => s.undoDeleteTransaction);
  const openEditTransaction = useTransactionStore((s) => s.openEditTransaction);

  const wallets = useWalletStore((s) => s.wallets);
  const openAddTxnModal = useSpendingStore((s) => s.openAddTxnModal);
  const confirm = useConfirmStore((s) => s.confirm);
  const addToast = useToastStore((s) => s.addToast);
  const [deletingTxnId, setDeletingTxnId] = React.useState(null);

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

  // Take the most recent 25 transactions for smooth internal scrolling
  const recentList = React.useMemo(() => {
    return [...transactions]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 25);
  }, [transactions]);

  // Delete transaction with safe confirmation dialog & undo toast
  const handleDelete = (e, txn) => {
    e.stopPropagation();
    if (txn.systemGenerated || txn.jarId || txn.installmentId) return;
    const isIncome = txn.type === 'income';
    const typeLabel = t(isIncome ? 'type.income' : 'type.expense').toLocaleLowerCase(intlLocale);
    confirm({
      title: t('home.deleteTitle'),
      message: t('home.deleteMessage', { type: typeLabel, name: txn.desc || label(txn.category), amount: formatCurrency(txn.amount) }),
      confirmText: t('home.deleteTitle'),
      cancelText: t('home.keep'),
      confirmVariant: 'danger',
      onConfirm: async () => {
        setDeletingTxnId(txn.id);
        try {
          await deleteTransaction(txn.id);
          addToast({
            type: 'info',
            message: t('home.deleted', { name: txn.desc || label(txn.category) }),
            action: { label: t('transaction.undo'), onClick: () => undoDeleteTransaction(txn) },
            duration: 5000,
          });
        } finally {
          setDeletingTxnId(null);
        }
      },
    });
  };

  const handleEdit = (e, txn) => {
    e.stopPropagation();
    if (txn.systemGenerated || txn.jarId || txn.installmentId) return;
    openEditTransaction(txn);
  };

  return (
    <section className="home-recent-txns-section" aria-label={t('home.recent')}>
      {/* Section Header */}
      <div className="home-txns-header-row">
        <h2 className="home-txns-title">{t('home.recent')}</h2>
        <span className="home-txns-subtitle">{t('date.today')}</span>
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
              const isLocked = Boolean(txn.systemGenerated || txn.jarId || txn.installmentId);
              
              const walletName = txn.walletId && walletMap[txn.walletId]
                ? walletMap[txn.walletId].name
                : (txn.toWalletId && walletMap[txn.toWalletId]
                  ? walletMap[txn.toWalletId].name
                  : (isTransfer ? t('type.transfer') : t('home.cash')));
              
              const relativeDate = formatRelativeDate(txn.date);
              const metaText = `${label(txn.category || 'Other Expense')} · ${walletName} · ${relativeDate}`;

              return (
                <div
                  key={txn.id || index}
                  className={`home-txn-row ${deletingTxnId === txn.id ? 'is-deleting' : ''}`}
                  onClick={isLocked || deletingTxnId === txn.id ? undefined : () => openEditTransaction(txn)}
                  role={isLocked ? undefined : 'button'}
                  tabIndex={isLocked || deletingTxnId === txn.id ? undefined : 0}
                  onKeyDown={isLocked || deletingTxnId === txn.id ? undefined : (e) => e.key === 'Enter' && openEditTransaction(txn)}
                  aria-label={t('home.transactionAria', { name: txn.desc || label(txn.category), amount: formatCurrency(txn.amount) })}
                >
                  {/* Left Icon */}
                  <div className={`home-txn-icon-box ${isIncome ? 'is-income' : ''} ${isTransfer ? 'is-transfer' : ''}`} aria-hidden="true">
                    <CategoryOutlineIcon name={isTransfer ? 'transfer' : txn.category} size={18} />
                  </div>

                  {/* Middle Content */}
                  <div className="home-txn-info">
                    <span className="home-txn-name" title={txn.desc || txn.category}>
                      {txn.desc || label(txn.category)}
                    </span>
                    <span className="home-txn-meta">
                      {metaText}
                    </span>
                  </div>

                  {/* Right Amount & Actions */}
                  <div className="home-txn-amount-box">
                    <span className={`home-txn-amount ${isIncome ? 'is-income' : isTransfer ? 'is-transfer' : 'is-expense'}`}>
                      {isIncome ? `+${formatCurrency(txn.amount)}` : isTransfer ? `⇄ ${formatCurrency(txn.amount)}` : `−${formatCurrency(txn.amount)}`}
                    </span>
                    
                    {/* Actions */}
                    {isLocked ? (
                      <span
                        className="home-txn-locked-hint"
                        title={t(txn.jarId ? 'home.jarLocked' : 'home.recurringLocked')}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <span>{t(txn.jarId ? 'nav.jarShort' : 'nav.recurring')}</span>
                      </span>
                    ) : (
                      <div className="home-txn-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="home-txn-btn-action"
                          onClick={(e) => handleEdit(e, txn)}
                          title={t('transaction.edit')}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="home-txn-btn-action home-txn-btn-action--delete"
                          onClick={(e) => handleDelete(e, txn)}
                          title={t('home.deleteTitle')}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
});
