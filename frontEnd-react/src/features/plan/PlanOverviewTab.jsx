import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useJarStore } from '../../stores/useJarStore';
import { WalletModal } from './WalletModal';
import { BudgetEditModal } from './BudgetEditModal';
import { RecurringModal } from './RecurringModal';
import { calculateMonthlyStats, getBudgetStatus } from '../../utils/financeMath';
import { formatCurrency, formatPercent, getRecurringTier, getCalendarDateParts, getLocalMonthString } from '../../utils/formatters';
import { getCategoryIcon } from '../../utils/categories';
import { WalletOutlineIcon } from '../../components/ui/WalletOutlineIcon';
import { CategoryOutlineIcon, RefreshOutlineIcon } from '../../utils/categoryIcons';
import { useTranslation } from '../../i18n/useTranslation';
import { getPlanCopy } from './planCopy';
import { isInstallmentEnded, isRecurringIncome } from '../../utils/installmentTerm';
import { buildPlanAlerts } from '../../utils/planAlerts';
import { PlanAttentionBar } from './PlanAttentionBar';
import { NavIcon, PageTitleIcon } from '../../components/ui/NavIcons';

import { Icon } from '../../components/ui/AppIcons';
const WALLET_TYPE_LABELS = {
  cash: 'Tiền mặt',
  bank: 'Ngân hàng',
  credit: 'Thẻ tín dụng',
  'e-wallet': 'Ví điện tử'
};

