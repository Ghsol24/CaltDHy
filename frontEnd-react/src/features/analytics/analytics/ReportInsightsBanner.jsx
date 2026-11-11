import React from 'react';
import { AlertTriangleOutlineIcon, BulbOutlineIcon, InfoOutlineIcon, StarOutlineIcon } from '../../../utils/categoryIcons';

export function ReportInsightsBanner({ reportData }) {
  return (reportData.insights.length > 0 && (
    <div className="report-insights-banner">
      <div className="report-insights-banner__head">
        <span className="report-insights-banner__head__span--layout">
          <BulbOutlineIcon size={16} /> Nhận định & Khuyến nghị tài chính kỳ này
        </span>
      </div>
      <div className="report-insights-list">
        {reportData.insights.map((item, idx) => (
          <div key={idx} className="report-insight-item">
            <span className={`insight-icon-pill insight-icon-pill--${item.type}`}>
              {item.type === 'accolade' ? (
                <StarOutlineIcon size={14} />
              ) : item.type === 'warning' ? (
                <AlertTriangleOutlineIcon size={14} />
              ) : (
                <InfoOutlineIcon size={14} />
              )}
            </span>
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  )) || null;
}
