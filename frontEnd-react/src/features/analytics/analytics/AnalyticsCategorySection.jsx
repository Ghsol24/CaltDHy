import React from 'react';
import { NavIcon } from '../../../components/ui/NavIcons';
import { Icon } from '../../../components/ui/AppIcons';
import { Doughnut } from 'react-chartjs-2';
import { formatCurrency, formatPercent } from '../../../utils/formatters';
import { CategoryOutlineIcon } from '../../../utils/categoryIcons';
import { useTranslation } from '../../../i18n/useTranslation';

export function AnalyticsCategorySection({ analyticsSubTab, doughnutChartData, doughnutOptions, isMobile, monthData, monthLabel, openAddTxnModal, viewCategoryHistory }) {
  const { t } = useTranslation();
  return ((!isMobile || analyticsSubTab === 'spending') && (
  <>
  <div className="analytics-section-panel" id="analytics-spending">
    <div className="panel-header">
      <div className="panel-titles">
        <h3 className="panel-main-title panel-main-title--layout">
          <NavIcon name="spending" size={18} /> Chi tiêu theo danh mục
        </h3>
        <p className="panel-subtitle">
          {monthData.categories.length > 0
            ? `${monthData.categories.length} danh mục có phát sinh chi tiêu trong ${monthLabel}`
            : 'Chưa có khoản chi nào trong tháng'}
        </p>
      </div>
    </div>
  
    {monthData.categories.length === 0 ? (
      /* Empty state: Bordered/dashed area, min-height 310px */
      <div className="analytics-empty-dashed-box">
        <div className="empty-pie-icon-tile" aria-hidden="true">
          <Icon name="pieChart" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </div>
        <strong className="empty-heading-caps">
          CHƯA CÓ DỮ LIỆU CHI TIÊU TRONG {monthLabel.toUpperCase()}
        </strong>
        <p className="empty-body-desc">
          Thêm các giao dịch chi tiêu mới để hệ thống tự động phân loại và trực quan hóa tỷ trọng từng nhóm chi phí.
        </p>
        <button
          type="button"
          className="btn-add-txn-empty"
          onClick={openAddTxnModal}
        >
          + Thêm giao dịch ngay
        </button>
      </div>
    ) : (
      /* Data state: Doughnut Chart on Left, Ranked Category List on Right */
      <div className="analytics-category-data-grid">
        <div className="category-chart-wrapper">
          <div className="doughnut-canvas-box">
            {doughnutChartData && <Doughnut data={doughnutChartData} options={doughnutOptions} />}
            <div className="doughnut-center-metric">
              <span className="doughnut-center-label">Tổng chi</span>
              <strong className="doughnut-center-val">{formatCurrency(monthData.expense)}</strong>
            </div>
          </div>
        </div>
  
        <div className="category-ranked-list">
          {monthData.categories.map((cat) => (
            <div key={cat.name} className="analytics-cat-item-row">
              <div className="cat-item-top">
                <div className="cat-item-lead">
                  <span className="cat-avatar-tile cat-avatar-tile--tinted" style={{ '--cat-color': cat.color }}>
                    <CategoryOutlineIcon name={cat.name} size={16} />
                  </span>
                  <div className="cat-text-info">
                    <span className="cat-title-text">{cat.name}</span>
                    <span className="cat-pct-badge">{formatPercent(cat.percent)}</span>
                  </div>
                </div>
  
                <strong className="cat-amount-text">{formatCurrency(cat.amount)}</strong>
              </div>
  
              <div className="cat-progress-track" aria-hidden="true">
                <div
                  className="cat-progress-fill cat-progress-fill--box"
                  style={{ '--cat-progress-fill-width': `${Math.max(3, cat.percent)}%`, '--cat-progress-fill-background-color': cat.color }}
                />
              </div>
              <button type="button" className="category-history-link"
                onClick={() => viewCategoryHistory(cat.name)}>{t('history.viewCategory')}</button>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
  </>
  )) || null;
}
