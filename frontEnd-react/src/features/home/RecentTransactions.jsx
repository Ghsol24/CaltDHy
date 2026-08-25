import React from 'react';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useToastStore } from '../../stores/useToastStore';
import { EmptyState } from '../../components/ui/EmptyState';
import { getCategoryIcon } from '../../utils/categories';
import { formatCurrency, formatRelativeDate } from '../../utils/formatters';

export function RecentTransactions() {
  const {
    transactions,
    deleteTransaction,
    undoDeleteTransaction,
    openEditTransaction
  } = useTransactionStore();

  const { wallets } = useWalletStore();
  const { openAddTxnModal } = useSpendingStore();
  const { confirm } = useConfirmStore();
  const { addToast } = useToastStore();

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
  const handleDelete = async (e, txn) => {
    e.stopPropagation();
    const isIncome = txn.type === 'income';
    const typeLabel = isIncome ? 'khoản thu' : 'khoản chi';
    const confirmed = await confirm({
      title: 'Xóa giao dịch',
      message: `Bạn có chắc chắn muốn xóa ${typeLabel} "${txn.desc || txn.category}" trị giá ${formatCurrency(txn.amount)}?`,
      confirmText: 'Xóa giao dịch',
      cancelText: 'Giữ lại',
      confirmVariant: 'danger'
    });

    if (confirmed) {
      await deleteTransaction(txn.id);
      addToast({
        type: 'info',
        message: `Đã xóa giao dịch ${txn.desc || txn.category}.`,
        action: {
          label: 'Hoàn tác',
          onClick: () => undoDeleteTransaction(txn)
        },
        duration: 5000
      });
    }
  };

  const handleEdit = (e, txn) => {
    e.stopPropagation();
    openEditTransaction(txn);
  };

  return (
    <section className="home-recent-txns-section" aria-label="Giao dịch gần đây">
      {/* Section Header */}
      <div className="home-txns-header-row">
        <h2 className="home-txns-title">Giao dịch gần đây</h2>
        <span className="home-txns-subtitle">Hôm nay</span>
      </div>

      {/* Transaction List Card Container */}
      <div className="home-txns-card-container">
        {recentList.length === 0 ? (
          <EmptyState
            icon="💸"
            title="Chưa có giao dịch gần đây"
            description="Hãy ghi lại khoản chi tiêu hoặc thu nhập đầu tiên của bạn."
            actionText="+ Thêm giao dịch"
            onAction={openAddTxnModal}
          />
        ) : (
          <div className="home-txns-list">
            {recentList.map((txn, index) => {
              const isIncome = txn.type === 'income';
              const isTransfer = txn.type === 'transfer';
              const icon = isTransfer ? '⇄' : getCategoryIcon(txn.category, txn.type);
              
              const walletName = txn.walletId && walletMap[txn.walletId]
                ? walletMap[txn.walletId].name
                : (isTransfer ? 'Chuyển tiền' : 'Tiền mặt');
              
              const relativeDate = formatRelativeDate(txn.date);
              const metaText = `${txn.category || 'Chi tiêu'} · ${walletName} · ${relativeDate}`;

              return (
                <div
                  key={txn.id || index}
                  className="home-txn-row"
                  onClick={() => openEditTransaction(txn)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && openEditTransaction(txn)}
                  aria-label={`Giao dịch ${txn.desc || txn.category}, ${formatCurrency(txn.amount)}`}
                >
                  {/* Left Icon */}
                  <div className={`home-txn-icon-box ${isIncome ? 'is-income' : ''} ${isTransfer ? 'is-transfer' : ''}`} aria-hidden="true">
                    <span>{icon}</span>
                  </div>

                  {/* Middle Content */}
                  <div className="home-txn-info">
                    <span className="home-txn-name" title={txn.desc || txn.category}>
                      {txn.desc || txn.category}
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
                    <div className="home-txn-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="home-txn-btn-action"
                        onClick={(e) => handleEdit(e, txn)}
                        title="Chỉnh sửa giao dịch"
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
                        title="Xóa giao dịch"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
