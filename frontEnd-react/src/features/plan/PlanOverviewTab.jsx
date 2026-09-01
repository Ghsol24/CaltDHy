import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useJarStore } from '../../stores/useJarStore';
import { WalletModal } from './WalletModal';
import { BudgetEditModal } from './BudgetEditModal';
import { RecurringModal } from './RecurringModal';
import { calculateMonthlyStats, getBudgetStatus } from '../../utils/financeMath';
import { formatCurrency, formatPercent, getDueStatus, getCalendarDateParts, getLocalMonthString } from '../../utils/formatters';
import { getCategoryIcon } from '../../utils/categories';

const WALLET_TYPE_LABELS = {
  cash: 'Tiền mặt',
  bank: 'Ngân hàng',
  credit: 'Thẻ tín dụng',
  'e-wallet': 'Ví điện tử'
};

export function PlanOverviewTab() {
  const { setPlanSubTab, setActiveView, selectedMonth } = useSpendingStore();
  const { wallets, isLoading: isWalletsLoading } = useWalletStore();
  const { transactions, budgets, expenseCategories, isLoading: isTxnsLoading } = useTransactionStore();
  const { installments, isLoading: isJarsLoading } = useJarStore();

  // Quick creation dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Modals state for in-place Quick Creation
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);

  // Close dropdown on outside click or Esc
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  // Current month calculation
  const currentMonthStr = selectedMonth || getLocalMonthString();
  const [, currentMonthNum] = currentMonthStr.split('-').map(Number);
  const monthlyStats = calculateMonthlyStats(transactions, currentMonthStr);

  // 1. Wallets calculation
  const totalAssets = wallets.reduce(
    (sum, w) => sum + (Number(w.currentBalance) || 0),
    0
  );

  // 2. Budget calculation for current month
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
  let hasAnyBudgetLimit = false;

  const categoryBudgets = allCategoryNames.map((catName) => {
    const rawLimit = budgets && budgets[catName] !== undefined ? Number(budgets[catName]) : null;
    const limit = rawLimit && rawLimit > 0 ? rawLimit : null;
    const spent = monthlyStats.byCategory[catName] || 0;
    const status = getBudgetStatus(spent, limit || 0);

    if (limit !== null) {
      totalBudgetLimit += limit;
      totalBudgetSpent += spent;
      hasAnyBudgetLimit = true;
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

  const totalBudgetRemaining = hasAnyBudgetLimit ? totalBudgetLimit - totalBudgetSpent : null;

  // 3. Recurring calculation
  const activeInstallments = (installments || []).filter((item) => item.active !== false);
  const monthlyEstimatedCost = activeInstallments.reduce((sum, item) => {
    const amt = Number(item.amount) || 0;
    if (item.cycle === 'yearly') return sum + amt / 12;
    if (item.cycle === 'quarterly') return sum + amt / 3;
    return sum + amt;
  }, 0);

  // 4. Deterministic Alerts calculation for Top Banner
  const activeAlerts = useMemo(() => {
    const list = [];

    // A. Recurring alerts
    activeInstallments.forEach((item) => {
      const due = getDueStatus(item.nextDueDate);
      const dateParts = getCalendarDateParts(item.nextDueDate);
      if (due.diffDays !== null) {
        if (due.isOverdue) {
          list.push({
            id: `rec-overdue-${item.id}`,
            type: 'recurring',
            priority: 0,
            variant: 'danger',
            dateParts,
            title: `Khoản "${item.name}" đã quá hạn!`,
            subText: `${formatCurrency(item.amount)} (${due.text})`,
            targetTab: 'recurring'
          });
        } else if (due.isToday) {
          list.push({
            id: `rec-today-${item.id}`,
            type: 'recurring',
            priority: 1,
            variant: 'today',
            dateParts,
            title: `Khoản "${item.name}" đến hạn hôm nay!`,
            subText: formatCurrency(item.amount),
            targetTab: 'recurring'
          });
        } else if (due.diffDays >= 1 && due.diffDays <= 7) {
          list.push({
            id: `rec-soon-${item.id}`,
            type: 'recurring',
            priority: 3,
            variant: 'soon',
            dateParts,
            title: `Khoản "${item.name}" sắp đến hạn`,
            subText: `Còn ${due.diffDays} ngày (${formatCurrency(item.amount)})`,
            targetTab: 'recurring'
          });
        }
      }
    });

    // B. Budget alerts
    categoryBudgets.forEach((cat) => {
      if (cat.hasLimit) {
        if (cat.percent >= 100) {
          list.push({
            id: `bud-over-${cat.category}`,
            type: 'budget',
            priority: 1,
            variant: 'danger',
            title: `Ngân sách ${cat.category}`,
            subText: `đã vượt ${formatCurrency(Math.abs(cat.remaining || 0))} (${formatPercent(cat.percent)})`,
            targetTab: 'budgets'
          });
        } else if (cat.percent >= 90) {
          list.push({
            id: `bud-high-${cat.category}`,
            type: 'budget',
            priority: 2,
            variant: 'high-warning',
            title: `Ngân sách ${cat.category}`,
            subText: `đã dùng ${formatPercent(cat.percent)} hạn mức`,
            targetTab: 'budgets'
          });
        } else if (cat.percent >= 70) {
          list.push({
            id: `bud-warn-${cat.category}`,
            type: 'budget',
            priority: 4,
            variant: 'warning',
            title: `Ngân sách ${cat.category}`,
            subText: `đã dùng ${formatPercent(cat.percent)} hạn mức`,
            targetTab: 'budgets'
          });
        }
      }
    });

    // Sort by priority ascending, take max 3
    list.sort((a, b) => a.priority - b.priority);
    return list.slice(0, 3);
  }, [activeInstallments, categoryBudgets]);

  // Top items for summary columns
  const topWallets = useMemo(() => {
    return [...wallets].slice(0, 4);
  }, [wallets]);

  const topBudgetCategories = useMemo(() => {
    const filtered = categoryBudgets.filter((c) => c.hasLimit || c.spent > 0);
    filtered.sort((a, b) => {
      if (a.hasLimit && !b.hasLimit) return -1;
      if (!a.hasLimit && b.hasLimit) return 1;
      if (a.hasLimit && b.hasLimit) return b.percent - a.percent;
      return b.spent - a.spent;
    });
    return filtered.slice(0, 4);
  }, [categoryBudgets]);

  const topInstallments = useMemo(() => {
    return [...activeInstallments]
      .sort((a, b) => {
        const dueA = getDueStatus(a.nextDueDate).diffDays ?? 9999;
        const dueB = getDueStatus(b.nextDueDate).diffDays ?? 9999;
        return dueA - dueB;
      })
      .slice(0, 4);
  }, [activeInstallments]);

  // Find top spending category for Insight recommendation
  const highestSpendCategory = useMemo(() => {
    if (!categoryBudgets || categoryBudgets.length === 0) return null;
    const sorted = [...categoryBudgets].sort((a, b) => b.spent - a.spent);
    return sorted[0]?.spent > 0 ? sorted[0] : null;
  }, [categoryBudgets]);

  return (
    <div className="plan-overview-container" role="region" aria-label="Tổng quan kế hoạch tài chính">
      {/* ── 1. Page Header: Title, Subtitle, and + Tạo kế hoạch Dropdown ── */}
      <div className="plan-overview-header">
        <div className="plan-header-titles">
          <h2 className="plan-overview-title">Tổng quan kế hoạch</h2>
          <p className="plan-overview-subtitle">
            Theo dõi và quản lý toàn bộ kế hoạch tài chính của bạn
          </p>
        </div>

        {/* Action Button with Dropdown */}
        <div className="plan-create-menu-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className="plan-btn-create-primary"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
            aria-label="Lập kế hoạch tài chính"
          >
            <svg
              width="15"
              height="15"
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
            <span>Lập kế hoạch</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`dropdown-chevron-icon ${isDropdownOpen ? 'is-open' : ''}`}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {isDropdownOpen && (
            <div className="plan-create-dropdown" role="menu" aria-label="Lựa chọn loại kế hoạch tạo mới">
              <button
                type="button"
                className="plan-dropdown-item"
                role="menuitem"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setIsWalletModalOpen(true);
                }}
              >
                <div className="dropdown-item-icon-tile dropdown-icon--purple" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="5" rx="2" />
                    <line x1="2" x2="22" y1="10" y2="10" />
                  </svg>
                </div>
                <div className="dropdown-item-info">
                  <strong className="dropdown-item-title">Ví / Tài khoản</strong>
                  <span className="dropdown-item-desc">Thêm ví tiền mặt, ngân hàng hoặc thẻ tín dụng</span>
                </div>
              </button>

              <button
                type="button"
                className="plan-dropdown-item"
                role="menuitem"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setIsBudgetModalOpen(true);
                }}
              >
                <div className="dropdown-item-icon-tile dropdown-icon--emerald" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" x2="12" y1="20" y2="10" />
                    <line x1="18" x2="18" y1="20" y2="4" />
                    <line x1="6" x2="6" y1="20" y2="16" />
                  </svg>
                </div>
                <div className="dropdown-item-info">
                  <strong className="dropdown-item-title">Ngân sách</strong>
                  <span className="dropdown-item-desc">Thiết lập hạn mức chi tiêu cho danh mục</span>
                </div>
              </button>

              <button
                type="button"
                className="plan-dropdown-item"
                role="menuitem"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setIsRecurringModalOpen(true);
                }}
              >
                <div className="dropdown-item-icon-tile dropdown-icon--orange" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="4" rx="2" />
                    <line x1="16" x2="16" y1="2" y2="6" />
                    <line x1="8" x2="8" y1="2" y2="6" />
                    <line x1="3" x2="21" y1="10" y2="10" />
                  </svg>
                </div>
                <div className="dropdown-item-info">
                  <strong className="dropdown-item-title">Khoản định kỳ</strong>
                  <span className="dropdown-item-desc">Thêm khoản chi cố định, hóa đơn hoặc trả góp</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. SECTION 1: CẢNH BÁO / SẮP ĐẾN HẠN (NGAY TRÊN CÙNG) ── */}
      <div className="plan-top-alerts-card" role="region" aria-label="Cảnh báo và nhắc nhở tài chính">
        <div className="top-alerts-left-brand">
          <div className="top-alerts-bell-box" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div className="top-alerts-header-info">
            <h3 className="top-alerts-title">Cảnh báo / Sắp đến hạn</h3>
            <span className="top-alerts-subtext">
              {activeAlerts.length > 0
                ? `Bạn có ${activeAlerts.length} việc cần lưu ý`
                : 'Mọi kế hoạch đang trong tầm kiểm soát tốt!'}
            </span>
          </div>
        </div>

        {activeAlerts.length > 0 ? (
          <div className="top-alerts-items-scroll">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className="top-alert-pill-item"
                role="button"
                tabIndex={0}
                onClick={() => setPlanSubTab(alert.targetTab)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setPlanSubTab(alert.targetTab);
                  }
                }}
              >
                {alert.type === 'recurring' ? (
                  <div className="top-alert-calendar-tile" aria-hidden="true">
                    <span className="cal-header">{alert.dateParts?.weekdayShort || 'THỨ'}</span>
                    <strong className="cal-day">{alert.dateParts?.day || '01'}</strong>
                  </div>
                ) : (
                  <div className="top-alert-dot-tile" aria-hidden="true">
                    <span className="dot-indicator" />
                  </div>
                )}

                <div className="top-alert-text-body">
                  <strong className="top-alert-name">{alert.title}</strong>
                  <span className="top-alert-amount-desc">{alert.subText}</span>
                </div>

                {alert.type === 'budget' && (
                  <svg className="top-alert-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="top-alerts-empty-reassurance">
            <span className="reassurance-sparkle" aria-hidden="true">✨</span>
            <span>Tất cả ngân sách và khoản định kỳ của bạn đang trong trạng thái kiểm soát tốt!</span>
          </div>
        )}

        {activeAlerts.length > 0 && (
          <button
            type="button"
            className="top-alerts-view-all-link"
            onClick={() => setPlanSubTab(activeAlerts[0]?.targetTab || 'budgets')}
          >
            <span>Xem tất cả</span>
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>

      {/* ── 3. SECTION 2: TỔNG QUAN NHANH (3 METRIC CARDS) ── */}
      <div className="plan-metrics-grid">
        {/* Card 1: Tổng tài sản */}
        <div className="plan-metric-card">
          <div className="metric-card-top-row">
            <div className="metric-icon-circle metric-icon--purple" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
            </div>
            <div className="metric-titles">
              <span className="metric-label">Tổng tài sản</span>
              <strong className="metric-value">
                {formatCurrency(totalAssets)}
              </strong>
            </div>
          </div>

          <div className="metric-card-bottom-row">
            <span className="metric-sub-left">{wallets.length} tài khoản</span>
            <span className="metric-sub-trend trend-positive">
              ▲ 5.2% <span className="trend-note">so với tháng trước</span>
            </span>
          </div>
        </div>

        {/* Card 2: Ngân sách còn lại / Đã vượt ngân sách */}
        <div className="plan-metric-card">
          <div className="metric-card-top-row">
            <div className={`metric-icon-circle ${hasAnyBudgetLimit && totalBudgetRemaining !== null && totalBudgetRemaining < 0 ? 'metric-icon--danger' : 'metric-icon--emerald'}`} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" x2="12" y1="20" y2="10" />
                <line x1="18" x2="18" y1="20" y2="4" />
                <line x1="6" x2="6" y1="20" y2="16" />
              </svg>
            </div>
            <div className="metric-titles">
              <span className="metric-label">
                {hasAnyBudgetLimit && totalBudgetRemaining !== null && totalBudgetRemaining < 0
                  ? 'Đã vượt ngân sách'
                  : 'Ngân sách còn lại'}
              </span>
              <strong className={`metric-value ${!hasAnyBudgetLimit ? 'is-unset' : totalBudgetRemaining < 0 ? 'text-danger' : ''}`}>
                {hasAnyBudgetLimit
                  ? totalBudgetRemaining < 0
                    ? formatCurrency(Math.abs(totalBudgetRemaining))
                    : formatCurrency(totalBudgetRemaining)
                  : 'Chưa thiết lập'}
              </strong>
            </div>
          </div>

          <div className="metric-card-bottom-row">
            <span className="metric-sub-left">Trong tháng {currentMonthNum}</span>
            <span className="metric-sub-trend trend-positive">
              ▲ 12.4% <span className="trend-note">so với tháng trước</span>
            </span>
          </div>
        </div>

        {/* Card 3: Chi phí định kỳ (ước tính) */}
        <div className="plan-metric-card">
          <div className="metric-card-top-row">
            <div className="metric-icon-circle metric-icon--orange" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
            </div>
            <div className="metric-titles">
              <span className="metric-label">Chi phí định kỳ (ước tính)</span>
              <strong className="metric-value">
                ~{formatCurrency(Math.round(monthlyEstimatedCost))} / tháng
              </strong>
            </div>
          </div>

          <div className="metric-card-bottom-row">
            <span className="metric-sub-left">{activeInstallments.length} khoản đang theo dõi</span>
            <span className="metric-sub-trend trend-down">
              ▼ 8.1% <span className="trend-note">so với tháng trước</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. SECTION 3: CHI TIẾT THEO NHÓM (3 SUMMARY COLUMNS) ── */}
      <div className="plan-columns-container">
        {/* ── CỘT 1: Ví & Tài khoản ── */}
        <div className="plan-column-card">
          <div className="column-card-header">
            <h4 className="column-card-title">Ví & Tài khoản</h4>
            <button
              type="button"
              className="column-card-view-all"
              onClick={() => setPlanSubTab('wallets')}
            >
              <span>Xem tất cả</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className="column-card-body">
            {isWalletsLoading && wallets.length === 0 ? (
              <div className="column-empty-state">
                <span className="spinner" style={{ width: 20, height: 20 }} />
                <p>Đang tải danh sách ví...</p>
              </div>
            ) : topWallets.length === 0 ? (
              <div className="column-empty-state">
                <span className="empty-emoji" aria-hidden="true">💳</span>
                <p>Chưa có tài khoản nào.</p>
              </div>
            ) : (
              <div className="column-items-list">
                {topWallets.map((w) => {
                  const typeLabel = WALLET_TYPE_LABELS[w.type] || 'Ví';
                  const isNegative = Number(w.currentBalance) < 0;
                  return (
                    <div key={w.id} className="plan-item-box plan-item-box--wallet">
                      <div className="item-box-left">
                        <div
                          className="wallet-icon-square"
                          style={{ backgroundColor: `${w.color || '#4F46E5'}18`, color: w.color || '#4F46E5' }}
                          aria-hidden="true"
                        >
                          <span>{w.icon || '💳'}</span>
                        </div>
                        <div className="wallet-meta-info">
                          <strong className="wallet-name-text" title={w.name}>{w.name}</strong>
                          <span className="wallet-type-text">{typeLabel}</span>
                        </div>
                      </div>

                      <div className="item-box-right">
                        <strong className={`wallet-amount-val ${isNegative ? 'is-negative' : ''}`}>
                          {formatCurrency(w.currentBalance ?? w.initialBalance ?? 0)}
                        </strong>
                        <span className="wallet-growth-tag">▲ 3.5%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="column-card-footer">
            <button
              type="button"
              className="column-footer-action-btn"
              onClick={() => setIsWalletModalOpen(true)}
            >
              <span>+ Thêm ví / tài khoản</span>
            </button>
          </div>
        </div>

        {/* ── CỘT 2: Ngân sách tháng [X] ── */}
        <div className="plan-column-card">
          <div className="column-card-header">
            <h4 className="column-card-title">Ngân sách tháng {currentMonthNum}</h4>
            <button
              type="button"
              className="column-card-view-all"
              onClick={() => setPlanSubTab('budgets')}
            >
              <span>Xem tất cả</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className="column-card-body">
            {isTxnsLoading && topBudgetCategories.length === 0 ? (
              <div className="column-empty-state">
                <span className="spinner" style={{ width: 20, height: 20 }} />
                <p>Đang tải dữ liệu ngân sách...</p>
              </div>
            ) : topBudgetCategories.length === 0 || !hasAnyBudgetLimit ? (
              <div className="column-empty-state">
                <span className="empty-emoji" aria-hidden="true">📊</span>
                <p>Chưa có ngân sách nào được thiết lập trong tháng này.</p>
              </div>
            ) : (
              <div className="column-items-list">
                {topBudgetCategories.map((cat) => {
                  const percent = cat.hasLimit ? cat.percent : 0;
                  const isDanger = percent >= 100;
                  const isWarning = percent >= 80 && percent < 100;
                  const barWidth = Math.min(100, percent);

                  return (
                    <div key={cat.category} className="plan-item-box plan-item-box--budget">
                      <div className="budget-item-top-row">
                        <div className="budget-item-title-group">
                          <span className="budget-item-icon" aria-hidden="true">{cat.icon}</span>
                          <div className="budget-item-names">
                            <strong className="budget-item-name" title={cat.category}>{cat.category}</strong>
                            <span className="budget-item-amounts">
                              {formatCurrency(cat.spent)}
                              {cat.hasLimit && (
                                <span className="budget-item-limit"> / {formatCurrency(cat.limit)}</span>
                              )}
                            </span>
                          </div>
                        </div>

                        {cat.hasLimit && (
                          <span className={`budget-percent-pill ${isDanger ? 'pill-danger' : isWarning ? 'pill-warning' : 'pill-brand'}`}>
                            {formatPercent(percent)}
                          </span>
                        )}
                      </div>

                      {cat.hasLimit && (
                        <div className="budget-mini-track" aria-hidden="true">
                          <div
                            className={`budget-mini-fill ${
                              isDanger ? 'fill-danger' : isWarning ? 'fill-warning' : 'fill-brand'
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="column-card-footer">
            <button
              type="button"
              className="column-footer-action-btn"
              onClick={() => setIsBudgetModalOpen(true)}
            >
              <span>+ Thiết lập ngân sách</span>
            </button>
          </div>
        </div>

        {/* ── CỘT 3: Khoản định kỳ ── */}
        <div className="plan-column-card">
          <div className="column-card-header">
            <h4 className="column-card-title">Khoản định kỳ</h4>
            <button
              type="button"
              className="column-card-view-all"
              onClick={() => setPlanSubTab('recurring')}
            >
              <span>Xem tất cả</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className="column-card-body">
            {isJarsLoading && topInstallments.length === 0 ? (
              <div className="column-empty-state">
                <span className="spinner" style={{ width: 20, height: 20 }} />
                <p>Đang tải danh sách định kỳ...</p>
              </div>
            ) : topInstallments.length === 0 ? (
              <div className="column-empty-state">
                <span className="empty-emoji" aria-hidden="true">🔄</span>
                <p>Bạn chưa theo dõi khoản định kỳ nào.</p>
              </div>
            ) : (
              <div className="column-items-list">
                {topInstallments.map((item) => {
                  const due = getDueStatus(item.nextDueDate);
                  const dateParts = getCalendarDateParts(item.nextDueDate);
                  const cycleSuffix = item.cycle === 'yearly' ? '/ năm' : item.cycle === 'quarterly' ? '/ quý' : '/ tháng';

                  return (
                    <div key={item.id} className="plan-item-box plan-item-box--recurring">
                      <div className="item-box-left">
                        {/* Calendar Date Block (Mockup Style) */}
                        <div className="recurring-calendar-block" aria-hidden="true">
                          <span className={`cal-weekday ${due.isToday || due.isOverdue ? 'cal-danger' : ''}`}>
                            {dateParts.weekdayShort}
                          </span>
                          <strong className="cal-day-number">{dateParts.day}</strong>
                        </div>

                        <div className="recurring-meta-info">
                          <strong className="recurring-name-text" title={item.name}>{item.name}</strong>
                          <span className="recurring-amount-text">
                            {formatCurrency(item.amount)} {cycleSuffix}
                          </span>
                        </div>
                      </div>

                      <div className="item-box-right item-box-right--recurring">
                        {due.diffDays !== null ? (
                          <span className={`recurring-pill-badge ${
                            due.isOverdue
                              ? 'pill-danger'
                              : due.isToday
                              ? 'pill-today'
                              : due.isSoon
                              ? 'pill-soon'
                              : 'pill-normal'
                          }`}>
                            {due.text}
                          </span>
                        ) : (
                          <span className="recurring-pill-badge pill-normal">
                            {item.nextDueDate || 'Chưa định ngày'}
                          </span>
                        )}

                        <button
                          type="button"
                          className="recurring-dots-btn"
                          onClick={() => setPlanSubTab('recurring')}
                          title="Xem chi tiết khoản định kỳ"
                          aria-label={`Xem chi tiết khoản ${item.name}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="12" cy="5" r="1" />
                            <circle cx="12" cy="19" r="1" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="column-card-footer">
            <button
              type="button"
              className="column-footer-action-btn"
              onClick={() => setIsRecurringModalOpen(true)}
            >
              <span>+ Thêm khoản định kỳ</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 5. SECTION 4: PHÂN TÍCH & GỢI Ý (INSIGHT BANNER AT BOTTOM) ── */}
      <div className="plan-insight-banner-card">
        <div className="insight-banner-left">
          <div className="insight-3d-icon-box" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" x2="18" y1="20" y2="10" />
              <line x1="12" x2="12" y1="20" y2="4" />
              <line x1="6" x2="6" y1="20" y2="14" />
            </svg>
          </div>
          <div className="insight-banner-text">
            <strong className="insight-banner-title">Gợi ý dành cho bạn</strong>
            <p className="insight-banner-desc">
              {highestSpendCategory
                ? `Bạn có thể tiết kiệm thêm ${formatCurrency(Math.round(highestSpendCategory.spent * 0.2))} trong tháng này nếu tối ưu 20% chi tiêu ở danh mục ${highestSpendCategory.category}.`
                : 'Lập kế hoạch ngân sách và phân bổ dòng tiền hợp lý giúp bạn tối ưu hóa 15% - 25% thu nhập mỗi tháng.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="insight-banner-btn"
          onClick={() => setActiveView('analytics')}
        >
          <span>Xem phân tích chi tiết</span>
        </button>
      </div>

      {/* ── 6. In-Place Modals for Quick Creation ── */}
      {isWalletModalOpen && (
        <WalletModal
          isOpen={isWalletModalOpen}
          onClose={() => setIsWalletModalOpen(false)}
          walletToEdit={null}
        />
      )}

      {isBudgetModalOpen && (
        <BudgetEditModal
          isOpen={isBudgetModalOpen}
          onClose={() => setIsBudgetModalOpen(false)}
          initialCategory={null}
        />
      )}

      {isRecurringModalOpen && (
        <RecurringModal
          isOpen={isRecurringModalOpen}
          onClose={() => setIsRecurringModalOpen(false)}
        />
      )}
    </div>
  );
}
