import React from 'react';
import { formatCurrency } from '../../../utils/formatters';

export function RecurringHeaderCard({ activeItems, counts, installments, monthlyEstimatedCost }) {
  return (
    <div className="recurring-top-bar-card">
      <div className="recurring-bar-stats-group">
        <div className="banner-stat-block">
          <span className="banner-stat-label">Chi phí ước tính / tháng</span>
          <strong className="banner-stat-val">
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
          <strong className="banner-stat-val">
            {counts.soon} khoản
          </strong>
        </div>
      </div>
    </div>
  );
}
