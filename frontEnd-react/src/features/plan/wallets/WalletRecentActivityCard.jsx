import React from 'react';
import { Icon } from '../../../components/ui/AppIcons';
import { formatCurrency, formatRelativeDateTime } from '../../../utils/formatters';

export function WalletRecentActivityCard({ defaultWallet, handleGoToFullHistory, walletActivities, walletMap }) {
  return (
    <div className="wallets-side-card">
      <div className="side-card-header">
        <div className="side-card-title-group">
          <h3 className="side-card-title">Hoạt động gần đây</h3>
          <div className="wallet-activity-tooltip-wrapper">
            <span
              className="wallet-activity-info-trigger"
              tabIndex={0}
              role="button"
              aria-label="Chỉ hiển thị giao dịch LUÂN CHUYỂN TIỀN GIỮA CÁC VÍ với nhau."
            >
              <Icon name="alertCircle" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </span>
            <div className="wallet-activity-tooltip-popup" role="tooltip">
              Chỉ hiển thị giao dịch <strong>LUÂN CHUYỂN TIỀN GIỮA CÁC VÍ</strong> với nhau.
            </div>
          </div>
        </div>
        <button
          type="button"
          className="side-card-link-btn"
          onClick={handleGoToFullHistory}
        >
          <span>Xem tất cả</span>
          <Icon name="chevronRight" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </button>
      </div>
    
      {/* List of Recent Wallet Transfers */}
      <div className="wallet-activities-list">
        {walletActivities.length === 0 ? (
          <div className="activities-empty-hint">
            <p>Chưa có giao dịch chuyển tiền nào giữa các ví.</p>
          </div>
        ) : (
          walletActivities.map((tx) => {
            const fromW = walletMap[tx.walletId];
            const toW = walletMap[tx.toWalletId];
            const fromName = fromW ? fromW.name : 'Ví nguồn';
            const toName = toW ? toW.name : 'Ví đích';
            const isIncoming = tx.toWalletId === defaultWallet?.id;
    
            return (
              <div key={tx.id || tx._id} className="wallet-activity-row">
                <div
                  className="activity-icon-badge activity-icon-badge--tone"
                  style={{ '--activity-icon-badge-background': isIncoming ? '#10B98118' : '#3B82F618', '--activity-icon-badge-color': isIncoming ? '#10B981' : '#3B82F6' }}
                >
                  <Icon name="transfer" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </div>
    
                <div className="activity-flow-info">
                  <span className="activity-names-flow">
                    <strong>{fromName}</strong> → <strong>{toName}</strong>
                  </span>
                  <span className="activity-time-text">
                    {formatRelativeDateTime(tx.date)}
                  </span>
                </div>
    
                <div className={`activity-amt-box ${isIncoming ? 'text-brand' : 'text-danger'}`}>
                  {isIncoming ? '+' : '-'}{formatCurrency(tx.amount)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
