import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CategoryMark } from '../../components/ui/CategoryMark';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useJarStore } from '../../stores/useJarStore';
import { WalletModal } from './WalletModal';
import { BudgetEditModal } from './BudgetEditModal';
import { RecurringModal } from './RecurringModal';
import { BUDGET_WARN_PERCENT, calculateMonthlyStats, getBudgetStatus } from '../../utils/financeMath';
import { formatCurrency, formatPercent, getRecurringTier, getCalendarDateParts, getLocalMonthString } from '../../utils/formatters';
import { WalletOutlineIcon } from '../../components/ui/WalletOutlineIcon';
import { RefreshOutlineIcon } from '../../utils/categoryIcons';
import { useTranslation } from '../../i18n/useTranslation';
import { getPlanCopy } from './planCopy';
import { isInstallmentEnded, isRecurringIncome } from '../../utils/installmentTerm';
import { buildPlanAlerts } from '../../utils/planAlerts';
import { PlanAttentionBar } from './PlanAttentionBar';
import { WALLET_TYPE_LABELS } from './wallets/walletLabels';
import { NavIcon } from '../../components/ui/NavIcons';
import { PageHeader } from '../../components/ui/PageHeader';
import { Icon } from '../../components/ui/AppIcons';

export function PlanOverviewTab() {
  const { label, lang } = useTranslation();
  const copy = getPlanCopy(lang);
  const setPlanSubTab = useSpendingStore((s) => s.setPlanSubTab);
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

  // 1. Wallets calculation + smart grouping (non-zero/default first, zero-balance collapsible)
  const activeWallets = useMemo(
    () => (wallets || []).filter((w) => !w.archived),
    [wallets]
  );

  const totalAssets = useMemo(
    () => (wallets || []).reduce((sum, w) => sum + (Number(w.currentBalance) || 0), 0),
    [wallets]
  );

  const { primaryWallets, zeroWallets, positiveWalletsCount, topShareWallet } = useMemo(() => {
    const sorted = [...activeWallets].sort((a, b) => {
      const balA = Number(a.currentBalance) || 0;
      const balB = Number(b.currentBalance) || 0;
      if (balA !== balB) return balB - balA;
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    const positive = sorted.filter((w) => (Number(w.currentBalance) || 0) > 0);
    const nonZero = sorted.filter((w) => (Number(w.currentBalance) || 0) !== 0);
    const zeros = sorted.filter((w) => (Number(w.currentBalance) || 0) === 0);

    // If at least one wallet carries a balance, spotlight active non-zero wallets and fold 0-balance ones cleanly.
    if (nonZero.length > 0) {
      return {
        primaryWallets: nonZero.slice(0, 4),
        zeroWallets: zeros,
        positiveWalletsCount: positive.length,
        topShareWallet: positive[0] || null,
      };
    }
    // Fresh account where every wallet is 0: display directly instead of hiding all under details.
    return {
      primaryWallets: sorted.slice(0, 4),
      zeroWallets: [],
      positiveWalletsCount: 0,
      topShareWallet: null,
    };
  }, [activeWallets]);

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
    };
  });

  const totalBudgetRemaining = hasAnyBudgetLimit ? totalBudgetLimit - totalBudgetSpent : null;
  const budgetUsagePercent = totalBudgetLimit > 0 ? (totalBudgetSpent / totalBudgetLimit) * 100 : 0;

  // 3. Recurring calculation + monthly payment coverage
  const activeInstallments = useMemo(
    () => (installments || []).filter((item) => item.active !== false && !isInstallmentEnded(item) && !isRecurringIncome(item)),
    [installments]
  );

  const monthlyEstimatedCost = useMemo(() => activeInstallments.reduce((sum, item) => {
    const amt = Number(item.amount) || 0;
    if (item.cycle === 'yearly') return sum + amt / 12;
    if (item.cycle === 'quarterly') return sum + amt / 3;
    return sum + amt;
  }, 0), [activeInstallments]);

  const { paidRecurringCount, unpaidRecurringCount, unpaidRecurringTotal } = useMemo(() => {
    let paid = 0;
    let unpaid = 0;
    let unpaidSum = 0;
    activeInstallments.forEach((item) => {
      const tier = getRecurringTier(item, currentMonthStr);
      if (tier.isPaidThisMonth) {
        paid += 1;
      } else {
        unpaid += 1;
        unpaidSum += Number(item.amount) || 0;
      }
    });
    return { paidRecurringCount: paid, unpaidRecurringCount: unpaid, unpaidRecurringTotal: unpaidSum };
  }, [activeInstallments, currentMonthStr]);

  // 4. Alerts for compact actionable strip, most severe first
  const activeAlerts = useMemo(
    () => buildPlanAlerts({ installments: activeInstallments, categoryBudgets, currentMonth: currentMonthStr }),
    [activeInstallments, categoryBudgets, currentMonthStr]
  );

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
        if (tierA.isPaidThisMonth !== tierB.isPaidThisMonth) {
          return tierA.isPaidThisMonth ? 1 : -1;
        }
        const dueA = tierA.diffDays ?? 9999;
        const dueB = tierB.diffDays ?? 9999;
        return dueA - dueB;
      })
      .slice(0, 6);
  }, [activeInstallments, currentMonthStr]);

  const hasPlanData = hasAnyBudgetLimit || activeInstallments.length > 0;
  const isOverBudget = hasAnyBudgetLimit && totalBudgetRemaining !== null && totalBudgetRemaining < 0;
  const budgetBarTone = budgetUsagePercent >= 100
    ? 'fill-danger'
    : budgetUsagePercent >= BUDGET_WARN_PERCENT
      ? 'fill-warning'
      : 'fill-brand';

  // Right-column recurring coverage card state (genuinely new planning insight, no duplication)
  const coverageStatus = useMemo(() => {
    if (activeInstallments.length === 0) {
      return {
        tone: 'neutral',
        icon: 'calendar',
        title: copy.statusNoRecurringTitle,
        body: copy.statusNoRecurringBody,
      };
    }
    if (unpaidRecurringCount === 0) {
      return {
        tone: 'success',
        icon: 'shieldCheck',
        title: copy.statusAllPaidTitle(currentMonthNum),
        body: copy.statusAllPaidBody(formatCurrency(totalAssets)),
      };
    }
    if (totalAssets >= unpaidRecurringTotal) {
      return {
        tone: 'success',
        icon: 'shieldCheck',
        title: copy.statusCoveredTitle,
        body: copy.statusCoveredBody(unpaidRecurringCount, formatCurrency(unpaidRecurringTotal)),
      };
    }
    return {
      tone: 'warning',
      icon: 'alertTriangle',
      title: copy.statusShortfallTitle,
      body: copy.statusShortfallBody(
        unpaidRecurringCount,
        formatCurrency(unpaidRecurringTotal),
        formatCurrency(unpaidRecurringTotal - totalAssets)
      ),
    };
  }, [activeInstallments.length, unpaidRecurringCount, unpaidRecurringTotal, totalAssets, currentMonthNum, copy]);

  const zeroPreviewText = useMemo(() => {
    if (zeroWallets.length === 0) return '';
    const names = zeroWallets.slice(0, 3).map((w) => w.name).join(', ');
    return zeroWallets.length > 3 ? `${names}…` : names;
  }, [zeroWallets]);

  return (
    <div className="plan-overview-container" role="region" aria-label="Tổng quan kế hoạch tài chính">
      {/* ── 1. Page Header: title + secondary "Lập kế hoạch" dropdown ── */}
      <PageHeader
        icon="planOverview"
        className="plan-overview-header"
        titleClassName="plan-overview-title"
        title={(
          <>
            <span className="plan-wide-copy">{copy.overview}</span>
            <span className="plan-mobile-copy">{copy.mobileOverview}</span>
          </>
        )}
        actions={(
          <div className="plan-create-menu-wrapper" ref={dropdownRef}>
            <button
              type="button"
              className="plan-btn-create-primary"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              aria-expanded={isDropdownOpen}
              aria-haspopup="true"
              aria-label="Lập kế hoạch tài chính"
            >
              <Icon name="plus" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
              <span className="plan-wide-copy">{copy.create}</span>
              <span className="plan-mobile-copy">{copy.mobileCreate}</span>
              <Icon name="chevronDown" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`dropdown-chevron-icon ${isDropdownOpen ? 'is-open' : ''}`} />
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
        )}
      />

      {/* ── 2. UNIFIED KPI SUMMARY STRIP (1 calm surface, 3 hairline-divided metrics) ── */}
      <section className="plan-metrics-grid" aria-label={copy.metricsRegion}>
        {/* Metric 1: Wallets */}
        <div className="plan-metric-card">
          <div className="metric-titles">
            <span className="plan-metric-label">Tổng số dư các ví</span>
            <strong className="plan-metric-value">{formatCurrency(totalAssets)}</strong>
          </div>
          <div className="metric-card-bottom-row">
            <span className="metric-sub-left">
              {positiveWalletsCount > 0
                ? copy.walletsSummary(wallets.length, positiveWalletsCount)
                : copy.walletsActiveSummary(wallets.length, activeWallets.length)}
            </span>
          </div>
        </div>

        {/* Metric 2: Monthly Budget */}
        <div className="plan-metric-card">
          <div className="metric-titles">
            <span className="plan-metric-label">{copy.budgetMonthTitle(currentMonthNum)}</span>
            <strong className={`plan-metric-value ${!hasAnyBudgetLimit ? 'is-unset' : isOverBudget ? 'text-danger' : ''}`}>
              {hasAnyBudgetLimit
                ? isOverBudget
                  ? `${copy.overBudgetPrefix}${formatCurrency(Math.abs(totalBudgetRemaining))}`
                  : formatCurrency(totalBudgetRemaining)
                : copy.unsetBudget}
            </strong>
          </div>
          <div className="metric-card-bottom-row">
            {hasAnyBudgetLimit && totalBudgetLimit > 0 ? (
              <span className="metric-budget-progress">
                <span className="metric-mini-track" aria-hidden="true">
                  <span
                    className={`metric-mini-fill ${budgetBarTone}`}
                    style={{ '--metric-mini-fill-width': `${Math.min(100, Math.round(budgetUsagePercent))}%` }}
                  />
                </span>
                <span className={`metric-sub-trend ${budgetUsagePercent >= 100 ? 'trend-down' : budgetUsagePercent >= BUDGET_WARN_PERCENT ? 'plan-trend-warning' : 'trend-positive'}`}>
                  {Math.round(budgetUsagePercent)}% <span className="trend-note">{copy.usedLabel}</span>
                </span>
              </span>
            ) : (
              <span className="metric-sub-left">{copy.unsetBudget}</span>
            )}
          </div>
        </div>

        {/* Metric 3: Recurring */}
        <div className="plan-metric-card">
          <div className="metric-titles">
            <span className="plan-metric-label">{copy.recurringTitle}</span>
            <strong className="plan-metric-value">
              {`~${formatCurrency(Math.round(monthlyEstimatedCost))}`}
              <span className="plan-metric-unit"> / tháng</span>
            </strong>
          </div>
          <div className="metric-card-bottom-row">
            {activeInstallments.length === 0 ? (
              <span className="metric-sub-left">{copy.recurringNone}</span>
            ) : unpaidRecurringCount === 0 ? (
              <span className="metric-sub-trend trend-positive">
                <Icon name="check" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <span>{copy.recurringPaidAll(paidRecurringCount, activeInstallments.length)}</span>
              </span>
            ) : (
              <span className="metric-sub-left">
                {copy.recurringPending(unpaidRecurringCount, activeInstallments.length)}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── 3. COMPACT ACTIONABLE ALERT STRIP (replaces 4-card wall + bottom blue banner) ── */}
      <PlanAttentionBar
        alerts={activeAlerts}
        hasPlanData={hasPlanData}
        copy={copy}
        label={label}
        onOpen={setPlanSubTab}
      />

      {/* ── 4. ASYMMETRIC 65/35 MAIN CONTENT (Focus & Breathe) ── */}
      <div className="plan-overview-grid">
        {/* ── LEFT COLUMN (65%): Budgets + Recurring ── */}
        <div className="plan-col-main">
          {/* Card A: Monthly Budgets — flat hairline rows */}
          <section className="plan-column-card">
            <div className="column-card-header">
              <h2 className="column-card-title">{copy.budgetMonthTitle(currentMonthNum)}</h2>
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
                <div className="plan-flat-list">
                  {topBudgetCategories.map((cat) => {
                    const percent = cat.hasLimit ? cat.percent : 0;
                    const isDanger = percent >= 100;
                    const isWarning = percent >= BUDGET_WARN_PERCENT && percent < 100;
                    const barWidth = Math.min(100, percent);

                    return (
                      <button
                        key={cat.category}
                        type="button"
                        className="plan-budget-row"
                        onClick={() => setPlanSubTab('budgets')}
                      >
                        <span className="plan-budget-cat">
                          <span className="plan-row-icon" aria-hidden="true">
                            <CategoryMark name={cat.category} size={16} />
                          </span>
                          <strong className="budget-item-name" title={label(cat.category)}>
                            {label(cat.category)}
                          </strong>
                        </span>

                        <span className="plan-budget-track-wrap" aria-hidden="true">
                          {cat.hasLimit && (
                            <span className="budget-mini-track">
                              <span
                                className={`budget-mini-fill ${
                                  isDanger ? 'fill-danger' : isWarning ? 'fill-warning' : 'fill-brand'
                                } budget-mini-fill--box`}
                                style={{ '--budget-mini-fill-width': `${barWidth}%` }}
                              />
                            </span>
                          )}
                        </span>

                        <span className="budget-item-amounts">
                          <strong>{formatCurrency(cat.spent)}</strong>
                          {cat.hasLimit && (
                            <span className="budget-item-limit"> / {formatCurrency(cat.limit)}</span>
                          )}
                        </span>

                        <span className="plan-budget-pill-col">
                          {cat.hasLimit && (
                            <span className={`budget-percent-pill ${isDanger ? 'pill-danger' : isWarning ? 'pill-warning' : 'pill-brand'}`}>
                              {formatPercent(percent)}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {!isTxnsLoading && (topBudgetCategories.length === 0 || !hasAnyBudgetLimit) && (
              <div className="column-card-footer">
                <button
                  type="button"
                  className="column-footer-action-btn"
                  onClick={() => setIsBudgetModalOpen(true)}
                >
                  <span>+ Thiết lập ngân sách</span>
                </button>
              </div>
            )}
          </section>

          {/* Card B: Monthly Recurring — spacious horizontal tiles (no truncation, no fake 3-dots) */}
          <section className="plan-column-card">
            <div className="column-card-header">
              <h2 className="column-card-title">{copy.recurringMonthTitle(currentMonthNum)}</h2>
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
                <div className="plan-rec-grid">
                  {topInstallments.map((item) => {
                    const tierInfo = getRecurringTier(item, currentMonthStr);
                    const dateParts = getCalendarDateParts(item.nextDueDate);
                    const cycleSuffix = item.cycle === 'yearly' ? '/ năm' : item.cycle === 'quarterly' ? '/ quý' : '/ tháng';

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="plan-rec-tile"
                        onClick={() => setPlanSubTab('recurring')}
                      >
                        <span className="plan-rec-tile-top">
                          <span className={`plan-rec-date-chip is-${tierInfo.tier}`}>
                            {dateParts.weekdayShort} · {dateParts.day}
                          </span>
                          <span className={`recurring-pill-badge pill-${tierInfo.tier}`}>
                            {tierInfo.tier === 'paid' && (
                              <Icon name="check" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="plan-icon-gap" />
                            )}
                            {tierInfo.shortText}
                          </span>
                        </span>

                        <strong className="plan-rec-name" title={item.name}>{item.name}</strong>
                        <span className="plan-rec-amount">
                          {formatCurrency(item.amount)} {cycleSuffix}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {!(isJarsLoading && topInstallments.length === 0) && topInstallments.length === 0 && (
              <div className="column-card-footer">
                <button
                  type="button"
                  className="column-footer-action-btn"
                  onClick={() => setIsRecurringModalOpen(true)}
                >
                  <span>+ Thêm khoản định kỳ</span>
                </button>
              </div>
            )}
          </section>
        </div>

        {/* ── RIGHT COLUMN (35%): Wallets (smart collapsed) + Recurring Coverage Status ── */}
        <div className="plan-col-side">
          {/* Card C: Wallets & Accounts */}
          <section className="plan-column-card">
            <div className="column-card-header">
              <h2 className="column-card-title">Ví & Tài khoản</h2>
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
              ) : primaryWallets.length === 0 ? (
                <div className="column-empty-state">
                  <span className="empty-emoji empty-emoji--layout" aria-hidden="true">
                    <WalletOutlineIcon type="credit" size={28} color="currentColor" />
                  </span>
                  <p>Chưa có tài khoản nào.</p>
                </div>
              ) : (
                <>
                  {/* Balance allocation bar */}
                  {totalAssets > 0 && topShareWallet && (
                    <div className="plan-wallet-alloc">
                      <div className="plan-wallet-alloc-meta">
                        <span>{copy.balanceAllocation}</span>
                        <strong>
                          {topShareWallet.name}{' '}
                          {formatPercent((Number(topShareWallet.currentBalance) / totalAssets) * 100)}
                        </strong>
                      </div>
                      <div className="plan-wallet-alloc-track" aria-hidden="true">
                        {primaryWallets
                          .filter((w) => Number(w.currentBalance) > 0)
                          .map((w, index) => (
                            <span
                              key={w.id}
                              className={`plan-wallet-alloc-seg seg-${Math.min(index, 3)}`}
                              style={{ '--seg-width': `${Math.max(4, (Number(w.currentBalance) / totalAssets) * 100)}%` }}
                            />
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Active wallets flat rows */}
                  <div className="plan-flat-list">
                    {primaryWallets.map((w) => {
                      const typeLabel = WALLET_TYPE_LABELS[w.type] || 'Ví';
                      const balance = Number(w.currentBalance ?? w.initialBalance ?? 0);
                      const isNegative = balance < 0;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          className="plan-wallet-row"
                          onClick={() => setPlanSubTab('wallets')}
                        >
                          <span className={`plan-row-icon ${w.isDefault ? 'is-brand' : ''}`} aria-hidden="true">
                            <WalletOutlineIcon type={w.type} size={17} color="currentColor" />
                          </span>
                          <span className="wallet-meta-info">
                            <strong className="wallet-name-text" title={w.name}>{w.name}</strong>
                            <span className="wallet-type-text">
                              {typeLabel}
                              {w.isDefault && (
                                <span className="wallet-default-inline">
                                  <span aria-hidden="true"> · </span>
                                  <span>Mặc định</span>
                                </span>
                              )}
                            </span>
                          </span>
                          <span className="item-box-right">
                            <strong className={`wallet-amount-val ${isNegative ? 'is-negative' : ''}`}>
                              {formatCurrency(balance)}
                            </strong>
                            {!w.isDefault && totalAssets > 0 && balance > 0 && (
                              <span className="wallet-share-note">
                                {formatPercent((balance / totalAssets) * 100)}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Native <details> disclosure for zero-balance wallets (content-first-noise-reduction) */}
                  {zeroWallets.length > 0 && (
                    <details className="plan-zero-wallets">
                      <summary className="plan-zero-wallets-summary">
                        <span className="plan-zero-wallets-label">
                          <strong>{copy.zeroWalletsSummary(zeroWallets.length)}</strong>{' '}
                          <span className="plan-zero-wallets-preview">{copy.zeroWalletsPreview(zeroPreviewText)}</span>
                        </span>
                        <Icon
                          name="chevronDownAlt"
                          className="plan-zero-wallets-chevron"
                          width="15"
                          height="15"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </summary>
                      <div className="plan-zero-wallets-list">
                        {zeroWallets.map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            className="plan-wallet-row plan-wallet-row--zero"
                            onClick={() => setPlanSubTab('wallets')}
                          >
                            <span className="plan-row-icon" aria-hidden="true">
                              <WalletOutlineIcon type={w.type} size={16} color="currentColor" />
                            </span>
                            <span className="wallet-meta-info">
                              <strong className="wallet-name-text" title={w.name}>{w.name}</strong>
                              <span className="wallet-type-text">{WALLET_TYPE_LABELS[w.type] || 'Ví'}</span>
                            </span>
                            <span className="wallet-amount-val is-zero">{formatCurrency(0)}</span>
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )}
            </div>

            {!(isWalletsLoading && wallets.length === 0) && primaryWallets.length === 0 && (
              <div className="column-card-footer">
                <button
                  type="button"
                  className="column-footer-action-btn"
                  onClick={() => setIsWalletModalOpen(true)}
                >
                  <span>+ Thêm ví / tài khoản</span>
                </button>
              </div>
            )}
          </section>

          {/* Card D: Recurring Coverage Context Card */}
          <aside className={`plan-side-status-card is-${coverageStatus.tone}`} aria-label={coverageStatus.title}>
            <span className="plan-side-status-icon" aria-hidden="true">
              <Icon
                name={coverageStatus.icon}
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </span>
            <div className="plan-side-status-copy">
              <strong className="plan-side-status-title">{coverageStatus.title}</strong>
              <p className="plan-side-status-body">{coverageStatus.body}</p>
            </div>
          </aside>
        </div>
      </div>

      {/* ── 5. In-Place Modals for Quick Creation ── */}
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
