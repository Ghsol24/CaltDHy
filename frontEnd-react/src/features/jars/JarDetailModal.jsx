import React from 'react';
import { JarDialog } from './JarDialog';
import { formatCurrency, formatDate, formatPercent } from '../../utils/formatters';
import { JarGlassGraphic } from './JarGlassGraphic';
import { TargetOutlineIcon, CheckOutlineIcon } from '../../components/ui/AppIcons';

export function JarDetailModal({
  isOpen,
  onClose,
  jar,
  onDeposit,
  onWithdraw,
  onEdit
}) {
  if (!isOpen || !jar) return null;

  const currentAmt = Number(jar.current || 0);
  const targetAmt = Number(jar.target || 0);
  const percent = targetAmt > 0 ? Math.min(100, Math.round((currentAmt / targetAmt) * 100)) : 0;
  const remaining = Math.max(0, targetAmt - currentAmt);
  const isCompleted = targetAmt > 0 && currentAmt >= targetAmt;
  const accentColor = jar.color || '#5356F1';
  const history = Array.isArray(jar.history) ? jar.history : [];

  // Calculate days remaining & monthly savings roadmap
  let daysRemaining = null;
  let monthsRemaining = null;
  let dailyNeeded = 0;
  let weeklyNeeded = 0;
  let monthlyNeeded = 0;

  if (jar.targetDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetD = new Date(jar.targetDate);
    targetD.setHours(0, 0, 0, 0);
    const diffTime = targetD.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    daysRemaining = diffDays;

    if (diffDays > 0 && remaining > 0) {
      dailyNeeded = Math.round(remaining / diffDays);
      weeklyNeeded = Math.round(remaining / Math.max(1, diffDays / 7));
      monthsRemaining = Math.max(1, Math.round(diffDays / 30));
      monthlyNeeded = Math.round(remaining / monthsRemaining);
    }
  }

  return (
    <JarDialog isOpen={isOpen} onClose={onClose} title={jar.name}
      subtitle={jar.category || 'Mục tiêu tiết kiệm'} className="jar-detail-centered-dialog"
      footer={(
        <div className="jar-detail-footer">
          <button
            type="button"
            className="jar-detail-btn-edit"
            onClick={() => {
              onClose();
              onEdit(jar);
            }}
          >
            Chỉnh sửa hũ
          </button>

          <div className="jar-detail-footer__div--layout">
            <button
              type="button"
              className="jar-detail-btn-withdraw jar-detail-btn-withdraw--box"
              onClick={() => {
                onClose();
                onWithdraw(jar);
              }}
              disabled={currentAmt <= 0}
              style={{ '--jar-detail-btn-withdraw-cursor': currentAmt <= 0 ? 'not-allowed' : 'pointer', '--jar-detail-btn-withdraw-opacity': currentAmt <= 0 ? 0.5 : 1 }}
            >
              Rút tiền
            </button>

            <button
              type="button"
              className="jar-detail-btn-deposit"
              onClick={() => {
                onClose();
                onDeposit(jar);
              }}
            >
              + Nạp tiền
            </button>
          </div>
        </div>
      )}>
        {/* Modal Scrollable Content */}
        <div className="jar-detail-body">
          {/* Top Visual & Stats Banner */}
          <div className="jar-detail-stats-banner">
            <div className="jar-detail-stats-banner__div--layout">
              <span className="jar-detail-stats-banner__span--text">
                Số tiền hiện có
              </span>
              <span className="jar-detail-stats-banner__span--text2"
               
              >
                {formatCurrency(currentAmt)}
              </span>
              <span className="jar-detail-stats-banner__span--text3">
                Mục tiêu: <strong className="jar-detail-stats-banner__strong--tone">{formatCurrency(targetAmt)}</strong> ({formatPercent(percent)})
              </span>
            </div>

            <JarGlassGraphic
              percent={percent}
              color={accentColor}
              icon={jar.icon}
              width={70}
              height={84}
            />
          </div>

          {/* Progress Bar & Details */}
          <div className="jar-detail-body__div--layout">
            <div className="jar-detail-body__div--box"
             
            >
              <div className="jar-detail-body__div--box2"
                style={{ '--jar-detail-body__div-width': `${Math.max(percent > 0 ? 3 : 0, percent)}%`, '--jar-detail-body__div-background': isCompleted ? '#10B981' : accentColor }}
              />
            </div>
            <div className="jar-detail-body__div--layout2">
              <span>
                {isCompleted ? (
                  <strong className="jar-detail-body__strong--layout">
                    <CheckOutlineIcon size={13} />
                    <span>Đã hoàn thành 100% mục tiêu!</span>
                  </strong>
                ) : (
                  <span>Còn thiếu: <strong className="jar-detail-body__strong--tone">{formatCurrency(remaining)}</strong></span>
                )}
              </span>
              <span>
                {jar.targetDate ? (
                  <span>Đến hạn: <strong className="jar-detail-body__strong--tone">{formatDate(jar.targetDate, 'short')}</strong></span>
                ) : (
                  'Mục tiêu linh hoạt'
                )}
              </span>
            </div>
          </div>

          {/* Savings Roadmap Hint (If target date exists & not completed) */}
          {jar.targetDate && !isCompleted && daysRemaining > 0 && remaining > 0 && (
            <div className="jar-detail-roadmap-box">
              <div className="jar-detail-roadmap-box__div--layout">
                <TargetOutlineIcon size={15} />
                <span>Kế hoạch tích lũy gợi ý</span>
              </div>
              <p className="jar-detail-roadmap-box__p--text">
                Còn <strong className="jar-detail-roadmap-box__strong--tone">{daysRemaining} ngày</strong> nữa để về đích. Bạn có thể phân bổ:
              </p>
              <div className="jar-detail-roadmap-box__div--layout2">
                <div className="jar-detail-roadmap-box__div--box">
                  <span className="jar-detail-roadmap-box__span--text">Mỗi ngày</span>
                  <strong className="jar-detail-roadmap-box__strong--text">
                    {formatCurrency(dailyNeeded)}
                  </strong>
                </div>
                <div className="jar-detail-roadmap-box__div--box">
                  <span className="jar-detail-roadmap-box__span--text">Mỗi tuần</span>
                  <strong className="jar-detail-roadmap-box__strong--text">
                    {formatCurrency(weeklyNeeded)}
                  </strong>
                </div>
                <div className="jar-detail-roadmap-box__div--box">
                  <span className="jar-detail-roadmap-box__span--text">Mỗi tháng</span>
                  <strong className="jar-detail-roadmap-box__strong--text">
                    {formatCurrency(monthlyNeeded)}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Jar Specific Transaction History */}
          <div className="jar-detail-body__div--layout3">
            <div className="jar-detail-body__div--layout4">
              <h4 className="jar-detail-body__h4--text">
                Lịch sử nạp / rút ({history.length})
              </h4>
            </div>

            {history.length === 0 ? (
              <div className="jar-detail-body__div--box3">
                Hũ này chưa có giao dịch nạp hoặc rút nào.
              </div>
            ) : (
              <div className="jar-detail-body__div--layout5">
                {history.map((entry, idx) => {
                  const isDeposit = entry.type === 'deposit';
                  return (
                    <div
                      key={entry.id || idx}
                      className="jar-detail-history-item"
                    >
                      <div className="jar-detail-history-item__div--layout">
                        <span className="jar-detail-history-item__span--box"
                          style={{ '--jar-detail-history-item__span-background': isDeposit ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', '--jar-detail-history-item__span-color': isDeposit ? '#10B981' : '#EF4444' }}
                        >
                          {isDeposit ? '+' : '−'}
                        </span>
                        <div className="jar-detail-history-item__div--layout2">
                          <span className="jar-detail-history-item__span--text">
                            {entry.reason || (isDeposit ? 'Nạp tiền vào hũ' : 'Rút tiền từ hũ')}
                          </span>
                          <span className="jar-detail-history-item__span--text2">
                            {entry.date ? formatDate(entry.date, 'full') : '--'}
                          </span>
                        </div>
                      </div>

                      <strong className="jar-detail-history-item__strong--text"
                        style={{ '--jar-detail-history-item__strong-color': isDeposit ? '#10B981' : '#EF4444' }}
                      >
                        {isDeposit ? '+' : '−'}{formatCurrency(entry.amount)}
                      </strong>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

    </JarDialog>
  );
}
