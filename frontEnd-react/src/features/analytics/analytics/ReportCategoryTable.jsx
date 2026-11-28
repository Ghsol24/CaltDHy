import React from 'react';
import { AlertTriangleOutlineIcon, CheckOutlineIcon, ZapOutlineIcon } from '../../../utils/categoryIcons';
import { CategoryMark } from '../../../components/ui/CategoryMark';
import { formatCurrency, formatPercent } from '../../../utils/formatters';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useTranslation } from '../../../i18n/useTranslation';

function budgetState(cat) {
  const isOver = cat.limit && (cat.budgetStatus.isOver || cat.budgetStatus.percent > 100);
  const isMaxed = cat.limit && cat.budgetStatus.percent === 100;
  const isWarning = cat.limit && (cat.budgetStatus.status === 'warning' || isMaxed);
  return { isOver, isMaxed, isWarning };
}

function deltaOf(cat) {
  return cat.isNewInPeriod
    ? { type: 'new', text: 'Mới trong kỳ' }
    : { type: cat.deltaBadgeType, text: cat.deltaBadgeText };
}

const DELTA_CLASS = {
  good: 'delta-badge--down-good', bad: 'delta-badge--up-bad', warn: 'delta-badge--up-warn', new: 'delta-badge--new',
};

function BudgetPill({ cat }) {
  const { isOver, isMaxed, isWarning } = budgetState(cat);
  if (!cat.limit) return <span className="budget-status-pill budget-status-pill--unset">Chưa đặt</span>;
  if (isOver) {
    return <span className="budget-status-pill budget-status-pill--danger"><AlertTriangleOutlineIcon size={12} />{`Vượt (${cat.budgetStatus.percent}%)`}</span>;
  }
  if (isMaxed) {
    return <span className="budget-status-pill budget-status-pill--warning"><ZapOutlineIcon size={12} />{`Chạm (${cat.budgetStatus.percent}%)`}</span>;
  }
  if (isWarning) {
    return <span className="budget-status-pill budget-status-pill--warning"><ZapOutlineIcon size={12} />{`Cận trần (${cat.budgetStatus.percent}%)`}</span>;
  }
  return <span className="budget-status-pill budget-status-pill--safe"><CheckOutlineIcon size={12} />{`An toàn (${cat.budgetStatus.percent}%)`}</span>;
}

/**
 * Category breakdown of the report. Desktop: a five-column table (the old "advice" and "limit"
 * columns only restated their neighbours; the CSV export still carries every column). Phones: one
 * card per category.
 */
export function ReportCategoryTable({ activeMonth, curQuarterMonths, reportData, reportPeriodType, viewCategoryHistory }) {
  const { t, label } = useTranslation();
  const isMobile = useIsMobile();
  const months = reportPeriodType === 'quarterly' ? curQuarterMonths : [activeMonth];
  const openHistory = (cat) => viewCategoryHistory(cat.name, months);
  const historyLabel = (cat) => `${t('history.viewCategory')} ${label(cat.name)}`;

  if (reportData.categoryRows.length === 0) {
    return (
      <div className="report-table-wrapper">
        <p className="report-table__td--text">Chưa phát sinh giao dịch chi tiêu nào trong kỳ này.</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <ul className="report-cat-cards" aria-label="Bảng phân tích chi tiết chi phí theo danh mục">
        {reportData.categoryRows.map((cat) => {
          const { isOver, isWarning } = budgetState(cat);
          const delta = deltaOf(cat);
          const content = (
            <>
              <span className="report-cat-card__top">
                <span className="table-cat-icon table-cat-icon--layout"><CategoryMark name={cat.name} size={15} /></span>
                <span className="table-cat-name">{label(cat.name)}</span>
                <strong className="table-num-cell table-num-cell--bold">{formatCurrency(cat.spentCur)}</strong>
              </span>
              <span className="report-cat-card__meta">
                <span className={`report-cat-card__delta ${DELTA_CLASS[delta.type] || ''}`}>{delta.text}</span>
                <span>{`${cat.countCur} giao dịch`}</span>
                {cat.limit && <span className={isOver ? 'report-cat-card__limit--over' : (isWarning ? 'report-cat-card__limit--warn' : '')}>
                  {`${cat.budgetStatus.percent}% hạn mức`}
                </span>}
              </span>
            </>
          );
          return (
            <li key={cat.name}>
              {cat.spentCur > 0
                ? <button type="button" className="report-cat-card" aria-label={historyLabel(cat)} onClick={() => openHistory(cat)}>{content}</button>
                : <div className="report-cat-card">{content}</div>}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="report-table-wrapper">
      <table className="report-table" aria-label="Bảng phân tích chi tiết chi phí theo danh mục">
        <thead>
          <tr>
            <th className="report-table__th--box">Danh mục</th>
            <th className="report-table__th--box2">Chi tiêu kỳ này</th>
            <th className="report-table__th--box2">So với kỳ trước</th>
            <th className="report-table__th--box4">Số giao dịch</th>
            <th className="report-table__th--box5">Ngân sách</th>
          </tr>
        </thead>
        <tbody>
          {reportData.categoryRows.map((cat) => {
            const { isOver, isWarning } = budgetState(cat);
            const delta = deltaOf(cat);
            const name = (
              <>
                <span className="table-cat-icon table-cat-icon--layout"><CategoryMark name={cat.name} size={15} /></span>
                <span className="table-cat-name">{label(cat.name)}</span>
              </>
            );
            return (
              <tr key={cat.name}>
                {/* 1. Category: the name opens that category's transactions */}
                <td>
                  {cat.spentCur > 0
                    ? <button type="button" className="table-cat-cell table-cat-link" aria-label={historyLabel(cat)} onClick={() => openHistory(cat)}>{name}</button>
                    : <div className="table-cat-cell">{name}</div>}
                </td>

                {/* 2. Spent this period + share of total */}
                <td>
                  <strong className="table-num-cell table-num-cell--bold">{formatCurrency(cat.spentCur)}</strong>
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

                {/* 3. Delta vs previous period */}
                <td>
                  <div className="table-delta-cell">
                    <span className={`delta-badge ${DELTA_CLASS[delta.type] || 'delta-badge--neutral'}`}>{delta.text}</span>
                    <span className="table-delta-sub">{`Kỳ trước: ${formatCurrency(cat.spentPrev)}`}</span>
                  </div>
                </td>

                {/* 4. Count */}
                <td className="report-table__td--text2">
                  <span className="delta-badge delta-badge--neutral">{cat.countCur}</span>
                </td>

                {/* 5. Budget: status + spent / limit */}
                <td>
                  <div className="table-budget-cell">
                    <BudgetPill cat={cat} />
                    {cat.limit && <span className="table-delta-sub">{`${formatCurrency(cat.spentCur)} / ${formatCurrency(cat.limit)}`}</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
