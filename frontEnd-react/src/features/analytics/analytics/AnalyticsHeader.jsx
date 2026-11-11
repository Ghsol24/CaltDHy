import React from 'react';
import { PageTitleIcon } from '../../../components/ui/NavIcons';
import { Icon } from '../../../components/ui/AppIcons';

export function AnalyticsHeader({ handleNextMonth, handlePrevMonth, handleSetLastMonth, handleSetThisMonth, isCurrentMonth, monthLabel }) {
  return (
    <div className="analytics-header-bar" id="analytics-overview">
      <div className="page-title-lead">
        <PageTitleIcon name="analyticsOverview" />
        <div className="analytics-title-group">
          <h1 className="analytics-view-title">Phân tích tài chính</h1>
          <p className="analytics-view-subtitle">
            Nhìn rõ dòng tiền theo thời gian
          </p>
        </div>
      </div>
    
      <div className="analytics-header-controls">
        {/* Segmented Comparison: Tháng này | Tháng trước */}
        <div className="analytics-segmented-switch" role="tablist" aria-label="Khoảng thời gian so sánh">
          <button
            type="button"
            role="tab"
            aria-selected={isCurrentMonth}
            className={`analytics-segment-btn ${isCurrentMonth ? 'active' : ''}`}
            onClick={handleSetThisMonth}
          >
            Tháng này
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isCurrentMonth}
            className={`analytics-segment-btn ${!isCurrentMonth ? 'active' : ''}`}
            onClick={handleSetLastMonth}
          >
            Tháng trước
          </button>
        </div>
    
        {/* Month Stepper Control */}
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
    
          <span className="month-current-display month-current-display--layout" aria-live="polite">
            <Icon name="calendar" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <span>{monthLabel}</span>
          </span>
    
          <button
            type="button"
            className="month-nav-btn"
            onClick={handleNextMonth}
            title="Tháng sau"
            aria-label="Xem tháng sau"
          >
            <Icon name="chevronRight" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </button>
        </div>
      </div>
    </div>
  );
}
