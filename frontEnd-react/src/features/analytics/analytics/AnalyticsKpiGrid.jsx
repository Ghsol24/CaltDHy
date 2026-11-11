import React from 'react';
import { Icon } from '../../../components/ui/AppIcons';
import { formatCurrency, formatPercent } from '../../../utils/formatters';

export function AnalyticsKpiGrid({ monthData }) {
  return (
    <div className="analytics-kpi-grid">
      {/* Card 1: Tổng thu nhập */}
      <div className="analytics-kpi-card card-income">
        <div className="kpi-card-header">
          <span className="kpi-card-label">Tổng thu nhập</span>
          <div className="kpi-icon-badge badge-income" aria-hidden="true">
            <Icon name="trendingUp" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </div>
        </div>
        <div className="kpi-card-amount text-success">
          {formatCurrency(monthData.income)}
        </div>
        <div className="kpi-card-meta">
          <span>{monthData.incomeCount} giao dịch thu nhập</span>
        </div>
      </div>
    
      {/* Card 2: Tổng chi tiêu */}
      <div className="analytics-kpi-card card-expense">
        <div className="kpi-card-header">
          <span className="kpi-card-label">Tổng chi tiêu</span>
          <div className="kpi-icon-badge badge-expense" aria-hidden="true">
            <Icon name="trendingDown" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </div>
        </div>
        <div className={`kpi-card-amount ${monthData.expense > 0 ? 'text-danger' : 'text-muted'}`}>
          {formatCurrency(monthData.expense)}
        </div>
        <div className="kpi-card-meta">
          <span>{monthData.expenseCount} giao dịch chi tiêu</span>
        </div>
      </div>
    
      {/* Card 3: Dòng tiền thuần (Net) */}
      <div className="analytics-kpi-card card-net">
        <div className="kpi-card-header">
          <span className="kpi-card-label">Dòng tiền thuần (Net)</span>
          <div className="kpi-icon-badge badge-net" aria-hidden="true">
            <Icon name="rangeVertical" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </div>
        </div>
        <div className={`kpi-card-amount ${monthData.net > 0 ? 'text-success' : (monthData.net < 0 ? 'text-danger' : 'text-muted')}`}>
          {formatCurrency(monthData.net)}
        </div>
        <div className="kpi-card-meta">
          <span className={`kpi-status-pill ${monthData.net > 0 ? 'pill-positive' : (monthData.net < 0 ? 'pill-danger' : 'pill-neutral')}`}>
            {monthData.net > 0 ? 'Thặng dư dòng tiền' : (monthData.net < 0 ? 'Thâm hụt dòng tiền' : 'Cân bằng thu chi')}
          </span>
        </div>
      </div>
    
      {/* Card 4: Tỷ lệ tiết kiệm */}
      <div className="analytics-kpi-card card-savings">
        <div className="kpi-card-header">
          <span className="kpi-card-label">Tỷ lệ tiết kiệm</span>
          <div className="kpi-icon-badge badge-savings" aria-hidden="true">
            <Icon name="heart" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </div>
        </div>
        <div className={`kpi-card-amount ${
          monthData.income <= 0
            ? 'text-muted'
            : monthData.savingsRate >= 20
            ? 'text-success'
            : monthData.savingsRate >= 0
            ? 'text-warning'
            : 'text-danger'
        }`}>
          {monthData.income > 0 ? formatPercent(monthData.savingsRate) : '0%'}
        </div>
        <div className="kpi-card-meta">
          <span className={`kpi-status-pill ${
            monthData.income <= 0
              ? 'pill-neutral'
              : monthData.savingsRate >= 20
              ? 'pill-positive'
              : monthData.savingsRate >= 0
              ? 'pill-warning'
              : 'pill-danger'
          }`}>
            {monthData.income <= 0
              ? 'Chưa có dữ liệu'
              : monthData.savingsRate >= 20
              ? `Tiết kiệm ${formatPercent(monthData.savingsRate)} (Mục tiêu ≥ 20%)`
              : monthData.savingsRate >= 0
              ? `Tiết kiệm ${formatPercent(monthData.savingsRate)} (Dưới mục tiêu 20%)`
              : `Thâm hụt ${formatPercent(Math.abs(monthData.savingsRate))} thu nhập`}
          </span>
        </div>
      </div>
    </div>
  );
}
