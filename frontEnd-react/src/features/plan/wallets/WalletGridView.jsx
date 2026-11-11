import React from 'react';
import { WALLET_TYPE_LABELS } from './walletLabels';
import { WalletOutlineIcon } from '../../../components/ui/WalletOutlineIcon';
import { Icon, StarOutlineIcon } from '../../../components/ui/AppIcons';
import { IconButton } from '../../../components/ui/Button';
import { formatCurrency } from '../../../utils/formatters';

export function WalletGridView({ deletingWalletId, filteredWallets, getWalletUsagePercent, handleArchive, handleDelete, handleEdit, handleTransfer, menuRef, menuTriggerRef, openAddTxnModal, openMenuWalletId, setOpenMenuWalletId, viewMode, walletTxCountMap }) {
  return (filteredWallets.length > 0 && viewMode === 'grid' && (
    <div className="wallets-cards-grid">
      {filteredWallets.map((w) => {
        const isNegative = Number(w.currentBalance) < 0;
        const typeLabel = WALLET_TYPE_LABELS[w.type] || 'Ví tiền mặt';
        const accentColor = w.color || '#10B981';
        const txCount = walletTxCountMap[w.id] || 0;
        const isMenuOpen = openMenuWalletId === w.id;
        const usagePct = getWalletUsagePercent(w);
  
        return (
          <div
            key={w.id}
            className={`wallet-grid-card ${deletingWalletId === w.id ? 'is-deleting' : ''} wallet-grid-card--tone`}
            style={{ '--wallet-grid-card-border-top-color': accentColor }}
          >
            {/* Card Header: Icon + Title + Default Badge + 3-dots */}
            <div className="wallet-grid-card-header">
              <div className="wallet-grid-header-left">
                <div
                  className="wallet-grid-icon-box"
                  style={{ '--wallet-accent': accentColor }}
                >
                  <WalletOutlineIcon type={w.type} size={20} color={accentColor} />
                </div>
                <div className="wallet-grid-title-box">
                  <div className="wallet-grid-name-row">
                    <h4 className="wallet-grid-name" title={w.name}>{w.name}</h4>
                    {w.isDefault && (
                      <span className="wallet-badge-default-pill wallet-badge-default-pill--layout">
                        <StarOutlineIcon size={11} />
                        <span>Mặc định</span>
                      </span>
                    )}
                    {w.isExcludedFromTotal && (
                      <span className="wallet-badge-excluded-pill">⊘</span>
                    )}
                  </div>
                  <span className="wallet-grid-type">{typeLabel}</span>
                </div>
              </div>
  
              {/* 3-dots Popover Menu */}
              <div className="wallet-grid-action-col" ref={isMenuOpen ? menuRef : null}>
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
  
            {/* Card Body: Big Balance + Tỷ lệ sử dụng (Progress Bar) */}
            <div className="wallet-grid-card-body">
              <div className={`wallet-grid-balance ${isNegative ? 'text-danger' : 'text-brand'}`}>
                {formatCurrency(w.currentBalance ?? w.initialBalance ?? 0)}
              </div>
  
              <div className="wallet-grid-usage-box">
                <div className="wallet-grid-usage-labels">
                  <span className="usage-label">Tỷ lệ sử dụng</span>
                  <strong className="usage-pct">{usagePct}%</strong>
                </div>
                <div className="wallet-grid-progress-track">
                  <div
                    className="wallet-grid-progress-fill wallet-grid-progress-fill--box"
                    style={{ '--wallet-grid-progress-fill-width': `${Math.max(4, usagePct)}%`, '--wallet-grid-progress-fill-background-color': accentColor }}
                  />
                </div>
              </div>
            </div>
  
            {/* Card Footer: Transactions Count & Last Updated */}
            <div className="wallet-grid-card-footer">
              <div className="wallet-grid-footer-item">
                <Icon name="clock" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <span>{txCount} giao dịch</span>
              </div>
  
              <div className="wallet-grid-footer-item">
                <Icon name="clockAlt" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
                <span>Hôm nay</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  )) || null;
}
