import React from 'react';
import { formatCurrency } from '../../../utils/formatters';

/** One strip of three numbers for the month; replaces the old top strip plus the summary box at the bottom. */
export function RecurringHeaderCard({ monthlyBreakdown, monthlyEstimatedCost }) {
  return (
    <div className="recurring-top-bar-card">
      <div className="recurring-bar-stats-group">
        <div className="banner-stat-block">
          <span className="banner-stat-label">Ước tính mỗi tháng</span>
          <strong className="banner-stat-val">{formatCurrency(Math.round(monthlyEstimatedCost))}</strong>
        </div>

        <div className="banner-stat-divider" aria-hidden="true" />

        <div className="banner-stat-block">
          <span className="banner-stat-label">Đã thanh toán tháng này</span>
          <strong className="banner-stat-val">{formatCurrency(monthlyBreakdown.paidAmount)}</strong>
        </div>

        <div className="banner-stat-divider" aria-hidden="true" />

        <div className="banner-stat-block">
          <span className="banner-stat-label">Còn phải trả tháng này</span>
          <strong className="banner-stat-val">
            {formatCurrency(monthlyBreakdown.remainingAmount)}
            <span className="banner-stat-sub">
              <span aria-hidden="true"> · </span>
              {`${monthlyBreakdown.remainingCount} khoản`}
            </span>
          </strong>
        </div>
      </div>
    </div>
  );
}
