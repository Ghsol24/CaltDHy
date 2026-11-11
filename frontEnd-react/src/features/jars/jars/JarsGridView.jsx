import React from 'react';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { Icon } from '../../../components/ui/AppIcons';
import { DeferredJarGlassGraphic } from './DeferredJarGlassGraphic';

export function JarsGridView({ activeMenuJarId, deletingJarId, handleCreateNew, handleDelete, handleDeposit, handleEdit, handleOpenDetail, handleWithdraw, isLoading, jars, setActiveMenuJarId, viewMode, visibleJars }) {
  return (!isLoading && jars.length > 0 && viewMode === 'grid' && (
    <div className="jars-grid-container">
      {visibleJars.map((jar) => {
        const currentAmt = Number(jar.current || 0);
        const targetAmt = Number(jar.target || 0);
        const percent = targetAmt > 0 ? Math.min(100, Math.round((currentAmt / targetAmt) * 100)) : 0;
        const remaining = Math.max(0, targetAmt - currentAmt);
        const isCompleted = targetAmt > 0 && currentAmt >= targetAmt;
        const accentColor = jar.color || '#5356F1';
  
        // Calculate monthly savings suggestion
        let monthlyHintText = 'Đặt ngày đến hạn để nhận gợi ý tích lũy hàng tháng';
        if (jar.targetDate && remaining > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((new Date(jar.targetDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 0) {
            const monthsLeft = Math.max(1, Math.round(diffDays / 30));
            const perMonth = Math.round(remaining / monthsLeft);
            monthlyHintText = `Cần khoảng ${formatCurrency(perMonth)} / tháng để đạt mục tiêu đúng hạn`;
          } else {
            monthlyHintText = 'Đã đến hạn mục tiêu!';
          }
        } else if (isCompleted) {
          monthlyHintText = 'Đã hoàn thành 100% mục tiêu xuất sắc!';
        }
  
        return (
          <div
            key={jar.id}
            className={`jar-premium-card ${deletingJarId === jar.id ? 'is-deleting' : ''}`}
            style={{ '--jar-accent-color': accentColor }}
            onClick={() => handleOpenDetail(jar)}
          >
            {/* Top Category Tag + Menu */}
            <div className="jar-card-top-row" onClick={(e) => e.stopPropagation()}>
              <span className="jar-category-badge">
                {jar.category || 'MỤC TIÊU'}
              </span>
  
              {/* 3-dots dropdown */}
              <div className="jar-card-top-row__div--pos">
                <button
                  type="button"
                  className={`jar-card-menu-btn ${activeMenuJarId === jar.id ? 'is-active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuJarId(activeMenuJarId === jar.id ? null : jar.id);
                  }}
                  aria-label="Tùy chọn hũ"
                >
                  <Icon name="moreVerticalBold" width="16" height="16" fill="currentColor" />
                </button>
  
                {activeMenuJarId === jar.id && (
                  <div className="jar-card-dropdown-menu">
                    <button
                      type="button"
                      className="jar-dropdown-item"
                      onClick={() => {
                        setActiveMenuJarId(null);
                        handleOpenDetail(jar);
                      }}
                    >
                      Xem chi tiết
                    </button>
                    <button
                      type="button"
                      className="jar-dropdown-item"
                      onClick={() => {
                        setActiveMenuJarId(null);
                        handleEdit(jar);
                      }}
                    >
                      Chỉnh sửa
                    </button>
                    <button
                      type="button"
                      className="jar-dropdown-item jar-dropdown-item--danger"
                      onClick={() => {
                        setActiveMenuJarId(null);
                        handleDelete(jar);
                      }}
                    >
                      Xóa hũ
                    </button>
                  </div>
                )}
              </div>
            </div>
  
            {/* 3D Glass Jar Illustration Graphic */}
            <div className="jar-graphic-center-box">
              <DeferredJarGlassGraphic
                percent={percent}
                color={accentColor}
                icon={jar.icon}
                width={80}
                height={96}
              />
            </div>
  
            {/* Jar Name & Amounts */}
            <div className="jar-info-section">
              <h3 className="jar-name-title" title={jar.name}>
                {/* The whole card opens the detail on click; this button is the
                    keyboard and screen-reader route to the same action. */}
                <button
                  type="button"
                  className="jar-open-detail-btn"
                  aria-label={`Xem chi tiết hũ ${jar.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDetail(jar);
                  }}
                >
                  {jar.name}
                </button>
              </h3>
              <div className="jar-amounts-row">
                <strong className="jar-current-amount">{formatCurrency(currentAmt)}</strong>
                <span className="jar-target-amount">/ {formatCurrency(targetAmt)}</span>
              </div>
  
              <div className="jar-progress-track">
                <div
                  className={`jar-progress-fill${isCompleted ? ' is-complete' : ''} jar-progress-fill--box`}
                  style={{ '--jar-progress-fill-width': `${Math.max(percent > 0 ? 3 : 0, percent)}%` }}
                />
              </div>
            </div>
  
            {/* 2 Meta Columns: Còn thiếu / Đến hạn */}
            <div className="jar-meta-cols-row">
              <span>
                Còn thiếu: <strong>{formatCurrency(remaining)}</strong>
              </span>
              <span>
                {jar.targetDate ? (
                  <>Đến hạn: <strong>{formatDate(jar.targetDate, 'short')}</strong></>
                ) : (
                  'Mục tiêu linh hoạt'
                )}
              </span>
            </div>
  
            {/* Smart Monthly Target Box */}
            <div className="jar-smart-hint-box">
              <span>{monthlyHintText}</span>
            </div>
  
            {/* Footer 3 Action Buttons */}
            <div className="jar-card-footer-actions" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="jar-btn-deposit"
                onClick={() => handleDeposit(jar)}
              >
                + Nạp tiền
              </button>
  
              <button
                type="button"
                className="jar-btn-withdraw"
                onClick={() => handleWithdraw(jar)}
                disabled={currentAmt <= 0}
              >
                Rút tiền
              </button>
  
              <button
                type="button"
                className="jar-btn-detail-icon"
                onClick={() => handleEdit(jar)}
                aria-label={`Chỉnh sửa hũ ${jar.name}`}
                title="Chỉnh sửa hũ"
              >
                <Icon name="pencil" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </button>
            </div>
          </div>
        );
      })}
  
      {/* Card "+ Tạo hũ mới" (Dashed Border) */}
      <button type="button" className="jar-card-add-new" onClick={handleCreateNew}>
        <div className="jar-card-add-icon-circle">+</div>
        <h3 className="jar-card-add-title">Tạo hũ mới</h3>
        <p className="jar-card-add-desc">Bắt đầu một mục tiêu mới ngay hôm nay!</p>
      </button>
    </div>
  )) || null;
}