export function PlanOverviewTab() {
  const { label, lang } = useTranslation();
  const copy = getPlanCopy(lang);
  const setPlanSubTab = useSpendingStore((s) => s.setPlanSubTab);
  const navigateTo = useSpendingStore((s) => s.navigateTo);
  const wallets = useWalletStore((state) => state.wallets);
  const isWalletsLoading = useWalletStore((state) => state.isLoading);
  const transactions = useTransactionStore((state) => state.transactions);
  const budgets = useTransactionStore((state) => state.budgets);
  const expenseCategories = useTransactionStore((state) => state.expenseCategories);
  const isTxnsLoading = useTransactionStore((state) => state.isLoading);
  const installments = useJarStore((state) => state.installments);
  const isJarsLoading = useJarStore((state) => state.isLoading);

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
  const currentMonthStr = getLocalMonthString();
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
  const activeInstallments = (installments || []).filter((item) => item.active !== false && !isInstallmentEnded(item) && !isRecurringIncome(item));
  const monthlyEstimatedCost = activeInstallments.reduce((sum, item) => {
    const amt = Number(item.amount) || 0;
    if (item.cycle === 'yearly') return sum + amt / 12;
    if (item.cycle === 'quarterly') return sum + amt / 3;
    return sum + amt;
  }, 0);

  // 4. Alerts for "Cần chú ý", most severe first.
  const activeAlerts = useMemo(
    () => buildPlanAlerts({ installments: activeInstallments, categoryBudgets, currentMonth: currentMonthStr }),
    [activeInstallments, categoryBudgets, currentMonthStr]
  );
  const budgetUsagePercent = totalBudgetLimit > 0 ? (totalBudgetSpent / totalBudgetLimit) * 100 : 0;

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
        const tierA = getRecurringTier(a, currentMonthStr);
        const tierB = getRecurringTier(b, currentMonthStr);
        // Ưu tiên hiển thị khoản chưa thanh toán lên trước, khoản đã trả xếp sau
        if (tierA.isPaidThisMonth !== tierB.isPaidThisMonth) {
          return tierA.isPaidThisMonth ? 1 : -1;
        }
        const dueA = tierA.diffDays ?? 9999;
        const dueB = tierB.diffDays ?? 9999;
        return dueA - dueB;
      })
      .slice(0, 4);
  }, [activeInstallments, currentMonthStr]);

  // Find top spending category for Insight recommendation
  const highestSpendCategory = useMemo(() => {
    if (!categoryBudgets || categoryBudgets.length === 0) return null;
    const sorted = [...categoryBudgets].sort((a, b) => b.spent - a.spent);
    return sorted[0]?.spent > 0 ? sorted[0] : null;
  }, [categoryBudgets]);
  const hasPlanData = hasAnyBudgetLimit || activeInstallments.length > 0;

  return (
    <div className="plan-overview-container" role="region" aria-label="Tổng quan kế hoạch tài chính">
      {/* ── 1. Page Header: Title, Subtitle, and + Tạo kế hoạch Dropdown ── */}
      <div className="plan-overview-header">
        <div className="page-title-lead plan-header-lead">
          <PageTitleIcon name="planOverview" />
          <div className="plan-header-titles">
            <h1 className="plan-overview-title">
              <span className="plan-wide-copy">{copy.overview}</span>
              <span className="plan-mobile-copy">{copy.mobileOverview}</span>
            </h1>
          </div>
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
            <Icon name="plus" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <span className="plan-wide-copy">{copy.create}</span>
            <span className="plan-mobile-copy">{copy.mobileCreate}</span>
            <Icon name="chevronDown" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`dropdown-chevron-icon ${isDropdownOpen ? 'is-open' : ''}`} />
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
                  <Icon name="creditCard" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                  <NavIcon name="budgets" size={18} />
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
                  <Icon name="calendar" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
      <PlanAttentionBar alerts={activeAlerts} hasPlanData={hasPlanData} copy={copy} label={label} onOpen={setPlanSubTab} />

      {/* ── 3. SECTION 2: TỔNG QUAN NHANH (3 METRIC CARDS) ── */}
      <div className="plan-metrics-grid">
        {/* Card 1: Tổng tài sản */}
        <div className="plan-metric-card">
          <div className="metric-card-top-row">
            <div className="metric-icon-circle metric-icon--purple" aria-hidden="true">
              <Icon name="creditCard" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </div>
            <div className="metric-titles">
              <span className="plan-metric-label">Tổng tài sản</span>
              <strong className="plan-metric-value">
                {formatCurrency(totalAssets)}
              </strong>
            </div>
          </div>

          <div className="metric-card-bottom-row">
            <span className="metric-sub-left">{wallets.length} tài khoản</span>
            <span className="metric-sub-trend">
              <span className="trend-note">{wallets.filter((w) => !w.archived).length} đang hoạt động</span>
            </span>
          </div>
        </div>

        {/* Card 2: Ngân sách còn lại / Đã vượt ngân sách */}
        <div className="plan-metric-card">
          <div className="metric-card-top-row">
            <div className={`metric-icon-circle ${hasAnyBudgetLimit && totalBudgetRemaining !== null && totalBudgetRemaining < 0 ? 'metric-icon--danger' : 'metric-icon--emerald'}`} aria-hidden="true">
              <NavIcon name="budgets" size={20} />
            </div>
            <div className="metric-titles">
              <span className="plan-metric-label">
                {hasAnyBudgetLimit && totalBudgetRemaining !== null && totalBudgetRemaining < 0
                  ? 'Đã vượt ngân sách'
                  : 'Ngân sách còn lại'}
              </span>
              <strong className={`plan-metric-value ${!hasAnyBudgetLimit ? 'is-unset' : totalBudgetRemaining < 0 ? 'text-danger' : ''}`}>
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
            {hasAnyBudgetLimit && totalBudgetLimit > 0 ? (
              <span className={`metric-sub-trend ${budgetUsagePercent >= 100 ? 'trend-down' : budgetUsagePercent >= 80 ? 'plan-trend-warning' : 'trend-positive'}`}>
                {Math.round(budgetUsagePercent)}% <span className="trend-note">đã dùng</span>
              </span>
            ) : (
              <span className="metric-sub-trend">
                <span className="trend-note">Chưa thiết lập</span>
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Chi phí định kỳ (ước tính) */}
        <div className="plan-metric-card">
          <div className="metric-card-top-row">
            <div className="metric-icon-circle metric-icon--orange" aria-hidden="true">
              <Icon name="calendar" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </div>
            <div className="metric-titles">
              <span className="plan-metric-label">Chi phí định kỳ (ước tính)</span>
              <strong className="plan-metric-value">
                ~{formatCurrency(Math.round(monthlyEstimatedCost))} / tháng
              </strong>
            </div>
          </div>

          <div className="metric-card-bottom-row">
            <span className="metric-sub-left">{activeInstallments.length} khoản đang theo dõi</span>
            <span className="metric-sub-trend">
              <span className="trend-note">Ước tính tháng</span>
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
                <span className="spinner spinner--box" />
                <p>Đang tải danh sách ví...</p>
              </div>
            ) : topWallets.length === 0 ? (
              <div className="column-empty-state">
                <span className="empty-emoji empty-emoji--layout" aria-hidden="true">
                  <WalletOutlineIcon type="credit" size={28} color="currentColor" />
                </span>
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
                          className="wallet-icon-square wallet-icon-square--tone"
                          style={{ '--wallet-icon-square-background-color': `${w.color || '#4F46E5'}18`, '--wallet-icon-square-color': w.color || '#4F46E5' }}
                          aria-hidden="true"
                        >
                          <WalletOutlineIcon type={w.type} size={18} color="currentColor" />
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
                        {w.isDefault ? (
                          <span className="wallet-growth-tag wallet-growth-tag--tone">
                            Mặc định
                          </span>
                        ) : totalAssets > 0 && Number(w.currentBalance) > 0 ? (
                          <span className="wallet-growth-tag wallet-growth-tag--tone2">
                            {formatPercent((Number(w.currentBalance) / totalAssets) * 100)}
                          </span>
                        ) : null}
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
                <span className="spinner spinner--box" />
                <p>Đang tải dữ liệu ngân sách...</p>
              </div>
            ) : topBudgetCategories.length === 0 || !hasAnyBudgetLimit ? (
              <div className="column-empty-state">
                <span className="empty-emoji empty-emoji--layout" aria-hidden="true">
                  <NavIcon name="budgets" size={28} />
                </span>
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
                          <span className="budget-item-icon" aria-hidden="true">
                            <CategoryOutlineIcon name={cat.name || cat.category} size={16} />
                          </span>
                          <div className="budget-item-names">
                            <strong className="budget-item-name" title={cat.category}>{label(cat.category)}</strong>
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
                            } budget-mini-fill--box`}
                            style={{ '--budget-mini-fill-width': `${barWidth}%` }}
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
                <span className="spinner spinner--box" />
                <p>Đang tải danh sách định kỳ...</p>
              </div>
            ) : topInstallments.length === 0 ? (
              <div className="column-empty-state">
                <span className="empty-emoji empty-emoji--layout" aria-hidden="true">
                  <RefreshOutlineIcon size={28} color="currentColor" />
                </span>
                <p>Bạn chưa theo dõi khoản định kỳ nào.</p>
              </div>
            ) : (
              <div className="column-items-list">
                {topInstallments.map((item) => {
                  const tierInfo = getRecurringTier(item, currentMonthStr);
                  const dateParts = getCalendarDateParts(item.nextDueDate);
                  const cycleSuffix = item.cycle === 'yearly' ? '/ năm' : item.cycle === 'quarterly' ? '/ quý' : '/ tháng';

                  return (
                    <div key={item.id} className="plan-item-box plan-item-box--recurring">
                      <div className="item-box-left">
                        {/* Calendar Date Block (Mockup Style) */}
                        <div className="recurring-calendar-block" aria-hidden="true">
                          <span className={`cal-weekday ${tierInfo.tier === 'danger' ? 'cal-danger' : tierInfo.tier === 'warning' ? 'cal-warning' : tierInfo.tier === 'paid' ? 'cal-paid' : ''}`}>
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
                        <span className={`recurring-pill-badge pill-${tierInfo.tier}`}>
                          {tierInfo.tier === 'paid' && (
                            <Icon name="check" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="plan-icon-gap" />
                          )}
                          {tierInfo.shortText}
                        </span>

                        <button
                          type="button"
                          className="recurring-dots-btn"
                          onClick={() => setPlanSubTab('recurring')}
                          title="Xem chi tiết khoản định kỳ"
                          aria-label={`Xem chi tiết khoản ${item.name}`}
                        >
                          <Icon name="moreVertical" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
            <Icon name="barChartSimple" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </div>
          <div className="insight-banner-text">
            <strong className="insight-banner-title">Gợi ý dành cho bạn</strong>
            <p className="insight-banner-desc">
              {highestSpendCategory
                ? `Bạn có thể tiết kiệm thêm ${formatCurrency(Math.round(highestSpendCategory.spent * 0.2))} trong tháng này nếu tối ưu 20% chi tiêu ở danh mục ${label(highestSpendCategory.category)}.`
                : 'Chưa đủ dữ liệu chi tiêu để đưa ra gợi ý cá nhân hóa. Hãy ghi nhận giao dịch đầu tiên hoặc thiết lập ngân sách.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="insight-banner-btn"
          onClick={() => navigateTo('analytics', 'overview')}
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
