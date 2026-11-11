import React from 'react';
import { AlertTriangleOutlineIcon, CategoryOutlineIcon, CheckOutlineIcon, ZapOutlineIcon } from '../../../utils/categoryIcons';
import { formatCurrency, formatPercent } from '../../../utils/formatters';
import { useTranslation } from '../../../i18n/useTranslation';

export function ReportCategoryTable({ activeMonth, curQuarterMonths, reportData, reportPeriodType, viewCategoryHistory }) {
  const { t } = useTranslation();
  return (
    <div className="report-table-wrapper">
      <table className="report-table" aria-label="Bảng phân tích chi tiết chi phí theo danh mục">
        <thead>
          <tr>
            <th className="report-table__th--box">Nhóm chi phí</th>
            <th className="report-table__th--box2">Chi tiêu kỳ này</th>
            <th className="report-table__th--box2">So với kỳ trước</th>
            <th className="report-table__th--box3">Tỷ trọng</th>
            <th className="report-table__th--box4">Số GD</th>
            <th className="report-table__th--box3">Hạn mức</th>
            <th className="report-table__th--box5">Ngân sách</th>
            <th className="report-table__th--box6">Đánh giá & Khuyến nghị</th>
          </tr>
        </thead>
        <tbody>
          {reportData.categoryRows.length === 0 ? (
            <tr>
              <td className="report-table__td--text" colSpan={8}>
                Chưa phát sinh giao dịch chi tiêu nào trong kỳ này.
              </td>
            </tr>
          ) : (
            reportData.categoryRows.map((cat) => {
              const isOver = cat.limit && (cat.budgetStatus.isOver || cat.budgetStatus.percent > 100);
              const isMaxed = cat.limit && cat.budgetStatus.percent === 100;
              const isWarning = cat.limit && (cat.budgetStatus.status === 'warning' || isMaxed);
    
              return (
                <tr key={cat.name}>
                  {/* 1. Category */}
                  <td>
                    <div className="table-cat-cell">
                      <span className="table-cat-icon table-cat-icon--layout">
                        <CategoryOutlineIcon name={cat.name} size={15} />
                      </span>
                      <span className="table-cat-name">{cat.name}</span>
                    </div>
                    {cat.spentCur > 0 && <button type="button" className="category-history-link"
                      onClick={() => viewCategoryHistory(cat.name,
                        reportPeriodType === 'quarterly' ? curQuarterMonths : [activeMonth])}>
                      {t('history.viewCategory')}
                    </button>}
                  </td>
    
                  {/* 2. Current Spent */}
                  <td>
                    <strong className="table-num-cell table-num-cell--bold">
                      {formatCurrency(cat.spentCur)}
                    </strong>
                  </td>
    
                  {/* 3. Delta vs Previous */}
                  <td>
                    <div className="table-delta-cell">
                      <span className={`delta-badge ${
                        cat.deltaBadgeType === 'good'
                          ? 'delta-badge--down-good'
                          : cat.deltaBadgeType === 'bad'
                          ? 'delta-badge--up-bad'
                          : cat.deltaBadgeType === 'warn'
                          ? 'delta-badge--up-warn'
                          : cat.deltaBadgeType === 'new'
                          ? 'delta-badge--new'
                          : 'delta-badge--neutral'
                      }`}>
                        {cat.deltaBadgeText}
                      </span>
                      <span className="table-delta-sub">
                        Kỳ trước: {formatCurrency(cat.spentPrev)}
                      </span>
                    </div>
                  </td>
    
                  {/* 4. Percentage of total */}
                  <td className="table-pct-cell">
                    <div className="table-pct-bar-wrap">
                      <div className="table-pct-track">
                        <div
                          className="table-pct-fill table-pct-fill--box"
                          style={{ '--table-pct-fill-width': `${Math.max(2, cat.pctOfTotal)}%`, '--table-pct-fill-background-color': isOver
                              ? 'var(--color-danger)'
                              : isWarning
                              ? 'var(--color-warning)'
                              : 'var(--color-success)' }}
                        />
                      </div>
                      <span className="table-pct-val">{formatPercent(cat.pctOfTotal)}</span>
                    </div>
                  </td>
    
                  {/* 5. Count */}
                  <td className="report-table__td--text2">
                    <span className="delta-badge delta-badge--neutral">
                      {cat.countCur}
                    </span>
                  </td>
    
                  {/* 6. Budget Limit */}
                  <td>
                    <span className="table-num-cell">
                      {cat.limit ? formatCurrency(cat.limit) : '—'}
                    </span>
                  </td>
    
                  {/* 7. Budget Status */}
                  <td>
                    {cat.limit ? (
                      isOver ? (
                        <span className="budget-status-pill budget-status-pill--danger">
                          <AlertTriangleOutlineIcon size={12} />
                          Vượt ({cat.budgetStatus.percent}%)
                        </span>
                      ) : isMaxed ? (
                        <span className="budget-status-pill budget-status-pill--warning">
                          <ZapOutlineIcon size={12} />
                          Chạm ({cat.budgetStatus.percent}%)
                        </span>
                      ) : isWarning ? (
                        <span className="budget-status-pill budget-status-pill--warning">
                          <ZapOutlineIcon size={12} />
                          Cận trần ({cat.budgetStatus.percent}%)
                        </span>
                      ) : (
                        <span className="budget-status-pill budget-status-pill--safe">
                          <CheckOutlineIcon size={12} />
                          An toàn ({cat.budgetStatus.percent}%)
                        </span>
                      )
                    ) : (
                      <span className="budget-status-pill budget-status-pill--unset">
                        Chưa đặt
                      </span>
                    )}
                  </td>
    
                  {/* 8. Advice & Accolades */}
                  <td className="table-advice-cell">
                    <span className={`table-advice-text--${cat.adviceType}`}>
                      {cat.adviceText}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
