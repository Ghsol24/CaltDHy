import React from 'react';
import { AlertTriangleOutlineIcon, CheckOutlineIcon, TargetOutlineIcon, TrophyOutlineIcon } from '../../../components/ui/AppIcons';
import { formatCurrency, formatPercent } from '../../../utils/formatters';

export function JarsProgressSection({ handleDeposit, navigateTo, progressOverview }) {
  return (
    <section id="jars-section-progress" className="jars-progress-overview-section">
      <div className="jars-section-header-row">
        <h2 className="jars-section-title">
          <TargetOutlineIcon size={20} />
          <span>Tổng quan tiến độ</span>
        </h2>
        <button
          type="button"
          className="jars-section-action-link"
          onClick={() => navigateTo('jars', 'jars')}
        >
          <span>Xem chi tiết</span>
          <span>→</span>
        </button>
      </div>
    
      <div className="jars-status-cards-grid">
        {/* 1. Gần đạt nhất */}
        <div className="jars-status-card jars-status-card--closest">
          <div className="jars-status-card-header">
            <div className="jars-status-card-header-left">
              <TrophyOutlineIcon size={16} />
              <span>Gần đạt nhất</span>
            </div>
          </div>
          <div className="jars-status-card-body">
            {progressOverview.closest ? (
              <>
                <div className="jars-status-jar-row">
                  <span>{progressOverview.closest.name}</span>
                  <span className="jars-status-jar-percent">
                    {formatPercent(
                      Math.round(
                        ((Number(progressOverview.closest.current) || 0) /
                          (Number(progressOverview.closest.target) || 1)) *
                          100
                      )
                    )}
                  </span>
                </div>
                <div className="jars-status-track">
                  <div
                    className="jars-status-fill jars-status-fill--closest jars-status-fill--box"
                    style={{ '--jars-status-fill-width': `${Math.min(
                        100,
                        Math.round(
                          ((Number(progressOverview.closest.current) || 0) /
                            (Number(progressOverview.closest.target) || 1)) *
                            100
                        )
                      )}%` }}
                  />
                </div>
                <span className="jars-status-subtext">
                  Còn{' '}
                  <strong>
                    {formatCurrency(
                      Math.max(
                        0,
                        (Number(progressOverview.closest.target) || 0) -
                          (Number(progressOverview.closest.current) || 0)
                      )
                    )}
                  </strong>{' '}
                  để đạt mục tiêu
                </span>
              </>
            ) : (
              <span className="jars-status-empty-text">Chưa có mục tiêu nào được tạo.</span>
            )}
          </div>
        </div>
    
        {/* 2. Đang đúng tiến độ */}
        <div className="jars-status-card jars-status-card--ontrack">
          <div className="jars-status-card-header">
            <div className="jars-status-card-header-left">
              <TargetOutlineIcon size={16} />
              <span>Đang đúng tiến độ</span>
            </div>
            {progressOverview.onTrack.length > 0 && (
              <span className="jars-status-tag jars-status-tag--ontrack">
                {progressOverview.onTrack.length} mục tiêu
              </span>
            )}
          </div>
          <div className="jars-status-card-body">
            {progressOverview.onTrack.length > 0 ? (
              <>
                <div className="jars-status-jar-row">
                  <span>{progressOverview.onTrack[0].name}</span>
                  <span className="jars-status-jar-percent jars-status-jar-percent--tone">
                    {formatPercent(
                      Math.round(
                        ((Number(progressOverview.onTrack[0].current) || 0) /
                          (Number(progressOverview.onTrack[0].target) || 1)) *
                          100
                      )
                    )}
                  </span>
                </div>
                <div className="jars-status-track">
                  <div
                    className="jars-status-fill jars-status-fill--ontrack jars-status-fill--box"
                    style={{ '--jars-status-fill-width': `${Math.min(
                        100,
                        Math.round(
                          ((Number(progressOverview.onTrack[0].current) || 0) /
                            (Number(progressOverview.onTrack[0].target) || 1)) *
                            100
                        )
                      )}%` }}
                  />
                </div>
                <span className="jars-status-subtext">
                  Đã tích lũy{' '}
                  <strong>{formatCurrency(Number(progressOverview.onTrack[0].current) || 0)}</strong> / {formatCurrency(Number(progressOverview.onTrack[0].target) || 0)}
                </span>
              </>
            ) : (
              <div className="jars-status-card-body__div--layout">
                <span className="jars-status-tag jars-status-tag--ontrack jars-status-tag--layout">
                  Đang theo dõi
                </span>
                <span className="jars-status-empty-text">
                  Hãy nạp tiền vào các hũ để ghi nhận đà tăng trưởng!
                </span>
              </div>
            )}
          </div>
        </div>
    
        {/* 3. Cần chú ý */}
        <div className="jars-status-card jars-status-card--attention">
          <div className="jars-status-card-header">
            <div className="jars-status-card-header-left">
              <AlertTriangleOutlineIcon size={16} />
              <span>Cần chú ý</span>
            </div>
            {progressOverview.needsAttention.length > 0 && (
              <span className="jars-status-tag jars-status-tag--attention">
                {progressOverview.needsAttention.length} mục tiêu
              </span>
            )}
          </div>
          <div className="jars-status-card-body">
            {progressOverview.needsAttention.length > 0 ? (
              <>
                <div className="jars-status-jar-row">
                  <span>{progressOverview.needsAttention[0].jar.name}</span>
                  <span className="jars-status-tag jars-status-tag--attention">
                    {progressOverview.needsAttention[0].reason}
                  </span>
                </div>
                <span className="jars-status-subtext jars-status-subtext--tone">
                  Còn thiếu <strong>{formatCurrency(progressOverview.needsAttention[0].missing)}</strong> để đạt mục tiêu.
                </span>
                <button
                  type="button"
                  className="jars-status-action-btn"
                  onClick={() => handleDeposit(progressOverview.needsAttention[0].jar)}
                >
                  <span>+ Nạp ngay</span>
                </button>
              </>
            ) : (
              <div className="jars-status-card-body__div--layout">
                <span className="jars-status-tag jars-status-tag--safe jars-status-tag--layout2">
                  <CheckOutlineIcon size={12} />
                  <span>Chưa có cảnh báo tiến độ</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
