import React from 'react';
import { formatCurrency, formatPercent } from '../../../utils/formatters';
import { useTranslation } from '../../../i18n/useTranslation';

/**
 * Thẻ tóm tắt tổng của trang Hũ tiết kiệm hợp nhất: 3 ô chỉ số gọn + 1 thanh tiến độ tổng.
 */
export function JarsOverviewSection({ datedJarsCount, jarsCount, thisMonthNet, totalCurrent, totalPercent, totalRemaining, totalTarget }) {
  const { t } = useTranslation();
  return (
    <section id="jars-section-goals" className="jars-overview" aria-label={t('nav.jars')}>
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
