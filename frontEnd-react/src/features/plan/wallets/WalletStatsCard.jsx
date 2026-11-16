import React from 'react';
import { WalletOutlineIcon } from '../../../components/ui/WalletOutlineIcon';
import { formatCurrency } from '../../../utils/formatters';
import { CheckOutlineIcon, Icon } from '../../../components/ui/AppIcons';

export function WalletStatsCard({ allAssets, defaultWallet, totalBalance, wallets }) {
  const excludedAmount = allAssets - totalBalance;
  return (
    <div className="wallets-top-stats-card">
      {/* One total (X-05): wallets switched to "not counted" only add a note. */}
      <div className="stat-card-cell">
        <div className="stat-cell-icon-wrap stat-cell-icon-wrap--tone">
          <WalletOutlineIcon type="cash" size={20} color="#10B981" />
        </div>
        <div className="stat-cell-info">
          <span className="stat-cell-label">Tổng số dư các ví</span>
          <strong className="stat-cell-val text-brand">{formatCurrency(allAssets)}</strong>
          {excludedAmount !== 0 && (
            <span className="stat-cell-sub">Trong đó {formatCurrency(excludedAmount)} không tính vào chi tiêu</span>
          )}
        </div>
      </div>
      <div className="stat-cell-divider" aria-hidden="true" />
      <div className="stat-card-cell">
        <div className="stat-cell-icon-wrap stat-cell-icon-wrap--tone3">
          <WalletOutlineIcon type="credit" size={20} color="#8B5CF6" />
        </div>
        <div className="stat-cell-info">
          <span className="stat-cell-label">Số ví</span>
          <strong className="stat-cell-val">{wallets.length} ví</strong>
        </div>
      </div>
      <div className="stat-cell-divider" aria-hidden="true" />
      <div className="stat-card-cell">
        <div className="stat-cell-icon-wrap stat-cell-icon-wrap--tone">
          <Icon name="shieldCheck" width="20" height="20" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
        </div>
        <div className="stat-cell-info">
          <span className="stat-cell-label">Ví mặc định</span>
          <strong className="stat-cell-val text-brand-default stat-cell-val--layout">
            {defaultWallet?.name || 'Chưa đặt'} <CheckOutlineIcon size={13} className="check-mark" />
          </strong>
        </div>
      </div>
    </div>
  );
}
