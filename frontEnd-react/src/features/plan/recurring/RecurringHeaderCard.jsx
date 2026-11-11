import React from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { Icon } from '../../../components/ui/AppIcons';

export function RecurringHeaderCard({ activeItems, counts, handleOpenCreate, installments, monthlyEstimatedCost }) {
  return (
    <div className="recurring-top-bar-card">
      <div className="recurring-bar-stats-group">
        <div className="banner-stat-block">
          <span className="banner-stat-label">Chi phí ước tính / tháng</span>
          <strong className="banner-stat-val text-brand">
            ~{formatCurrency(Math.round(monthlyEstimatedCost))}
          </strong>
        </div>
    
        <div className="banner-stat-divider" aria-hidden="true" />
    
        <div className="banner-stat-block">
          <span className="banner-stat-label">Khoản đang theo dõi</span>
          <strong className="banner-stat-val">
            {activeItems.length} / {installments.length} khoản
          </strong>
        </div>
    
        <div className="banner-stat-divider" aria-hidden="true" />
    
        <div className="banner-stat-block">
          <span className="banner-stat-label">Sắp đến hạn (7 ngày)</span>
          <strong className="banner-stat-val banner-stat-val--tone">
            {counts.soon} khoản
          </strong>
        </div>
      </div>
    
      <button
        type="button"
        className="recurring-btn-create-primary"
        onClick={handleOpenCreate}
        aria-label="Thêm khoản định kỳ mới"
      >
        <Icon name="plus" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <span className="plan-wide-copy">Thêm khoản định kỳ</span>
        <span className="plan-mobile-copy">Thêm</span>
      </button>
    </div>
  );
}
