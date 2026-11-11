import React from 'react';
import { formatCurrency, formatPercent } from '../../../utils/formatters';

export function ReportSummaryCards({ reportData }) {
  return (
    <div className="report-summary-grid">
      {/* Summary 1: Thu nhập */}
      <div className="report-summary-card">
        <div className="report-summary-card__header">
          <span className="report-summary-card__title">Tổng thu nhập</span>
          <span className={`delta-badge ${
            reportData.prevStats.income === 0 && reportData.curStats.income > 0
              ? 'delta-badge--up-good'
              : reportData.incomeDelta > 0
              ? 'delta-badge--up-good'
              : reportData.incomeDelta < 0
              ? 'delta-badge--down-bad'
              : 'delta-badge--neutral'
          }`}>
            {reportData.prevStats.income === 0 && reportData.curStats.income > 0
              ? `↑ +${formatPercent(100, { fractionDigits: 1 })}`
              : reportData.incomeDelta > 0
              ? `↑ +${formatPercent(Math.abs(reportData.incomeDeltaPct), { fractionDigits: 1 })}`
              : reportData.incomeDelta < 0
              ? `↓ -${formatPercent(Math.abs(reportData.incomeDeltaPct), { fractionDigits: 1 })}`
              : `~ ${formatPercent(0, { fractionDigits: 1 })}`}
          </span>
        </div>
        <strong className="report-summary-card__amount text-success">
          {formatCurrency(reportData.curStats.income)}
        </strong>
        <div className="report-summary-card__meta">
          <span>Kỳ trước: {formatCurrency(reportData.prevStats.income)}</span>
          <span>{reportData.curStats.incomeCount} GD</span>
        </div>
      </div>
    
      {/* Summary 2: Chi tiêu */}
      <div className="report-summary-card">
        <div className="report-summary-card__header">
          <span className="report-summary-card__title">Tổng chi tiêu</span>
          <span className={`delta-badge ${
            reportData.prevStats.expense === 0 && reportData.curStats.expense > 0
              ? 'delta-badge--new'
              : reportData.prevStats.expense > 0 && reportData.curStats.expense === 0
              ? 'delta-badge--down-good'
              : reportData.expenseDelta < 0
              ? 'delta-badge--down-good'
              : reportData.curStats.net < 0 || reportData.expenseDeltaPct > 30
              ? 'delta-badge--up-bad'
              : reportData.expenseDelta > 0
              ? 'delta-badge--up-warn'
              : 'delta-badge--neutral'
          }`}>
            {reportData.prevStats.expense === 0 && reportData.curStats.expense > 0
              ? 'Mới ghi nhận'
              : reportData.prevStats.expense > 0 && reportData.curStats.expense === 0
              ? `↓ -${formatPercent(100, { fractionDigits: 1 })}`
              : reportData.expenseDelta > 0
              ? `↑ +${formatPercent(Math.abs(reportData.expenseDeltaPct), { fractionDigits: 1 })}`
              : reportData.expenseDelta < 0
              ? `↓ -${formatPercent(Math.abs(reportData.expenseDeltaPct), { fractionDigits: 1 })}`
              : `~ ${formatPercent(0, { fractionDigits: 1 })}`}
          </span>
        </div>
        <strong className={`report-summary-card__amount ${reportData.curStats.expense > 0 ? 'text-danger' : 'text-muted'}`}>
          {formatCurrency(reportData.curStats.expense)}
        </strong>
        <div className="report-summary-card__meta">
          <span>Kỳ trước: {formatCurrency(reportData.prevStats.expense)}</span>
          <span>{reportData.curStats.expenseCount} GD</span>
        </div>
      </div>
    
      {/* Summary 3: Dòng tiền thuần */}
      <div className="report-summary-card">
        <div className="report-summary-card__header">
          <span className="report-summary-card__title">Dòng tiền thuần (Net)</span>
          <span className={`delta-badge ${
            reportData.curStats.net > 0
              ? 'delta-badge--up-good'
              : reportData.curStats.net < 0
              ? 'delta-badge--down-bad'
              : 'delta-badge--neutral'
          }`}>
            {reportData.curStats.net > 0 ? 'Thặng dư' : (reportData.curStats.net < 0 ? 'Thâm hụt' : 'Cân bằng')}
          </span>
        </div>
        <strong className={`report-summary-card__amount ${
          reportData.curStats.net > 0 ? 'text-success' : (reportData.curStats.net < 0 ? 'text-danger' : 'text-muted')
        }`}>
          {formatCurrency(reportData.curStats.net)}
        </strong>
        <div className="report-summary-card__meta">
          <span>Kỳ trước: {formatCurrency(reportData.prevStats.net)}</span>
          <span>{reportData.netDelta >= 0 ? `+${formatCurrency(reportData.netDelta)}` : formatCurrency(reportData.netDelta)}</span>
        </div>
      </div>
    
      {/* Summary 4: Tỷ lệ tiết kiệm */}
      <div className="report-summary-card">
        <div className="report-summary-card__header">
          <span className="report-summary-card__title">Tỷ lệ tiết kiệm</span>
          <span className={`delta-badge ${
            reportData.curStats.income <= 0
              ? 'delta-badge--neutral'
              : reportData.curStats.savingsRate < 0
              ? 'delta-badge--down-bad'
              : reportData.savingsRateDelta >= 0
              ? 'delta-badge--up-good'
              : 'delta-badge--down-warn'
          }`}>
            {reportData.curStats.income <= 0
              ? '—'
              : reportData.savingsRateDelta >= 0
              ? `↑ +${formatPercent(reportData.savingsRateDelta, { fractionDigits: 1 })}`
              : `↓ ${formatPercent(reportData.savingsRateDelta, { fractionDigits: 1 })}`}
          </span>
        </div>
        <strong className={`report-summary-card__amount ${
          reportData.curStats.income <= 0
            ? 'text-muted'
            : reportData.curStats.savingsRate >= 20
            ? 'text-success'
            : reportData.curStats.savingsRate >= 0
            ? 'text-warning'
            : 'text-danger'
        }`}>
          {formatPercent(reportData.curStats.savingsRate)}
        </strong>
        <div className="report-summary-card__meta">
          <span>Kỳ trước: {formatPercent(reportData.prevStats.savingsRate)}</span>
          <span>Mục tiêu: ≥ 20%</span>
        </div>
      </div>
    </div>
  );
}
