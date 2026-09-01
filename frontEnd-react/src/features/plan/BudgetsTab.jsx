import React, { useState, useMemo } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { BudgetEditModal } from './BudgetEditModal';
import { calculateMonthlyStats, getBudgetStatus } from '../../utils/financeMath';
import { formatCurrency, formatPercent, formatDate, getLocalMonthString } from '../../utils/formatters';
import { getCategoryIcon } from '../../utils/categories';

export function BudgetsTab() {
  const { selectedMonth, setSelectedMonth } = useSpendingStore();
  const { transactions, budgets, expenseCategories } = useTransactionStore();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCategoryToEdit, setSelectedCategoryToEdit] = useState(null);

  // Month navigation
  const currentMonthStr = selectedMonth || getLocalMonthString();

  const handlePrevMonth = () => {
    const [y, m] = currentMonthStr.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    setSelectedMonth(getLocalMonthString(date));
  };

  const handleNextMonth = () => {
    const [y, m] = currentMonthStr.split('-').map(Number);
    const date = new Date(y, m, 1);
    setSelectedMonth(getLocalMonthString(date));
  };

  const handleResetToCurrentMonth = () => {
    setSelectedMonth(getLocalMonthString());
  };

  // Compute monthly stats for selected month
  const monthlyStats = calculateMonthlyStats(transactions, currentMonthStr);

  // Gather categories to display
  const allCategoryNames = useMemo(() => {
    const activeNames = (expenseCategories || []).map((c) => c.name);
    const set = new Set([
      ...activeNames,
      ...Object.keys(monthlyStats.byCategory || {})
    ]);
    return Array.from(set);
  }, [expenseCategories, monthlyStats.byCategory]);

  let totalBudgetLimit = 0;
  let totalBudgetSpent = 0;
  let hasAnyLimit = false;

  const categoryBudgets = allCategoryNames.map((catName) => {
    const rawLimit = budgets && budgets[catName] !== undefined ? Number(budgets[catName]) : null;
    const limit = rawLimit && rawLimit > 0 ? rawLimit : null;
    const spent = monthlyStats.byCategory[catName] || 0;
    const status = getBudgetStatus(spent, limit || 0);

    if (limit !== null) {
      totalBudgetLimit += limit;
      totalBudgetSpent += spent;
      hasAnyLimit = true;
    }

    return {
      category: catName,
      limit,
      spent,
      percent: limit ? status.percent : 0,
      remaining: limit ? status.remaining : null,
      status: status.status,
      isOver: limit ? status.isOver : false,
      hasLimit: limit !== null,
      icon: getCategoryIcon(catName, 'expense')
    };
  });

  // Sort: Categories with limits first (danger -> warning -> normal), then without limits
  categoryBudgets.sort((a, b) => {
    if (a.hasLimit && !b.hasLimit) return -1;
    if (!a.hasLimit && b.hasLimit) return 1;
    if (a.hasLimit && b.hasLimit) {
      return b.percent - a.percent;
    }
    return b.spent - a.spent;
  });

  const totalBudgetRemaining = hasAnyLimit ? totalBudgetLimit - totalBudgetSpent : null;
  const overallPercent = hasAnyLimit && totalBudgetLimit > 0
    ? Math.round((totalBudgetSpent / totalBudgetLimit) * 100)
    : null;

  // Hướng A: Chỉ hiển thị các danh mục đã đặt hạn mức HOẶC đã có phát sinh chi tiêu trong tháng
  const visibleCategories = useMemo(() => {
    return categoryBudgets.filter((item) => item.hasLimit || item.spent > 0);
  }, [categoryBudgets]);

  // Danh mục CHƯA đặt hạn mức nhưng vẫn phát sinh chi tiêu trong tháng.
  // Khoản này không được cộng vào totalBudgetLimit/totalBudgetSpent ở trên,
  // nên "Đã chi trong tháng" / "Đã vượt ngân sách" phía trên KHÔNG phải là tổng
  // chi tiêu thật của cả tháng — cần công khai phần chênh lệch này cho người dùng thấy.
  const unbudgetedCategories = useMemo(() => {
    return categoryBudgets.filter((item) => !item.hasLimit && item.spent > 0);
  }, [categoryBudgets]);
  const unbudgetedTotal = unbudgetedCategories.reduce((sum, item) => sum + item.spent, 0);

  const handleOpenEdit = (category = null) => {
    setSelectedCategoryToEdit(category);
    setIsEditModalOpen(true);
  };

  // Display human readable month label
  const monthDateObj = new Date(`${currentMonthStr}-01`);
  const monthDisplayLabel = formatDate(monthDateObj, 'month');

  return (
    <div className="budgets-tab-container" role="region" aria-label="Quản lý ngân sách">
      {/* ── Page Header: Title, Subtitle, and Primary Action ── */}
      <div className="budgets-page-header">
        <div className="budgets-header-titles">
          <h2 className="budgets-view-title">Ngân sách</h2>
          <p className="budgets-view-subtitle">
            Lập kế hoạch chi tiêu thông minh và kiểm soát tài chính hiệu quả
          </p>
        </div>

        <button
          type="button"
          className="btn-setup-budget-primary"
          onClick={() => handleOpenEdit(null)}
          aria-label="Thiết lập hạn mức ngân sách"
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
          <span>Thiết lập hạn mức</span>
        </button>
      </div>

      {/* ── Month Selector Bar ── */}
      <div className="budgets-month-bar">
        <div className="budget-month-selector" role="group" aria-label="Chọn tháng ngân sách">
          <button
            type="button"
            className="month-nav-btn"
            onClick={handlePrevMonth}
            aria-label="Xem tháng trước"
            title="Tháng trước"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div className="month-current-display" aria-live="polite">
            <span className="month-icon" aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
            </span>
            <strong className="month-name-text">{monthDisplayLabel}</strong>
          </div>

          <button
            type="button"
            className="month-nav-btn"
            onClick={handleNextMonth}
            aria-label="Xem tháng sau"
            title="Tháng sau"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {currentMonthStr !== getLocalMonthString() && (
            <button
              type="button"
              className="month-today-btn"
              onClick={handleResetToCurrentMonth}
              aria-label="Quay về tháng hiện tại"
            >
              Về tháng này
            </button>
          )}
        </div>
      </div>

      {/* ── 4 Equal Cells Summary Card ── */}
      <div className="budget-overview-card">
        <div className="budget-overview-grid">
          {/* Cell 1: Tổng hạn mức */}
          <div className="budget-ov-item">
            <span className="budget-ov-label">Tổng hạn mức</span>
            <strong className={`budget-ov-value ${!hasAnyLimit ? 'is-unset-text' : 'is-brand'}`}>
              {hasAnyLimit ? formatCurrency(totalBudgetLimit) : 'Chưa thiết lập'}
            </strong>
          </div>

          <div className="budget-ov-divider" aria-hidden="true" />

          {/* Cell 2: Đã chi (chỉ tính danh mục có hạn mức) */}
          <div className="budget-ov-item">
            <span
              className="budget-ov-label"
              title="Chỉ cộng chi tiêu của các danh mục đã đặt hạn mức bên dưới — không phải tổng chi tiêu cả tháng"
            >
              Đã chi (có hạn mức)
            </span>
            <strong className="budget-ov-value text-danger">
              {formatCurrency(totalBudgetSpent)}
            </strong>
          </div>

          <div className="budget-ov-divider" aria-hidden="true" />

          {/* Cell 3: Còn lại khả dụng */}
          <div className="budget-ov-item">
            <span className="budget-ov-label">
              {hasAnyLimit && totalBudgetRemaining !== null && totalBudgetRemaining < 0
                ? 'Đã vượt ngân sách'
                : 'Còn lại khả dụng'}
            </span>
            <strong
              className={`budget-ov-value ${
                !hasAnyLimit
                  ? 'is-dash'
                  : totalBudgetRemaining !== null && totalBudgetRemaining < 0
                  ? 'text-danger'
                  : 'text-brand'
              }`}
            >
              {hasAnyLimit && totalBudgetRemaining !== null
                ? formatCurrency(Math.abs(totalBudgetRemaining))
                : '—'}
            </strong>
          </div>

          <div className="budget-ov-divider" aria-hidden="true" />

          {/* Cell 4: Tỷ lệ đã dùng */}
          <div className="budget-ov-item">
            <span className="budget-ov-label">Tỷ lệ đã dùng</span>
            <strong
              className={`budget-ov-value ${
                !hasAnyLimit
                  ? 'is-dash'
                  : overallPercent !== null && overallPercent >= 100
                  ? 'text-danger'
                  : overallPercent !== null && overallPercent >= 80
                  ? 'text-warning'
                  : 'text-brand'
              }`}
            >
              {hasAnyLimit && overallPercent !== null ? formatPercent(overallPercent) : '—'}
            </strong>
          </div>
        </div>

        {/* Global Progress Bar */}
        {hasAnyLimit && overallPercent !== null && (
          <div className="budget-global-progress-bar-bg" aria-hidden="true">
            <div
              className={`budget-global-progress-bar-fill ${
                overallPercent >= 100
                  ? 'fill-danger'
                  : overallPercent >= 80
                  ? 'fill-warning'
                  : 'fill-brand'
              }`}
              style={{ width: `${Math.min(100, overallPercent)}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Disclosure: chi tiêu ở các danh mục CHƯA đặt hạn mức ── */}
      {unbudgetedTotal > 0 && (
        <div className="budget-unbudgeted-note" role="status">
          <span className="budget-unbudgeted-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <p className="budget-unbudgeted-text">
            Số liệu ở trên chỉ tính {categoryBudgets.filter((c) => c.hasLimit).length} danh mục đã đặt hạn mức.
            Ngoài ra bạn đã chi thêm{' '}
            <strong>{formatCurrency(unbudgetedTotal)}</strong> ở{' '}
            {unbudgetedCategories.length} danh mục chưa đặt hạn mức
            {' '}({unbudgetedCategories.map((c) => c.category).join(', ')})
            {' '}— khoản này chưa được tính vào &quot;Đã vượt ngân sách&quot; ở trên.
          </p>
        </div>
      )}

      {/* ── Category Breakdown Grid Section ── */}
      <div className="budget-categories-list-section">
        <div className="budget-section-header-row">
          <h3 className="budget-section-heading">
            Chi tiết ngân sách từng danh mục ({monthDisplayLabel})
          </h3>
          <button
            type="button"
            className="btn-edit-all-budgets"
            onClick={() => handleOpenEdit(null)}
            aria-label="Chỉnh sửa toàn bộ hạn mức ngân sách"
            title="Chỉnh sửa toàn bộ hạn mức"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
            <span>Chỉnh sửa toàn bộ</span>
          </button>
        </div>

        {/* First-use informational alert (When zero visible categories exist in the active month) */}
        {visibleCategories.length === 0 && (
          <div className="budget-empty-alert" role="status">
            <div className="alert-bulb-icon" aria-hidden="true">💡</div>
            <p className="alert-bulb-text">
              Tháng này chưa có danh mục nào được đặt hạn mức hoặc phát sinh chi tiêu. Hãy bấm nút <strong>"Thiết lập hạn mức"</strong> để bắt đầu quản lý ngân sách!
            </p>
          </div>
        )}

        {/* 4 Columns Category Cards Grid */}
        <div className="budget-categories-grid">
          {visibleCategories.map((item) => {
            const hasLimit = item.hasLimit;
            const isDanger = item.status === 'danger' || (hasLimit && item.percent >= 100);
            const isWarning = item.status === 'warning' || (hasLimit && item.percent >= 80 && item.percent < 100);
            const barWidth = hasLimit ? Math.min(100, item.percent) : 0;

            // Semantic status label per spec:
            // unset: Chưa đặt hạn mức
            // limited, <80%: Còn lại: ...
            // limited, 80-100%: Sắp chạm hạn mức
            // limited, >100%: Vượt hạn mức: ...
            let statusBadgeText = 'Chưa đặt hạn mức';
            let statusBadgeCls = 'badge-unset';

            if (hasLimit) {
              if (item.percent >= 100) {
                statusBadgeText = `Vượt hạn mức: ${formatCurrency(Math.abs(item.remaining || 0))}`;
                statusBadgeCls = 'badge-danger';
              } else if (item.percent >= 80) {
                statusBadgeText = `Sắp chạm hạn mức (${formatPercent(item.percent)})`;
                statusBadgeCls = 'badge-warning';
              } else {
                statusBadgeText = `Còn lại: ${formatCurrency(item.remaining || 0)}`;
                statusBadgeCls = 'badge-brand';
              }
            }

            return (
              <div
                key={item.category}
                className={`budget-category-card ${
                  isDanger ? 'is-danger' : isWarning ? 'is-warning' : hasLimit ? 'is-limited' : 'is-unset'
                }`}
                role="button"
                tabIndex={0}
                onClick={() => handleOpenEdit(item.category)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenEdit(item.category);
                  }
                }}
                aria-label={`Thiết lập hạn mức cho ${item.category}`}
                title={`Bấm để thiết lập hạn mức cho ${item.category}`}
              >
                {/* Header: 40px Emoji tile & Category Title */}
                <div className="budget-card-top">
                  <div className="budget-card-lead">
                    <div className="budget-card-emoji-tile" aria-hidden="true">
                      {item.icon}
                    </div>
                    <div className="budget-card-titles">
                      <h4 className="budget-card-name" title={item.category}>
                        {item.category}
                      </h4>
                      <span className="budget-card-spent">
                        Đã chi: <strong>{formatCurrency(item.spent)}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Body: Semantic status label */}
                <div className="budget-card-body">
                  <span className={`budget-card-status-badge ${statusBadgeCls}`}>
                    {statusBadgeText}
                  </span>
                  {hasLimit && (
                    <span className="budget-card-limit-val">
                      Hạn mức: {formatCurrency(item.limit)}
                    </span>
                  )}
                </div>

                {/* Bottom: Progress track */}
                <div className="budget-card-track" aria-hidden="true">
                  <div
                    className={`budget-card-fill ${
                      !hasLimit
                        ? 'fill-unset'
                        : isDanger
                        ? 'fill-danger'
                        : isWarning
                        ? 'fill-warning'
                        : 'fill-brand'
                    }`}
                    style={{ width: `${hasLimit ? barWidth : 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Modal Setup / Edit Budgets ── */}
      {isEditModalOpen && (
        <BudgetEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedCategoryToEdit(null);
          }}
          initialCategory={selectedCategoryToEdit}
        />
      )}
    </div>
  );
}
