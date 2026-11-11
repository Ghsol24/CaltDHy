import React from 'react';
import { Icon, JarOutlineIcon } from '../../../components/ui/AppIcons';
import { formatCurrency, formatPercent } from '../../../utils/formatters';

export function JarsListView({ handleCreateNew, handleDeposit, handleEdit, handleOpenDetail, handleWithdraw, isLoading, jars, viewMode, visibleJars }) {
  return (!isLoading && jars.length > 0 && viewMode === 'list' && (
    <div className="jars-list-mode-container">
      {visibleJars.map((jar) => {
        const currentAmt = Number(jar.current || 0);
        const targetAmt = Number(jar.target || 0);
        const percent = targetAmt > 0 ? Math.min(100, Math.round((currentAmt / targetAmt) * 100)) : 0;
        const remaining = Math.max(0, targetAmt - currentAmt);
        const accentColor = jar.color || '#5356F1';
  
        return (
          <div
            key={jar.id}
            className="jar-list-mode-row"
            style={{ '--jar-accent-color': accentColor }}
            onClick={() => handleOpenDetail(jar)}
          >
            <div className="jar-list-left">
              <span className="jar-list-icon" aria-hidden="true">
                <JarOutlineIcon size={20} color="currentColor" />
              </span>
              <div className="jar-list-text">
                <div className="jar-list-title-row">
                  <button
                    type="button"
                    className="jar-open-detail-btn"
                    aria-label={`Xem chi tiết hũ ${jar.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDetail(jar);
                    }}
                  >
                    <strong className="jar-list-name">{jar.name}</strong>
                  </button>
                  <span className="jar-list-badge">
                    {jar.category || 'MỤC TIÊU'}
                  </span>
                </div>
                <span className="jar-list-sub">
                  Còn thiếu: {formatCurrency(remaining)}
                </span>
              </div>
            </div>
  
            <div className="jar-list-center">
              <div className="jar-list-progress-head">
                <span><strong>{formatCurrency(currentAmt)}</strong> / {formatCurrency(targetAmt)}</span>
                <strong className="jar-list-percent">{formatPercent(percent)}</strong>
              </div>
              <div className="jar-list-track">
                <div className="jar-list-fill jar-list-fill--box" style={{ '--jar-list-fill-width': `${Math.max(percent > 0 ? 3 : 0, percent)}%` }} />
              </div>
            </div>
  
            <div className="jar-list-right" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="jar-btn-deposit"
                onClick={() => handleDeposit(jar)}
              >
                + Nạp
              </button>
              <button
                type="button"
                className="jar-btn-withdraw"
                onClick={() => handleWithdraw(jar)}
                disabled={currentAmt <= 0}
              >
                Rút
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
  
      {/* Row "+ Tạo hũ mới" (Dashed Border) in List Mode */}
      <button type="button" className="jar-list-mode-add-row" onClick={handleCreateNew}>
        <div className="jar-list-mode-add-icon">+</div>
        <div>
          <span className="jar-list-mode-add-title">Tạo hũ mới</span>
          <span className="jar-list-mode-add-desc">— Bắt đầu một mục tiêu mới ngay hôm nay</span>
        </div>
      </button>
    </div>
  )) || null;
}
