import React from 'react';
import { Icon } from '../../../components/ui/AppIcons';
import { formatCurrency } from '../../../utils/formatters';

export function RecurringSummaryBox({ monthDisplayLabel, monthlyBreakdown, monthlyEstimatedCost }) {
  return (
    <div className="recurring-summary-bottom-card">
      <div className="summary-bottom-header-row">
        <div className="summary-bottom-title-lead">
          <div className="summary-bottom-icon-box" aria-hidden="true">
            <Icon name="calendar" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </div>
          <div className="summary-bottom-titles">
            <h3 className="summary-bottom-title">Tổng quan khoản định kỳ</h3>
            <span className="summary-bottom-subtitle">
              Thống kê chi tiết trong {monthDisplayLabel}
            </span>
          </div>
        </div>
      </div>
    
      <div className="summary-bottom-grid">
        {/* Cell 1: Đã thanh toán */}
        <div className="summary-grid-cell">
          <span className="grid-cell-label">Đã thanh toán</span>
          <strong className="grid-cell-num text-brand">
            {formatCurrency(monthlyBreakdown.paidAmount)}
          </strong>
          <span className="grid-cell-sub">{monthlyBreakdown.paidCount} khoản</span>
        </div>
    
        <div className="summary-grid-divider" aria-hidden="true" />
    
        {/* Cell 2: Sắp thanh toán */}
        <div className="summary-grid-cell">
          <span className="grid-cell-label">Sắp thanh toán</span>
          <strong className="grid-cell-num text-warning">
            {formatCurrency(monthlyBreakdown.upcomingSoonAmount)}
          </strong>
          <span className="grid-cell-sub">{monthlyBreakdown.upcomingSoonCount} khoản</span>
        </div>
    
        <div className="summary-grid-divider" aria-hidden="true" />
    
        {/* Cell 3: Còn lại trong tháng */}
        <div className="summary-grid-cell">
          <span className="grid-cell-label">Còn lại trong tháng</span>
          <strong className="grid-cell-num text-blue">
            {formatCurrency(monthlyBreakdown.remainingAmount)}
          </strong>
          <span className="grid-cell-sub">{monthlyBreakdown.remainingCount} khoản</span>
        </div>
    
        <div className="summary-grid-divider" aria-hidden="true" />
    
        {/* Cell 4: Trung bình / tháng */}
        <div className="summary-grid-cell">
          <span className="grid-cell-label">Trung bình / tháng</span>
          <strong className="grid-cell-num text-purple">
            {formatCurrency(Math.round(monthlyEstimatedCost))}
          </strong>
          <span className="grid-cell-sub">~ chi phí định kỳ</span>
        </div>
      </div>
    </div>
  );
}
