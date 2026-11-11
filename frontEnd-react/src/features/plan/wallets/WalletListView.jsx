import React from 'react';
import { WALLET_TYPE_LABELS } from './walletLabels';
import { WalletOutlineIcon } from '../../../components/ui/WalletOutlineIcon';
import { Icon, StarOutlineIcon } from '../../../components/ui/AppIcons';
import { formatCurrency } from '../../../utils/formatters';
import { IconButton } from '../../../components/ui/Button';

export function WalletListView({ deletingWalletId, filteredWallets, handleArchive, handleDelete, handleEdit, handleTransfer, menuRef, menuTriggerRef, openAddTxnModal, openMenuWalletId, setOpenMenuWalletId, viewMode, walletTxCountMap }) {
  return (filteredWallets.length > 0 && viewMode === 'list' && (
    <div className="wallets-horizontal-list">
      {filteredWallets.map((w) => {
        const isNegative = Number(w.currentBalance) < 0;
        const typeLabel = WALLET_TYPE_LABELS[w.type] || 'Ví tiền mặt';
        const accentColor = w.color || '#10B981';
        const txCount = walletTxCountMap[w.id] || 0;
        const isMenuOpen = openMenuWalletId === w.id;
        return (
          <div
            key={w.id}
            className={`wallet-h-card ${deletingWalletId === w.id ? 'is-deleting' : ''} wallet-h-card--tone`}
            style={{ '--wallet-h-card-border-left-color': accentColor }}
          >
            {/* Icon Pastel Container with OUTLINE SVG */}
            <div
              className="wallet-h-icon-container"
              style={{ '--wallet-accent': accentColor }}
            >
              <WalletOutlineIcon type={w.type} size={22} color={accentColor} />
            </div>
  
            {/* Info: Name, Type, Badges, Meta */}
            <div className="wallet-h-info-col">
              <div className="wallet-h-title-row">
                <h4 className="wallet-h-name" title={w.name}>
                  {w.name}
                </h4>
                {w.isDefault && (
                  <span className="wallet-badge-default-pill wallet-badge-default-pill--layout">
                    <StarOutlineIcon size={11} />
                    <span>Mặc định</span>
                  </span>
                )}
                {w.isExcludedFromTotal && (
                  <span className="wallet-badge-excluded-pill">
                    ⊘ Không tính vào tổng
                  </span>
                )}
              </div>
  
              <span className="wallet-h-type-text">{typeLabel}</span>
  
              <div className="wallet-h-meta-row">
                <span className="wallet-h-meta-date">Cập nhật: Hôm nay</span>
                <span className="meta-bullet">•</span>
                <span className="wallet-h-meta-txns">
                  <Icon name="clock" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <span>{txCount} giao dịch</span>
                </span>
              </div>
            </div>
  
            {/* Right: Balance + 3-dots Menu */}
            <div className="wallet-h-balance-col">
              <span className="wallet-h-balance-label">Số dư hiện tại</span>
              <strong className={`wallet-h-balance-val ${isNegative ? 'text-danger' : 'text-brand'}`}>
                {formatCurrency(w.currentBalance ?? w.initialBalance ?? 0)}
              </strong>
            </div>
  
            {/* 3-Dots Action Menu */}
            <div className="wallet-h-action-col" ref={isMenuOpen ? menuRef : null}>
              <IconButton
                className="wallet-dots-btn"
                label={`Tùy chọn ví ${w.name}`}
                onClick={(e) => { menuTriggerRef.current = e.currentTarget; setOpenMenuWalletId(isMenuOpen ? null : w.id); }}
                aria-expanded={isMenuOpen}
              >
                <Icon name="moreVertical" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </IconButton>
  
              {isMenuOpen && (
                <div className="wallet-actions-popover" role="menu">
                  <button
                    type="button"
                    className="wallet-popover-action"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenuWalletId(null);
                      openAddTxnModal({
                        type: 'income',
                        title: `Nạp tiền vào ${w.name}`,
                        walletId: w.id
                      });
                    }}
                  >
                    <Icon name="arrowDown" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <span>Nạp tiền vào ví</span>
                  </button>
  
                  <button
                    type="button"
                    className="wallet-popover-action"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenuWalletId(null);
                      openAddTxnModal({
                        type: 'expense',
                        title: `Rút tiền từ ${w.name}`,
                        walletId: w.id
                      });
                    }}
                  >
                    <Icon name="arrowUp" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <span>Rút tiền từ ví</span>
                  </button>
  
                  <button
                    type="button"
                    className="wallet-popover-action"
                    role="menuitem"
                    onClick={() => handleTransfer(w.id)}
                  >
                    <Icon name="transfer" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <span>Chuyển tiền từ ví này</span>
                  </button>
  
                  <button
                    type="button"
                    className="wallet-popover-action"
                    role="menuitem"
                    onClick={() => handleEdit(w)}
                  >
                    <Icon name="pencil" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <span>Chỉnh sửa ví</span>
                  </button>
  
                  <div className="wallet-popover-divider" aria-hidden="true" />
  
                  <button
                    type="button"
                    className="wallet-popover-action wallet-popover-action--tone"
                   
                    role="menuitem"
                    onClick={() => handleArchive(w)}
                  >
                    <Icon name="archive" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <span>Lưu trữ / Đóng ví</span>
                  </button>
  
                  <button
                    type="button"
                    className="wallet-popover-action text-danger"
                    role="menuitem"
                    onClick={() => handleDelete(w)}
                  >
                    <Icon name="trash" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <span>Xóa vĩnh viễn</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  )) || null;
}
