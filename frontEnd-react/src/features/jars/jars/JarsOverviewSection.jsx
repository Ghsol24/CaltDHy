import React from 'react';
import { PageTitleIcon } from '../../../components/ui/NavIcons';
import { Icon } from '../../../components/ui/AppIcons';
import { formatCurrency, formatPercent } from '../../../utils/formatters';

export function JarsOverviewSection({ activeJarsCount, handleCreateNew, thisMonthComparison, thisMonthNet, totalCurrent, totalPercent, totalRemaining, totalTarget }) {
  return (
    <section id="jars-section-goals" className="jars-hero-overview-card">
      {/* Header Title Row */}
      <div className="jars-hero-top-row">
        <div className="page-title-lead">
          <PageTitleIcon name="goals" />
          <div className="jars-hero-titles">
            <h1 className="jars-hero-heading">Mục tiêu</h1>
          </div>
        </div>
    
        <button
          type="button"
          className="jars-hero-cta-btn"
          onClick={handleCreateNew}
        >
          <Icon name="plus" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <span>Tạo hũ mới</span>
        </button>
      </div>
    
      {/* 4 Metric Cards */}
      <div className="jars-hero-metrics-grid">
        {/* Card 1: Đã tích lũy */}
        <div className="jars-metric-card">
          <div className="jars-metric-top">
            <span className="jars-metric-label">Đã tích lũy</span>
            <div className="jars-metric-icon-box jars-metric-icon-box--blue">
              <Icon name="creditCard" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </div>
          </div>
          <strong className="jars-metric-value">{formatCurrency(totalCurrent)}</strong>
          {thisMonthComparison.percent !== null ? (
            <span className={`jars-metric-trend${thisMonthComparison.percent < 0 ? ' jars-metric-trend--down' : ''}`}>
              {thisMonthComparison.percent < 0 ? '↓' : '↑'} {Math.abs(thisMonthComparison.percent)}% so với tháng trước
            </span>
          ) : (
            <span className={`jars-metric-trend${thisMonthNet > 0 ? '' : ' jars-metric-trend--neutral'}`}>
              {thisMonthNet > 0 ? `+${formatCurrency(thisMonthNet)} trong tháng này`
                : thisMonthNet < 0 ? `${formatCurrency(thisMonthNet)} trong tháng này` : 'Tháng này chưa nạp thêm'}
            </span>
          )}
        </div>
    
        {/* Card 2: Tổng mục tiêu */}
        <div className="jars-metric-card">
          <div className="jars-metric-top">
            <span className="jars-metric-label">Tổng mục tiêu</span>
            <div className="jars-metric-icon-box jars-metric-icon-box--purple">
              <Icon name="flag" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </div>
          </div>
          <strong className="jars-metric-value">{formatCurrency(totalTarget)}</strong>
          <span className="jars-metric-trend jars-metric-trend--neutral">
            Mục tiêu cả năm
          </span>
        </div>
    
        {/* Card 3: Đang thực hiện */}
        <div className="jars-metric-card">
          <div className="jars-metric-top">
            <span className="jars-metric-label">Đang thực hiện</span>
            <div className="jars-metric-icon-box jars-metric-icon-box--orange">
              <Icon name="jarGoal" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
            </div>
          </div>
          <strong className="jars-metric-value">{activeJarsCount} hũ</strong>
          <span className="jars-metric-trend jars-metric-trend--neutral">
            Hoạt động ổn định
          </span>
        </div>
    
        {/* Card 4: Tỷ lệ hoàn thành */}
        <div className="jars-metric-card">
          <div className="jars-metric-top">
            <span className="jars-metric-label">Tỷ lệ hoàn thành</span>
            <div className="jars-metric-icon-box jars-metric-icon-box--teal">
              <Icon name="pieChart" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </div>
          </div>
          <strong className="jars-metric-value">{formatPercent(totalPercent)}</strong>
          <div className="jars-metric-mini-track">
            <div
              className="jars-metric-mini-fill jars-metric-mini-fill--box"
              style={{ '--jars-metric-mini-fill-width': `${Math.max(totalPercent > 0 ? 4 : 0, totalPercent)}%` }}
            />
          </div>
        </div>
      </div>
    
      {/* Global Progress Bar */}
      <div className="jars-global-progress-banner">
        <div className="jars-global-progress-labels">
          <span>
            Bạn đã hoàn thành <strong>{formatPercent(totalPercent)}</strong> mục tiêu
          </span>
          <span>
            Còn thiếu: <strong>{formatCurrency(totalRemaining)}</strong>
          </span>
        </div>
        <div className="jars-global-progress-track">
          <div
            className="jars-global-progress-fill jars-global-progress-fill--box"
            style={{ '--jars-global-progress-fill-width': `${Math.max(totalPercent > 0 ? 3 : 0, totalPercent)}%` }}
          />
        </div>
      </div>
    </section>
  );
}
