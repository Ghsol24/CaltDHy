import React, { useState, useEffect } from 'react';
import { useJarStore } from '../../stores/useJarStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useToastStore } from '../../stores/useToastStore';
import { JarModal } from './JarModal';
import { JarTransactionModal } from './JarTransactionModal';
import { formatCurrency, formatDate, formatPercent } from '../../utils/formatters';
import { EmptyState } from '../../components/ui/EmptyState';

export function JarsView() {
  const { jars, isLoading, fetchData, deleteJar } = useJarStore();
  const { confirm } = useConfirmStore();
  const { addToast } = useToastStore();

  const [isJarModalOpen, setIsJarModalOpen] = useState(false);
  const [editingJar, setEditingJar] = useState(null);

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [activeJar, setActiveJar] = useState(null);
  const [txAction, setTxAction] = useState('deposit'); // 'deposit' | 'withdraw'

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Overall totals
  const totalCurrent = jars.reduce((sum, j) => sum + (Number(j.current) || 0), 0);
  const totalTarget = jars.reduce((sum, j) => sum + (Number(j.target) || 0), 0);
  const totalPercent = totalTarget > 0 ? Math.min(100, Math.round((totalCurrent / totalTarget) * 100)) : 0;
  const completedJarsCount = jars.filter((j) => Number(j.current) >= Number(j.target)).length;

  const handleCreateNew = () => {
    setEditingJar(null);
    setIsJarModalOpen(true);
  };

  const handleEdit = (jar) => {
    setEditingJar(jar);
    setIsJarModalOpen(true);
  };

  const handleDeposit = (jar) => {
    setActiveJar(jar);
    setTxAction('deposit');
    setIsTxModalOpen(true);
  };

  const handleWithdraw = (jar) => {
    setActiveJar(jar);
    setTxAction('withdraw');
    setIsTxModalOpen(true);
  };

  const handleDelete = async (jar) => {
    const jarBalance = Number(jar.current || 0);
    const message = jarBalance > 0
      ? `Hũ "${jar.name}" hiện đang có ${formatCurrency(jarBalance)}. Nếu xóa hũ, khoản tiền này sẽ không còn được theo dõi trong danh sách hũ tiết kiệm. Bạn có chắc chắn muốn xóa không?`
      : `Bạn có chắc chắn muốn xóa hũ tiết kiệm "${jar.name}" không?`;

    const confirmed = await confirm({
      title: 'Xóa hũ tiết kiệm',
      message,
      confirmText: 'Xóa hũ',
      cancelText: 'Hủy',
      confirmVariant: 'danger'
    });

    if (confirmed) {
      try {
        await deleteJar(jar.id);
        addToast({
          type: 'success',
          message: `Đã xóa hũ "${jar.name}".`,
          duration: 4000
        });
      } catch (err) {
        addToast({
          type: 'error',
          message: err.message || 'Không thể xóa hũ tiết kiệm.',
          duration: 4000
        });
      }
    }
  };

  return (
    <div className="jars-feature-view" role="region" aria-label="Quản lý Hũ chi tiêu và Tiết kiệm">
      {/* ── 1. Header & Overview Card ── */}
      <div className="jars-overview-card">
        <div className="jars-overview-content">
          <div className="jars-overview-left">
            <div className="jars-overview-title-group">
              <span className="jars-overview-badge">🏺 Quỹ tích lũy & Tiết kiệm</span>
              <h2 className="jars-overview-heading">Hũ chi tiêu & Mục tiêu</h2>
              <p className="jars-overview-desc">
                Tách bạch các khoản tiết kiệm cho từng mục tiêu tài chính cụ thể mà không lo lẫn vào chi tiêu hàng ngày.
              </p>
            </div>

            {/* Metrics stats row */}
            <div className="jars-overview-stats-row">
              <div className="jars-stat-item">
                <span className="jars-stat-label">Tổng tiền đã tích lũy</span>
                <strong className="jars-stat-value text-primary">
                  {formatCurrency(totalCurrent)}
                </strong>
              </div>

              <div className="jars-stat-divider" aria-hidden="true" />

              <div className="jars-stat-item">
                <span className="jars-stat-label">Tổng mục tiêu</span>
                <strong className="jars-stat-value">
                  {formatCurrency(totalTarget)}
                </strong>
              </div>

              <div className="jars-stat-divider" aria-hidden="true" />

              <div className="jars-stat-item">
                <span className="jars-stat-label">Tiến độ hoàn thành</span>
                <strong className="jars-stat-value">
                  {formatPercent(totalPercent)} ({completedJarsCount}/{jars.length} hũ)
                </strong>
              </div>
            </div>

            {/* Global Large Progress Bar */}
            <div className="jars-global-progress-wrap">
              <div className="jars-global-progress-track">
                <div
                  className="jars-global-progress-fill"
                  style={{ width: `${Math.max(totalPercent > 0 ? 3 : 0, totalPercent)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="jars-overview-right">
            <button
              type="button"
              className="btn btn--primary jars-create-cta-btn"
              onClick={handleCreateNew}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Tạo hũ mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Loading State ── */}
      {isLoading && jars.length === 0 && (
        <div className="jars-loading-box">
          <span className="spinner" style={{ width: 26, height: 26, marginBottom: 10 }} />
          <p>Đang tải danh sách hũ tiết kiệm...</p>
        </div>
      )}

      {/* ── 3. Empty State ── */}
      {!isLoading && jars.length === 0 && (
        <EmptyState
          icon={
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 11V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v5" />
              <rect width="20" height="9" x="2" y="11" rx="2" />
              <line x1="12" y1="11" x2="12" y2="20" />
            </svg>
          }
          title="Chưa có hũ tiết kiệm nào"
          description="Tạo các hũ tiết kiệm như Quỹ khẩn cấp, Mua xe, Du lịch, Mua laptop để phân bổ tài chính thông minh và hoàn thành mục tiêu nhanh hơn."
          actionLabel="+ Tạo hũ tiết kiệm đầu tiên"
          onAction={handleCreateNew}
        />
      )}

      {/* ── 4. Jar Cards Grid ── */}
      {!isLoading && jars.length > 0 && (
        <div className="jars-cards-grid">
          {jars.map((jar) => {
            const currentAmt = Number(jar.current || 0);
            const targetAmt = Number(jar.target || 0);
            const percent = targetAmt > 0 ? Math.min(100, Math.round((currentAmt / targetAmt) * 100)) : 0;
            const remaining = Math.max(0, targetAmt - currentAmt);
            const isCompleted = targetAmt > 0 && currentAmt >= targetAmt;
            const accentColor = jar.color || '#078A59';

            return (
              <div
                key={jar.id}
                className={`jar-card-item ${isCompleted ? 'is-completed' : ''}`}
                style={{ '--jar-accent-color': accentColor }}
              >
                {/* Top Accent Stripe */}
                <div
                  className="jar-card-top-stripe"
                  style={{ backgroundColor: accentColor }}
                />

                <div className="jar-card-inner">
                  {/* Header: Icon, Name & Status Badges */}
                  <div className="jar-card-header">
                    <div className="jar-card-icon-title">
                      <div
                        className="jar-card-icon-box"
                        style={{ backgroundColor: `${accentColor}18` }}
                      >
                        <span>{jar.icon || '🫙'}</span>
                      </div>

                      <div className="jar-card-name-group">
                        <h4 className="jar-card-name" title={jar.name}>{jar.name}</h4>
                        {jar.targetDate ? (
                          <span className="jar-card-deadline-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect width="18" height="18" x="3" y="4" rx="2" />
                              <line x1="16" x2="16" y1="2" y2="6" />
                              <line x1="8" x2="8" y1="2" y2="6" />
                              <line x1="3" x2="21" y1="10" y2="10" />
                            </svg>
                            <span>Đến hạn: {formatDate(jar.targetDate, 'short')}</span>
                          </span>
                        ) : (
                          <span className="jar-card-deadline-tag">Mục tiêu linh hoạt</span>
                        )}
                      </div>
                    </div>

                    <div className="jar-card-badge-wrap">
                      {isCompleted ? (
                        <span className="jar-badge jar-badge--completed">
                          🎉 Hoàn thành
                        </span>
                      ) : (
                        <span
                          className="jar-badge jar-badge--percent"
                          style={{ color: accentColor, backgroundColor: `${accentColor}15` }}
                        >
                          {percent}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body: Amounts & Progress */}
                  <div className="jar-card-body">
                    <div className="jar-amounts-row">
                      <div className="jar-current-box">
                        <span className="jar-amount-label">Hiện có</span>
                        <strong className="jar-current-val text-primary">
                          {formatCurrency(currentAmt)}
                        </strong>
                      </div>

                      <div className="jar-target-box">
                        <span className="jar-amount-label">Mục tiêu</span>
                        <span className="jar-target-val">
                          {formatCurrency(targetAmt)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="jar-progress-track" aria-hidden="true">
                      <div
                        className="jar-progress-fill"
                        style={{
                          width: `${Math.max(percent > 0 ? 3 : 0, percent)}%`,
                          backgroundColor: accentColor
                        }}
                      />
                    </div>

                    <div className="jar-status-subtext">
                      {isCompleted ? (
                        <span className="text-positive">✓ Đã hoàn thành 100% mục tiêu!</span>
                      ) : (
                        <span className="text-muted">
                          Còn thiếu: <strong>{formatCurrency(remaining)}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="jar-card-footer">
                    <div className="jar-primary-actions">
                      <button
                        type="button"
                        className="jar-action-btn jar-action-btn--deposit"
                        onClick={() => handleDeposit(jar)}
                        title="Nạp tiền vào hũ"
                      >
                        <span>+ Nạp</span>
                      </button>

                      <button
                        type="button"
                        className="jar-action-btn jar-action-btn--withdraw"
                        onClick={() => handleWithdraw(jar)}
                        disabled={currentAmt <= 0}
                        title={currentAmt <= 0 ? 'Hũ chưa có tiền để rút' : 'Rút tiền từ hũ'}
                      >
                        <span>− Rút</span>
                      </button>
                    </div>

                    <div className="jar-secondary-actions">
                      <button
                        type="button"
                        className="jar-icon-action-btn jar-icon-action-btn--edit"
                        onClick={() => handleEdit(jar)}
                        title="Chỉnh sửa thông tin hũ"
                        aria-label={`Chỉnh sửa hũ ${jar.name}`}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        className="jar-icon-action-btn jar-icon-action-btn--delete"
                        onClick={() => handleDelete(jar)}
                        title="Xóa hũ tiết kiệm"
                        aria-label={`Xóa hũ ${jar.name}`}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 5. Modals ── */}
      {isJarModalOpen && (
        <JarModal
          isOpen={isJarModalOpen}
          onClose={() => setIsJarModalOpen(false)}
          jarToEdit={editingJar}
        />
      )}

      {isTxModalOpen && activeJar && (
        <JarTransactionModal
          isOpen={isTxModalOpen}
          onClose={() => {
            setIsTxModalOpen(false);
            setActiveJar(null);
          }}
          jar={activeJar}
          initialAction={txAction}
        />
      )}
    </div>
  );
}
