import React, { useState } from 'react';
import { useJarStore } from '../../stores/useJarStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useToastStore } from '../../stores/useToastStore';
import { RecurringModal } from './RecurringModal';
import { formatCurrency } from '../../utils/formatters';
import { EmptyState } from '../../components/ui/EmptyState';

const CYCLE_LABELS = {
  monthly: 'Hàng tháng',
  quarterly: 'Hàng quý (3 tháng)',
  yearly: 'Hàng năm'
};

export function RecurringTab() {
  const { installments, payInstallment, toggleInstallment, deleteInstallment, isLoading } = useJarStore();
  const { confirm } = useConfirmStore();
  const { addToast } = useToastStore();

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Calculate total monthly estimate
  const activeItems = (installments || []).filter((item) => item.active !== false);

  const monthlyEstimatedCost = activeItems.reduce((sum, item) => {
    const amt = Number(item.amount) || 0;
    if (item.cycle === 'yearly') return sum + amt / 12;
    if (item.cycle === 'quarterly') return sum + amt / 3;
    return sum + amt;
  }, 0);

  const handlePay = async (item) => {
    try {
      await payInstallment(item.id);
      addToast({
        type: 'success',
        message: `Đã đánh dấu thanh toán kỳ cho khoản "${item.name}" (${formatCurrency(item.amount)}).`,
        duration: 4000
      });
    } catch (err) {
      addToast({
        type: 'error',
        message: err.message || 'Không thể thanh toán khoản định kỳ.',
        duration: 4000
      });
    }
  };

  const handleToggle = async (item) => {
    try {
      await toggleInstallment(item.id);
      const isNowActive = item.active === false; // toggled
      addToast({
        type: 'info',
        message: isNowActive
          ? `Đã kích hoạt lại khoản "${item.name}".`
          : `Đã tạm dừng theo dõi khoản "${item.name}".`,
        duration: 3500
      });
    } catch (err) {
      addToast({
        type: 'error',
        message: err.message || 'Không thể đổi trạng thái khoản định kỳ.',
        duration: 4000
      });
    }
  };

  const handleDelete = async (item) => {
    const confirmed = await confirm({
      title: 'Xóa khoản định kỳ',
      message: `Bạn có chắc chắn muốn xóa khoản định kỳ "${item.name}" (${formatCurrency(item.amount)}) khỏi hệ thống?`,
      confirmText: 'Xóa khoản',
      cancelText: 'Hủy',
      confirmVariant: 'danger'
    });

    if (confirmed) {
      try {
        await deleteInstallment(item.id);
        addToast({
          type: 'success',
          message: `Đã xóa khoản định kỳ "${item.name}".`,
          duration: 4000
        });
      } catch (err) {
        addToast({
          type: 'error',
          message: err.message || 'Không thể xóa khoản định kỳ.',
          duration: 4000
        });
      }
    }
  };

  return (
    <div className="recurring-tab-container" role="region" aria-label="Khoản chi định kỳ và trả góp">
      {/* Overview Bar */}
      <div className="recurring-overview-bar">
        <div className="recurring-overview-stats">
          <div className="overview-stat-item">
            <span className="overview-stat-label">Chi phí cố định ước tính / tháng</span>
            <strong className="overview-stat-val text-primary">
              ~{formatCurrency(Math.round(monthlyEstimatedCost))}
            </strong>
          </div>

          <div className="overview-stat-divider" aria-hidden="true" />

          <div className="overview-stat-item">
            <span className="overview-stat-label">Khoản đang theo dõi</span>
            <strong className="overview-stat-val">
              {activeItems.length} / {installments.length} khoản
            </strong>
          </div>
        </div>

        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setIsModalOpen(true)}
        >
          <svg
            width="14"
            height="14"
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
          <span>Thêm khoản định kỳ</span>
        </button>
      </div>

      {/* Loading State */}
      {isLoading && installments.length === 0 && (
        <div className="wallets-loading">
          <span className="spinner" style={{ width: 24, height: 24, marginBottom: 8 }} />
          <p>Đang tải danh sách khoản định kỳ...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && installments.length === 0 && (
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
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <polyline points="9 16 12 19 15 16" />
            </svg>
          }
          title="Chưa có khoản định kỳ nào"
          description="Thiết lập các khoản thanh toán cố định (tiền nhà, internet, các gói subcription, trả góp) để hệ thống nhắc nhở tự động trước ngày đến hạn."
          actionLabel="+ Thêm khoản đầu tiên"
          onAction={() => setIsModalOpen(true)}
        />
      )}

      {/* Recurring Items Grid */}
      {!isLoading && installments.length > 0 && (
        <div className="recurring-cards-grid">
          {installments.map((item) => {
            const isActive = item.active !== false;
            const cycleText = CYCLE_LABELS[item.cycle] || 'Hàng tháng';

            return (
              <div
                key={item.id}
                className={`recurring-card-item ${!isActive ? 'is-paused' : ''}`}
              >
                {/* Header: Icon, Name, Badge */}
                <div className="recurring-card-header">
                  <div className="recurring-card-icon-box" aria-hidden="true">
                    {item.icon || '💳'}
                  </div>

                  <div className="recurring-card-info">
                    <h4 className="recurring-card-name">{item.name}</h4>
                    <span className="recurring-card-cycle-tag">{cycleText}</span>
                  </div>

                  <div className="recurring-card-badge-box">
                    <span className={`recurring-status-badge ${isActive ? 'badge-active' : 'badge-paused'}`}>
                      {isActive ? '● Đang chạy' : '○ Tạm dừng'}
                    </span>
                  </div>
                </div>

                {/* Amount & Due Date */}
                <div className="recurring-card-body">
                  <div className="recurring-card-amount-box">
                    <span className="recurring-amount-label">Số tiền mỗi kỳ:</span>
                    <strong className="recurring-amount-val">
                      {formatCurrency(item.amount)}
                    </strong>
                  </div>

                  <div className="recurring-card-due-box">
                    <span className="recurring-due-label">Hạn tiếp theo:</span>
                    <span className="recurring-due-val">
                      🗓️ {item.nextDueDate || 'Chưa định ngày'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="recurring-card-footer">
                  <button
                    type="button"
                    className="rec-action-btn rec-action-btn--pay"
                    onClick={() => handlePay(item)}
                    title="Đánh dấu đã thanh toán kỳ này"
                  >
                    ✓ Đã trả
                  </button>

                  <button
                    type="button"
                    className="rec-action-btn rec-action-btn--toggle"
                    onClick={() => handleToggle(item)}
                    title={isActive ? 'Tạm dừng nhắc nhở' : 'Kích hoạt lại'}
                  >
                    {isActive ? 'Tạm dừng' : 'Kích hoạt'}
                  </button>

                  <button
                    type="button"
                    className="rec-action-btn rec-action-btn--delete"
                    onClick={() => handleDelete(item)}
                    title="Xóa khoản định kỳ"
                    aria-label={`Xóa khoản định kỳ ${item.name}`}
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
                      aria-hidden="true"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Add Installment */}
      {isModalOpen && (
        <RecurringModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
