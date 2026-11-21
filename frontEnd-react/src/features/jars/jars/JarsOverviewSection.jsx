import React from 'react';
import { JarsPageHeader } from './JarsPageHeader';
import { formatCurrency, formatPercent } from '../../../utils/formatters';

/**
 * Trang "Tổng quan hũ": tiêu đề nằm ngoài thẻ (cùng mẫu các trang khác), thẻ bên dưới có 3 ô số
 * và một thanh tiến độ tổng. So sánh với tháng trước chỉ hiện ở đầu lịch tiết kiệm.
 */
export function JarsOverviewSection({ datedJarsCount, handleCreateNew, jarsCount, thisMonthNet, totalCurrent, totalPercent, totalRemaining, totalTarget }) {
  return (
    <section id="jars-section-goals" className="jars-overview">
      <JarsPageHeader icon="goals" title="Tổng quan hũ" onCreate={handleCreateNew} />

      <div className="jars-hero-overview-card jars-summary-card">
        <div className="jars-hero-metrics-grid">
          <div className="jars-metric-card">
            <span className="jars-metric-label">Đã tích lũy</span>
            <strong className="jars-metric-value">{formatCurrency(totalCurrent)}</strong>
            <span className={`jars-metric-trend${thisMonthNet > 0 ? '' : ' jars-metric-trend--neutral'}`}>
              {thisMonthNet > 0 ? `+${formatCurrency(thisMonthNet)} trong tháng này`
                : thisMonthNet < 0 ? `${formatCurrency(thisMonthNet)} trong tháng này` : 'Tháng này chưa nạp thêm'}
            </span>
          </div>

          <div className="jars-metric-card">
            <span className="jars-metric-label">Tổng mục tiêu</span>
            <strong className="jars-metric-value">{formatCurrency(totalTarget)}</strong>
            <span className="jars-metric-trend jars-metric-trend--neutral">
              {datedJarsCount > 0 ? `${datedJarsCount} hũ có hạn` : 'Chưa hũ nào đặt hạn'}
            </span>
          </div>

          <div className="jars-metric-card">
            <span className="jars-metric-label">Số hũ</span>
            <strong className="jars-metric-value">{jarsCount}</strong>
          </div>
        </div>

        <div className="jars-global-progress-banner">
          <div className="jars-global-progress-labels">
            <span>{`${formatPercent(totalPercent)} mục tiêu`}</span>
            <span>{`còn thiếu ${formatCurrency(totalRemaining)}`}</span>
          </div>
          <div
            className="jars-global-progress-track"
            role="progressbar"
            aria-label="Tiến độ tổng của các hũ"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={totalPercent}
          >
            <div
              className="jars-global-progress-fill jars-global-progress-fill--box"
              style={{ '--jars-global-progress-fill-width': `${Math.max(totalPercent > 0 ? 3 : 0, totalPercent)}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
