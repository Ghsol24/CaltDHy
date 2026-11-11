import React from 'react';
import { NavIcon } from '../../../components/ui/NavIcons';
import { Icon } from '../../../components/ui/AppIcons';
import { ReportSummaryCards } from './ReportSummaryCards';
import { ReportInsightsBanner } from './ReportInsightsBanner';
import { ReportCategoryTable } from './ReportCategoryTable';

export function FinancialReportSection({ activeMonth, analyticsSubTab, curQuarterMonths, handleExportCSV, handlePrint, isMobile, reportData, reportPeriodType, setReportPeriodType, viewCategoryHistory }) {
  return ((!isMobile || analyticsSubTab === 'reports') && (
  <>
  <div className="analytics-section-panel analytics-report-section" id="analytics-reports">
    {/* Header & Controls */}
    <div className="panel-header">
      <div className="panel-titles">
        <h3 className="panel-main-title panel-main-title--layout">
          <NavIcon name="reports" size={18} /> Báo cáo tổng hợp tài chính
        </h3>
      </div>
  
      <div className="report-action-bar">
        {/* Period Mode Selector: Tháng | Quý */}
        <div className="analytics-segmented-switch" role="radiogroup" aria-label="Chế độ báo cáo">
          <button
            type="button"
            role="radio"
            aria-checked={reportPeriodType === 'monthly'}
            className={`analytics-segment-btn ${reportPeriodType === 'monthly' ? 'active' : ''}`}
            onClick={() => setReportPeriodType('monthly')}
          >
            Theo Tháng
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={reportPeriodType === 'quarterly'}
            className={`analytics-segment-btn ${reportPeriodType === 'quarterly' ? 'active' : ''}`}
            onClick={() => setReportPeriodType('quarterly')}
          >
            Theo Quý
          </button>
        </div>
  
        {/* Print & Export Buttons */}
        <button
          type="button"
          className="btn-report-action"
          onClick={handlePrint}
          title="In hoặc Lưu thành file PDF"
        >
          <Icon name="printer" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <span>In báo cáo</span>
        </button>
  
        <button
          type="button"
          className="btn-report-action btn-report-action--primary"
          onClick={handleExportCSV}
          title="Tải bảng tính sao kê chi tiết dạng CSV (tương thích Excel)"
        >
          <Icon name="download" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <span>Xuất CSV</span>
        </button>
      </div>
    </div>
  
    {/* Period info pill */}
    <div className="analytics-section-panel__div--layout">
      <span className="report-period-tag report-period-tag--layout">
        <Icon name="calendar" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <span>Kỳ báo cáo: <strong>{reportData.curLabel}</strong></span>
      </span>
      <span className="analytics-section-panel__span--text">
        (Đối chiếu với kỳ liền kề: <strong>{reportData.prevLabel}</strong>)
      </span>
    </div>
  
    {/* Executive Summary Cards */}
    <ReportSummaryCards reportData={reportData} />
  
    {/* Smart Financial Insights & Advice Banner */}
    {<ReportInsightsBanner reportData={reportData} />}
  
    {/* Detailed Category Table */}
    <ReportCategoryTable activeMonth={activeMonth} curQuarterMonths={curQuarterMonths} reportData={reportData} reportPeriodType={reportPeriodType} viewCategoryHistory={viewCategoryHistory} />
  </div>
  </>
  )) || null;
}
