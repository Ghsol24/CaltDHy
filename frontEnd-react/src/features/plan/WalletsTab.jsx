import React, { useState } from 'react';
import { useWalletStore } from '../../stores/useWalletStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useToastStore } from '../../stores/useToastStore';
import { WalletModal } from './WalletModal';
import { TransferModal } from './TransferModal';
import { formatCurrency } from '../../utils/formatters';
import { EmptyState } from '../../components/ui/EmptyState';

const WALLET_TYPE_LABELS = {
  cash: 'Tiền mặt',
  bank: 'Ngân hàng',
  credit: 'Thẻ tín dụng',
  'e-wallet': 'Ví điện tử'
};

export function WalletsTab() {
  const { wallets, deleteWallet, isLoading } = useWalletStore();
  const { confirm } = useConfirmStore();
  const { addToast } = useToastStore();

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFromWalletId, setTransferFromWalletId] = useState(null);

  // Calculate totals
  const totalBalance = wallets
    .filter((w) => !w.isExcludedFromTotal)
    .reduce((sum, w) => sum + (Number(w.currentBalance) || 0), 0);

  const allAssets = wallets.reduce(
    (sum, w) => sum + (Number(w.currentBalance) || 0),
    0
  );

  const handleCreateNew = () => {
    setEditingWallet(null);
    setIsWalletModalOpen(true);
  };

  const handleEdit = (wallet) => {
    setEditingWallet(wallet);
    setIsWalletModalOpen(true);
  };

  const handleTransfer = (walletId) => {
    setTransferFromWalletId(walletId);
    setIsTransferModalOpen(true);
  };

  const handleDelete = async (wallet) => {
    const confirmed = await confirm({
      title: 'Xóa ví / tài khoản',
      message: `Bạn có chắc chắn muốn xóa ví "${wallet.name}"? Các giao dịch liên quan sẽ được tự động chuyển sang ví mặc định.`,
      confirmText: 'Xóa ví',
      cancelText: 'Hủy',
      confirmVariant: 'danger'
    });

    if (confirmed) {
      try {
        await deleteWallet(wallet.id);
        addToast({
          type: 'success',
          message: `Đã xóa ví "${wallet.name}".`,
          duration: 4000
        });
      } catch (err) {
        addToast({
          type: 'error',
          message: err.message || 'Không thể xóa ví.',
          duration: 4000
        });
      }
    }
  };

  return (
    <div className="wallets-tab-container" role="region" aria-label="Quản lý ví và tài khoản">
      {/* Overview Stats Bar */}
      <div className="wallets-overview-bar">
        <div className="wallets-overview-stats">
          <div className="overview-stat-item">
            <span className="overview-stat-label">Tổng số dư khả dụng</span>
            <strong className="overview-stat-val text-primary">
              {formatCurrency(totalBalance)}
            </strong>
          </div>

          <div className="overview-stat-divider" aria-hidden="true" />

          <div className="overview-stat-item">
            <span className="overview-stat-label">Tổng tài sản (tất cả ví)</span>
            <strong className="overview-stat-val">
              {formatCurrency(allAssets)}
            </strong>
          </div>

          <div className="overview-stat-divider" aria-hidden="true" />

          <div className="overview-stat-item">
            <span className="overview-stat-label">Số lượng ví</span>
            <strong className="overview-stat-val">
              {wallets.length} ví
            </strong>
          </div>
        </div>

        <div className="wallets-overview-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => handleTransfer(null)}
            disabled={wallets.length < 2}
            title={wallets.length < 2 ? 'Cần ít nhất 2 ví để chuyển tiền' : 'Chuyển tiền giữa 2 ví'}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17 1l4 4-4 4" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <path d="M7 23l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <span>⇄ Chuyển tiền ví</span>
          </button>

          <button
            type="button"
            className="btn btn--primary"
            onClick={handleCreateNew}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Thêm ví mới</span>
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && wallets.length === 0 && (
        <div className="wallets-loading">
          <span className="spinner" style={{ width: 24, height: 24, marginBottom: 8 }} />
          <p>Đang tải danh sách ví...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && wallets.length === 0 && (
        <EmptyState
          icon={
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          }
          title="Chưa có ví hoặc tài khoản nào"
          description="Tạo các ví tiền mặt, tài khoản ngân hàng hoặc thẻ tín dụng để bắt đầu ghi nhận và theo dõi dòng tiền chính xác."
          actionLabel="+ Tạo ví đầu tiên"
          onAction={handleCreateNew}
        />
      )}

      {/* Wallets Card Grid */}
      {!isLoading && wallets.length > 0 && (
        <div className="wallets-cards-grid">
          {wallets.map((w) => {
            const isNegative = Number(w.currentBalance) < 0;
            const typeLabel = WALLET_TYPE_LABELS[w.type] || 'Ví tiền';

            return (
              <div
                key={w.id}
                className="wallet-item-card"
                style={{ '--wallet-accent-color': w.color || '#078A59' }}
              >
                {/* Accent Color Header Line */}
                <div
                  className="wallet-card-top-stripe"
                  style={{ backgroundColor: w.color || '#078A59' }}
                />

                <div className="wallet-card-inner">
                  {/* Head: Icon, Name, Type, Badges */}
                  <div className="wallet-card-header">
                    <div className="wallet-card-icon-title">
                      <div
                        className="wallet-card-icon-box"
                        style={{ backgroundColor: `${w.color || '#078A59'}15` }}
                      >
                        <span>{w.icon || '💳'}</span>
                      </div>
                      <div className="wallet-card-name-group">
                        <h4 className="wallet-card-name">{w.name}</h4>
                        <span className="wallet-card-type-tag">{typeLabel}</span>
                      </div>
                    </div>

                    <div className="wallet-card-badges">
                      {w.isDefault && (
                        <span className="wallet-badge wallet-badge--default" title="Ví mặc định khi ghi thu chi">
                          ★ Mặc định
                        </span>
                      )}
                      {w.isExcludedFromTotal && (
                        <span className="wallet-badge wallet-badge--excluded" title="Không cộng vào tổng tài sản chi tiêu">
                          ⊘ Không tính vào tổng
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body: Balance & Credit Limit */}
                  <div className="wallet-card-balance-box">
                    <span className="wallet-balance-label">Số dư hiện tại</span>
                    <div className={`wallet-balance-amount ${isNegative ? 'is-negative' : 'is-positive'}`}>
                      {formatCurrency(w.currentBalance ?? w.initialBalance ?? 0)}
                    </div>

                    {w.type === 'credit' && Number(w.creditLimit) > 0 && (
                      <div className="wallet-credit-limit-row">
                        <span>Hạn mức thẻ:</span>
                        <strong>{formatCurrency(w.creditLimit)}</strong>
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="wallet-card-footer">
                    <button
                      type="button"
                      className="wallet-action-btn wallet-action-btn--transfer"
                      onClick={() => handleTransfer(w.id)}
                      title="Chuyển tiền từ ví này"
                    >
                      <span>⇄ Chuyển</span>
                    </button>

                    <div className="wallet-footer-right-actions">
                      <button
                        type="button"
                        className="wallet-action-btn wallet-action-btn--edit"
                        onClick={() => handleEdit(w)}
                        title="Chỉnh sửa ví"
                        aria-label={`Chỉnh sửa ví ${w.name}`}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        className="wallet-action-btn wallet-action-btn--delete"
                        onClick={() => handleDelete(w)}
                        title="Xóa ví"
                        aria-label={`Xóa ví ${w.name}`}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Add / Edit Wallet */}
      {isWalletModalOpen && (
        <WalletModal
          isOpen={isWalletModalOpen}
          onClose={() => setIsWalletModalOpen(false)}
          walletToEdit={editingWallet}
        />
      )}

      {/* Modal Transfer Between Wallets */}
      {isTransferModalOpen && (
        <TransferModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          initialFromWalletId={transferFromWalletId}
        />
      )}
    </div>
  );
}
