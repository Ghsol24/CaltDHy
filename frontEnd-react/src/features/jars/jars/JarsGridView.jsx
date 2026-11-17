import React from 'react';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { Icon } from '../../../components/ui/AppIcons';
import { DeferredJarGlassGraphic } from './DeferredJarGlassGraphic';

export function JarsGridView({ activeMenuJarId, deletingJarId, handleCreateNew, handleDelete, handleDeposit, handleEdit, handleOpenDetail, handleWithdraw, isLoading, jarStatuses, jars, menuTriggerRef, setActiveMenuJarId, viewMode, visibleJars }) {
  return (!isLoading && jars.length > 0 && viewMode === 'grid' && (
    <div className="jars-grid-container">
      {visibleJars.map((jar) => {
        const currentAmt = Number(jar.current || 0);
        const targetAmt = Number(jar.target || 0);
        const percent = targetAmt > 0 ? Math.min(100, Math.round((currentAmt / targetAmt) * 100)) : 0;
        const remaining = Math.max(0, targetAmt - currentAmt);
        const isCompleted = targetAmt > 0 && currentAmt >= targetAmt;
        const accentColor = jar.color || '#5356F1';
        const status = jarStatuses?.get(jar.id);

        // Hạn và gợi ý tích lũy theo tháng. Chưa đặt hạn thì chỉ là một liên kết chữ mở hộp thoại sửa.
        let dueNote = '';
        if (jar.targetDate && remaining > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((new Date(jar.targetDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 0) {
            const monthsLeft = Math.max(1, Math.round(diffDays / 30));
            dueNote = `Cần khoảng ${formatCurrency(Math.round(remaining / monthsLeft))} / tháng để đạt mục tiêu đúng hạn`;
          } else {
            dueNote = 'Đã đến hạn mục tiêu';
          }
        }

        return (
          <div
            key={jar.id}
            className={`jar-premium-card ${deletingJarId === jar.id ? 'is-deleting' : ''}`}
            style={{ '--jar-accent-color': accentColor }}
            onClick={() => handleOpenDetail(jar)}
          >
            {/* Hình hũ nhỏ cạnh tên + phân loại + menu */}
            <div className="jar-card-top-row">
              <div className="jar-card-heading">
                <div className="jar-graphic-center-box">
                  <DeferredJarGlassGraphic
                    percent={percent}
                    color={accentColor}
                    icon={jar.icon}
                    width={38}
                    height={46}
                    showPercent={false}
                  />
                </div>
                <div className="jar-card-heading__text">
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
                  <span className="jar-category-badge">
                    {jar.category || 'Mục tiêu'}
                  </span>
                </div>
              </div>

              {/* 3-dots dropdown */}
              <div className="jar-card-top-row__div--pos" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className={`jar-card-menu-btn ${activeMenuJarId === jar.id ? 'is-active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    menuTriggerRef.current = e.currentTarget;
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

            {/* Trạng thái tiến độ: huy hiệu ngay trên thẻ (thay cho khối "Tổng quan tiến độ" khi có ít hũ) */}
            {(status || isCompleted) && (
              <span className={`jar-status-badge jar-status-badge--${isCompleted ? 'done' : status.tone}`}>
                {isCompleted ? 'Đã đạt mục tiêu' : status.label}
              </span>
            )}

            {/* Số tiền và tiến độ */}
            <div className="jar-info-section">
              <div className="jar-amounts-row">
                <strong className="jar-current-amount">{formatCurrency(currentAmt)}</strong>
                <span className="jar-target-amount">{`/ ${formatCurrency(targetAmt)}`}</span>
              </div>

              <div className="jar-progress-track">
                <div
                  className={`jar-progress-fill${isCompleted ? ' is-complete' : ''} jar-progress-fill--box`}
                  style={{ '--jar-progress-fill-width': `${Math.max(percent > 0 ? 3 : 0, percent)}%` }}
                />
              </div>
              <span className="jar-progress-caption">
                {isCompleted ? `${percent}%` : `${percent}% · còn thiếu ${formatCurrency(remaining)}`}
              </span>
            </div>

            {/* Hạn mục tiêu */}
            <div className="jar-due-row" onClick={(e) => e.stopPropagation()}>
              {jar.targetDate ? (
                <>
                  <span>Đến hạn <strong>{formatDate(jar.targetDate, 'short')}</strong></span>
                  {dueNote && <span className="jar-due-note">{dueNote}</span>}
                </>
              ) : !isCompleted && (
                <button type="button" className="jar-due-link" onClick={() => handleEdit(jar)}>
                  Đặt ngày đến hạn
                </button>
              )}
            </div>

            {/* Hai hành động chính */}
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
