import React from 'react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Icon } from '../../../components/ui/AppIcons';
import { AnalyticsMonthPicker } from './AnalyticsMonthPicker';

// One period selector for the whole Analytics page: the month shown here drives the
// summary figures, the category split, the cash-flow chart and the report.
export function AnalyticsHeader({ activeMonth, compact = false, handleNextMonth, handlePrevMonth, handleSelectMonth, handleSetThisMonth, isCurrentMonth, monthLabel }) {
  // Phones on Chi tiêu / Tóm tắt thu chi / Báo cáo show only the month control; the H1 stays
  // for screen readers. Only the full header carries #analytics-overview (scroll/focus target).
  return (
    <PageHeader
      id={compact ? undefined : 'analytics-overview'}
      className={`analytics-header-bar${compact ? ' analytics-header-bar--compact' : ''}`}
      hideTitle={compact}
      icon="analyticsOverview"
      title="Phân tích tài chính"
      titleClassName="analytics-view-title"
      subtitle="Nhìn rõ dòng tiền theo thời gian"
      period={(
        <div className="analytics-header-controls">
          {!isCurrentMonth && (
            <button type="button" className="analytics-this-month-btn" onClick={handleSetThisMonth}>
              Về tháng này
            </button>
          )}

          <div className="analytics-month-stepper" role="group" aria-label="Chuyển tháng">
            <button
              type="button"
              className="month-nav-btn"
              onClick={handlePrevMonth}
              title="Tháng trước"
              aria-label="Xem tháng trước"
            >
              <Icon name="chevronLeft" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </button>

            <AnalyticsMonthPicker activeMonth={activeMonth} monthLabel={monthLabel} onSelect={handleSelectMonth} />

            <button
              type="button"
              className="month-nav-btn"
              onClick={handleNextMonth}
              disabled={isCurrentMonth}
              title="Tháng sau"
              aria-label="Xem tháng sau"
            >
              <Icon name="chevronRight" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </button>
          </div>
        </div>
      )}
    />
  );
}
