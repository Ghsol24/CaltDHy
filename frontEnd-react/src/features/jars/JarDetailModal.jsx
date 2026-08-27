import React, { useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { formatCurrency, formatDate, formatPercent } from '../../utils/formatters';
import { JarGlassGraphic } from './JarGlassGraphic';

export function JarDetailModal({
  isOpen,
  onClose,
  jar,
  onDeposit,
  onWithdraw,
  onEdit
}) {
  const modalRef = useRef(null);
  useFocusTrap(modalRef, isOpen);

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
    <div
      className="modal-backdrop-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="jar-detail-modal-dialog"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết hũ ${jar.name}`}
        style={{
          background: '#FFFFFF',
          borderRadius: '18px',
          boxShadow: '0 20px 48px rgba(15, 23, 42, 0.16)',
          width: '94vw',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #E2E8F0'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FAFBFD'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: accentColor,
                background: `${accentColor}15`,
                padding: '3px 10px',
                borderRadius: '99px',
                letterSpacing: '0.04em'
              }}
            >
              {jar.category || 'MỤC TIÊU'}
            </span>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
              {jar.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '18px',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px'
            }}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Visual & Stats Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '14px',
              padding: '18px 22px',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
                Số tiền hiện có
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '24px',
                  fontWeight: 800,
                  color: '#0F172A'
                }}
              >
                {formatCurrency(currentAmt)}
              </span>
              <span style={{ fontSize: '13px', color: '#64748B' }}>
                Mục tiêu: <strong>{formatCurrency(targetAmt)}</strong> ({formatPercent(percent)})
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                height: '8px',
                background: '#F1F5F9',
                borderRadius: '99px',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${Math.max(percent > 0 ? 3 : 0, percent)}%`,
                  height: '100%',
                  background: isCompleted ? '#10B981' : accentColor,
                  borderRadius: '99px',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#64748B' }}>
              <span>
                {isCompleted ? (
                  <strong style={{ color: '#10B981' }}>✓ Đã hoàn thành 100% mục tiêu!</strong>
                ) : (
                  <span>Còn thiếu: <strong style={{ color: '#0F172A' }}>{formatCurrency(remaining)}</strong></span>
                )}
              </span>
              <span>
                {jar.targetDate ? (
                  <span>Đến hạn: <strong>{formatDate(jar.targetDate, 'short')}</strong></span>
                ) : (
                  'Mục tiêu linh hoạt'
                )}
              </span>
            </div>
          </div>

          {/* Savings Roadmap Hint (If target date exists & not completed) */}
          {jar.targetDate && !isCompleted && daysRemaining > 0 && remaining > 0 && (
            <div
              style={{
                background: 'rgba(83, 86, 241, 0.04)',
                border: '1px solid rgba(83, 86, 241, 0.15)',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#5356F1' }}>
                <span>🎯</span>
                <span>Kế hoạch tích lũy gợi ý</span>
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
                Còn <strong>{daysRemaining} ngày</strong> nữa để về đích. Bạn có thể phân bổ:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '2px' }}>
                <div style={{ background: '#FFFFFF', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>Mỗi ngày</span>
                  <strong style={{ fontSize: '12.5px', color: '#5356F1', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(dailyNeeded)}
                  </strong>
                </div>
                <div style={{ background: '#FFFFFF', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>Mỗi tuần</span>
                  <strong style={{ fontSize: '12.5px', color: '#5356F1', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(weeklyNeeded)}
                  </strong>
                </div>
                <div style={{ background: '#FFFFFF', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>Mỗi tháng</span>
                  <strong style={{ fontSize: '12.5px', color: '#5356F1', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(monthlyNeeded)}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Jar Specific Transaction History */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                Lịch sử nạp / rút ({history.length})
              </h4>
            </div>

            {history.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '12.5px', background: '#F8FAFC', borderRadius: '10px' }}>
                Hũ này chưa có giao dịch nạp hoặc rút nào.
              </div>
            ) : (
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {history.map((entry, idx) => {
                  const isDeposit = entry.type === 'deposit';
                  return (
                    <div
                      key={entry.id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: '#FAFBFD',
                        borderRadius: '8px',
                        border: '1px solid #EDF2F7'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 800,
                            background: isDeposit ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: isDeposit ? '#10B981' : '#EF4444'
                          }}
                        >
                          {isDeposit ? '+' : '−'}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#1E293B' }}>
                            {entry.reason || (isDeposit ? 'Nạp tiền vào hũ' : 'Rút tiền từ hũ')}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                            {entry.date ? formatDate(entry.date, 'full') : '--'}
                          </span>
                        </div>
                      </div>

                      <strong
                        style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: '13.5px',
                          fontWeight: 700,
                          color: isDeposit ? '#10B981' : '#EF4444'
                        }}
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

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FAFBFD',
            gap: '10px'
          }}
        >
          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(jar);
            }}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Chỉnh sửa hũ
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                onClose();
                onWithdraw(jar);
              }}
              disabled={currentAmt <= 0}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 600,
                cursor: currentAmt <= 0 ? 'not-allowed' : 'pointer',
                opacity: currentAmt <= 0 ? 0.5 : 1
              }}
            >
              Rút tiền
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onDeposit(jar);
              }}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: 'none',
                background: '#5356F1',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              + Nạp tiền
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
