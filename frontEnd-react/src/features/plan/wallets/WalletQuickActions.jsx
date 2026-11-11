import React from 'react';
import { Icon } from '../../../components/ui/AppIcons';

export function WalletQuickActions({ defaultWallet, handleGoToFullHistory, handleTransfer, openAddTxnModal }) {
  return (
    <div className="wallet-quick-actions-section">
      <h3 className="wallets-section-title">Thao tác nhanh</h3>
      <div className="wallet-quick-actions-grid">
        {/* 1. Chuyển tiền */}
        <button
          type="button"
          className="wallet-quick-action-card"
          onClick={() => handleTransfer(null)}
        >
          <div className="quick-action-icon-box quick-action-icon-box--tone">
            <Icon name="transfer" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </div>
          <div className="quick-action-content">
            <strong className="quick-action-title">Chuyển tiền</strong>
          </div>
        </button>
    
        {/* 2. Nạp tiền */}
        <button
          type="button"
          className="wallet-quick-action-card"
          onClick={() =>
            openAddTxnModal({
              type: 'income',
              title: defaultWallet ? `Nạp tiền vào ${defaultWallet.name}` : 'Nạp tiền vào ví',
              walletId: defaultWallet?.id
            })
          }
        >
          <div className="quick-action-icon-box quick-action-icon-box--tone2">
            <Icon name="arrowDown" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </div>
          <div className="quick-action-content">
            <strong className="quick-action-title">Nạp tiền</strong>
          </div>
        </button>
    
        {/* 3. Rút tiền */}
        <button
          type="button"
          className="wallet-quick-action-card"
          onClick={() =>
            openAddTxnModal({
              type: 'expense',
              title: defaultWallet ? `Rút tiền từ ${defaultWallet.name}` : 'Rút tiền từ ví',
              walletId: defaultWallet?.id
            })
          }
        >
          <div className="quick-action-icon-box quick-action-icon-box--tone3">
            <Icon name="arrowUp" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </div>
          <div className="quick-action-content">
            <strong className="quick-action-title">Rút tiền</strong>
          </div>
        </button>
    
        {/* 4. Lịch sử giao dịch */}
        <button
          type="button"
          className="wallet-quick-action-card"
          onClick={handleGoToFullHistory}
        >
          <div className="quick-action-icon-box quick-action-icon-box--tone4">
            <Icon name="clock" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </div>
          <div className="quick-action-content">
            <strong className="quick-action-title">Lịch sử giao dịch</strong>
          </div>
        </button>
      </div>
    
    </div>
  );
}
