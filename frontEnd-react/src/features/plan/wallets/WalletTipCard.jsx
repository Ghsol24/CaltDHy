import React from 'react';
import { BulbOutlineIcon, CloseOutlineIcon } from '../../../components/ui/AppIcons';

export function WalletTipCard({ setShowTip, showTip }) {
  return (showTip && (
    <div className="wallet-finance-tip-card">
      <div className="tip-header-row">
        <div className="tip-title-lead">
          <span className="tip-bulb tip-bulb--layout" aria-hidden="true">
            <BulbOutlineIcon size={16} color="currentColor" />
          </span>
          <strong className="tip-title">Mẹo quản lý tài chính</strong>
        </div>
        <button
          type="button"
          className="tip-close-btn"
          onClick={() => setShowTip(false)}
          aria-label="Đóng mẹo"
        >
          <CloseOutlineIcon size={14} />
        </button>
      </div>
      <p className="tip-body-content">
        Thường xuyên chuyển tiền vào các ví mục tiêu để kiểm soát chi tiêu hiệu quả hơn.
      </p>
    </div>
  )) || null;
}
