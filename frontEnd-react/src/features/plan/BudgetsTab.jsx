import React, { useState, useMemo, useEffect } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { BudgetEditModal } from './BudgetEditModal';
import { calculateMonthlyStats, getBudgetStatus } from '../../utils/financeMath';
import { formatCurrency, formatPercent, formatDate, getLocalMonthString } from '../../utils/formatters';
import { isBudgetMonthOverdue } from '../../utils/budgetPeriod';
import { CategoryOutlineIcon, BulbOutlineIcon, AlertTriangleOutlineIcon } from '../../utils/categoryIcons';
import { useBudgetCopy } from './budgetCopy';
import { PageTitleIcon } from '../../components/ui/NavIcons';

// Colour follows how much of a limit is used, never the category itself.
const WARN_PERCENT = 80;
// How far (in percentage points) spending may run ahead of the calendar before
// the month is flagged as "spending faster than planned".
const PACE_TOLERANCE = 10;

function monthStartDate(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

function getMonthTimeline(monthStr, todayMonthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  if (monthStr !== todayMonthStr) return { isCurrent: false, daysInMonth };
  const day = new Date().getDate();
  return {
    isCurrent: true,
    day,
    daysInMonth,
    daysLeft: daysInMonth - day + 1,
    elapsedPercent: (day / daysInMonth) * 100
  };
}

function toneFor(percent, isOver) {
  if (isOver) return 'over';
  return percent >= WARN_PERCENT ? 'warn' : 'ok';
}

function roundDownToThousand(value) {
  return value >= 1000 ? Math.floor(value / 1000) * 1000 : Math.floor(value);
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function LimitedRow({ item, editable, isPastMonth, onEdit, t }) {
  const tone = toneFor(item.percent, item.isOver);
  const overAmount = item.isOver ? item.spent - item.limit : 0;
  const Tag = editable ? 'button' : 'div';
  const interactiveProps = editable ? { type: 'button', onClick: () => onEdit(item.category) } : {};

  return (
    <Tag
      className={`bdash-row tone-${tone}${item.isOver ? ' is-over' : ''}${isPastMonth ? ' is-period-overdue' : ''}`}
      {...interactiveProps}
    >
      <span className="bdash-row__icon" aria-hidden="true">
        <CategoryOutlineIcon name={item.category} size={18} />
      </span>
      <span className="bdash-row__name">
        <span className="bdash-row__name-text" title={item.category}>{item.category}</span>
        {item.isOver && (
          <span
            className="bdash-row__alert"
            role="img"
            aria-label={t('budgets.overWarning', { amount: formatCurrency(overAmount) })}
            title={t('budgets.overWarning', { amount: formatCurrency(overAmount) })}
          >
            <AlertTriangleOutlineIcon size={15} color="currentColor" />
          </span>
        )}
        {isPastMonth && <span className="bdash-period-badge">{t('budgets.periodOverdue')}</span>}
      </span>
      <span className="bdash-row__track">
        <span className="bdash-bar">
          <span className={`bdash-bar__fill tone-${tone}`} style={{ width: `${Math.min(100, item.percent)}%` }} />
        </span>
      </span>
      <span className={`bdash-row__pct tone-${tone}`}>{formatPercent(item.percent)}</span>
      <span className="bdash-row__amounts">
        <b>{formatCurrency(item.spent)}</b> / {formatCurrency(item.limit)}
      </span>
      <span className={`bdash-row__remaining tone-${tone}`}>
        {item.isOver ? (
          t('budgets.overAmount', { amount: formatCurrency(overAmount) })
        ) : (
          <>
            <span className="bdash-row__remaining-full">{t('budgets.remainingAmount', { amount: formatCurrency(item.remaining) })}</span>
            <span className="bdash-row__remaining-plain">{formatCurrency(item.remaining)}</span>
          </>
        )}
      </span>
      {editable && (
        <>
          <span className="bdash-row__chevron" aria-hidden="true"><ChevronIcon /></span>
          <span className="bdash-sr-only">{t('budgets.editRowHint')}</span>
        </>
      )}
    </Tag>
  );
}

function UnsetRow({ item, editable, onEdit, t }) {
  const Tag = editable ? 'button' : 'div';
  const interactiveProps = editable ? { type: 'button', onClick: () => onEdit(item.category) } : {};

  return (
    <Tag className="bdash-row bdash-row--unset" {...interactiveProps}>
      <span className="bdash-row__icon" aria-hidden="true">
        <CategoryOutlineIcon name={item.category} size={18} />
      </span>
      <span className="bdash-row__name">
        <span className="bdash-row__name-text" title={item.category}>{item.category}</span>
      </span>
      <span className="bdash-row__note">{t('budgets.unsetNote', { amount: formatCurrency(item.spent) })}</span>
      {editable && (
        <span className="bdash-row__action">
          {t('budgets.setLimitAction')} <span aria-hidden="true">→</span>
        </span>
      )}
    </Tag>
  );
}

export function BudgetsTab() {
  const t = useBudgetCopy();
  const selectedMonth = useSpendingStore((s) => s.selectedMonth);
  const setSelectedMonth = useSpendingStore((s) => s.setSelectedMonth);
  const { transactions, budgets, budgetMonth, expenseCategories, fetchBudgets } = useTransactionStore();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCategoryToEdit, setSelectedCategoryToEdit] = useState(null);
  const [loadState, setLoadState] = useState({ month: null, skeleton: false, error: null });
  const [retryCount, setRetryCount] = useState(0);

  // Month navigation
  const currentMonthStr = selectedMonth || getLocalMonthString();
  const localCurrentMonth = getLocalMonthString();
  const isPastMonth = isBudgetMonthOverdue(currentMonthStr, localCurrentMonth);

  // Delay the shimmer for fast responses, but keep it visible long enough if shown.
  useEffect(() => {
    if (useTransactionStore.getState().budgetMonth === currentMonthStr) {
      fetchBudgets(currentMonthStr);
      return undefined;
    }
    let active = true;
    let shimmerAt = 0;
    let holdTimer;
    setLoadState({ month: currentMonthStr, skeleton: false, error: null });
    const delayTimer = setTimeout(() => {
      if (!active) return;
      shimmerAt = Date.now();
      setLoadState({ month: currentMonthStr, skeleton: true, error: null });
    }, 150);

    fetchBudgets(currentMonthStr).then((result) => {
      if (!active) return;
      clearTimeout(delayTimer);
      const finish = () => {
        if (active) setLoadState({ month: null, skeleton: false, error: result?.success ? null : currentMonthStr });
      };
      const remaining = shimmerAt && result?.success ? Math.max(0, 325 - (Date.now() - shimmerAt)) : 0;
      if (remaining) holdTimer = setTimeout(finish, remaining);
      else finish();
    });

    return () => {
      active = false;
      clearTimeout(delayTimer);
      clearTimeout(holdTimer);
    };
  }, [currentMonthStr, fetchBudgets, retryCount]);

  const loadError = loadState.error === currentMonthStr;
  const isMonthPending = !loadError && (loadState.month === currentMonthStr || budgetMonth !== currentMonthStr);
  const showSkeleton = loadState.month === currentMonthStr && loadState.skeleton;

  const handlePrevMonth = () => {
    const [y, m] = currentMonthStr.split('-').map(Number);
    setSelectedMonth(getLocalMonthString(new Date(y, m - 2, 1)));
  };

  const handleNextMonth = () => {
    const [y, m] = currentMonthStr.split('-').map(Number);
    setSelectedMonth(getLocalMonthString(new Date(y, m, 1)));
  };

  const handleResetToCurrentMonth = () => {
    setSelectedMonth(getLocalMonthString());
  };

  const monthlyStats = useMemo(
    () => calculateMonthlyStats(transactions, currentMonthStr),
    [transactions, currentMonthStr]
  );

  const budgetModel = useMemo(() => {
    const activeNames = (expenseCategories || []).map((c) => c.name);
    const names = Array.from(new Set([...activeNames, ...Object.keys(monthlyStats.byCategory || {})]));

    let totalLimit = 0;
    let totalSpent = 0;
    let hasAnyLimit = false;

    const items = names.map((category) => {
      const rawLimit = budgets && budgets[category] !== undefined ? Number(budgets[category]) : null;
      const limit = rawLimit && rawLimit > 0 ? rawLimit : null;
      const spent = monthlyStats.byCategory[category] || 0;
      const status = getBudgetStatus(spent, limit || 0);

      if (limit !== null) {
        totalLimit += limit;
        totalSpent += spent;
        hasAnyLimit = true;
      }

      return {
        category,
        limit,
        spent,
        hasLimit: limit !== null,
        percent: limit ? status.percent : 0,
        remaining: limit ? status.remaining : null,
        isOver: limit ? status.isOver : false
      };
    });

    // Limited categories first (most used first), then unlimited by spending.
    items.sort((a, b) => {
      if (a.hasLimit && !b.hasLimit) return -1;
      if (!a.hasLimit && b.hasLimit) return 1;
      if (a.hasLimit && b.hasLimit) return b.percent - a.percent;
      return b.spent - a.spent;
    });

    // Spending in categories without a limit is not part of the totals above,
    // so it is disclosed separately instead of silently disappearing.
    const unbudgeted = items.filter((item) => !item.hasLimit && item.spent > 0);
    return {
      limited: items.filter((item) => item.hasLimit),
      unbudgeted,
      unbudgetedTotal: unbudgeted.reduce((sum, item) => sum + item.spent, 0),
      totalLimit,
      totalSpent,
      hasAnyLimit
    };
  }, [expenseCategories, monthlyStats, budgets]);

  const { limited, unbudgeted, unbudgetedTotal, totalLimit, totalSpent, hasAnyLimit } = budgetModel;
  const timeline = useMemo(() => getMonthTimeline(currentMonthStr, localCurrentMonth), [currentMonthStr, localCurrentMonth]);

  const remaining = totalLimit - totalSpent;
  const isOverallOver = hasAnyLimit && remaining < 0;
  const usedRaw = hasAnyLimit && totalLimit > 0 ? (totalSpent * 100) / totalLimit : 0;
  const usedPercent = Math.round(usedRaw);
  const heroTone = toneFor(usedPercent, isOverallOver);
  const showToday = timeline.isCurrent && hasAnyLimit;
  const pace = showToday && !isOverallOver
    ? (usedRaw > timeline.elapsedPercent + PACE_TOLERANCE ? 'fast' : 'ok')
    : null;
  const todayAlign = !showToday ? 'center' : timeline.elapsedPercent < 14 ? 'start' : timeline.elapsedPercent > 86 ? 'end' : 'center';
  const canEdit = !isPastMonth && !isMonthPending && !loadError;

  let heroLabel = t('budgets.heroRemaining');
  if (isOverallOver) heroLabel = t('budgets.heroOver');
  else if (isPastMonth) heroLabel = t('budgets.heroLeftover');
  else if (timeline.isCurrent) heroLabel = t('budgets.heroRemainingThisMonth');

  const heroStats = [];
  if (showToday) {
    heroStats.push({
      key: 'daily',
      label: t('budgets.dailyCapLabel'),
      value: formatCurrency(roundDownToThousand(Math.max(0, remaining) / timeline.daysLeft)),
      tone: remaining <= 0 ? 'over' : null
    });
    heroStats.push({
      key: 'days',
      label: t('budgets.daysLeftLabel'),
      value: t('budgets.daysLeftValue', { count: timeline.daysLeft })
    });
  }
  if (hasAnyLimit && unbudgetedTotal > 0) {
    heroStats.push({
      key: 'outside',
      label: t('budgets.unbudgetedLabel'),
      value: formatCurrency(unbudgetedTotal),
      note: unbudgeted.map((item) => item.category).join(', ')
    });
  }

  const handleOpenEdit = (category = null) => {
    if (isPastMonth || isMonthPending || loadError) return;
    setSelectedCategoryToEdit(category);
    setIsEditModalOpen(true);
  };

  const monthDisplayLabel = formatDate(monthStartDate(currentMonthStr), 'month');
  const paceDetail = t('budgets.paceDetail', {
    used: formatPercent(usedPercent),
    elapsed: formatPercent(Math.round(timeline.elapsedPercent || 0))
  });

  return (
    <div className="budgets-tab-container" role="region" aria-label="Quản lý ngân sách">
      {/* ── Header: title, month, one action ── */}
      <div className="budgets-page-header bdash-header">
        <div className="page-title-lead bdash-header__title">
          <PageTitleIcon name="budgets" />
          <div className="budgets-header-titles">
            <h2 className="budgets-view-title">Ngân sách</h2>
            <p className="budgets-view-subtitle">{t('budgets.subtitle')}</p>
          </div>
        </div>

        <div className="bdash-header__month">
          <div className="budget-month-selector" role="group" aria-label="Chọn tháng ngân sách">
            <button type="button" className="month-nav-btn" onClick={handlePrevMonth} aria-label="Xem tháng trước" title="Tháng trước">
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
            <button type="button" className="month-nav-btn" onClick={handleNextMonth} aria-label="Xem tháng sau" title="Tháng sau">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            {currentMonthStr !== localCurrentMonth && (
              <button type="button" className="month-today-btn" onClick={handleResetToCurrentMonth} aria-label="Quay về tháng hiện tại">
                Về tháng này
              </button>
            )}
          </div>
        </div>

        <div className="bdash-header__action">
          {isPastMonth ? (
            <span className="bdash-closed" title={t('budgets.closedPeriodHint')}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Đã đóng kỳ</span>
            </span>
          ) : (
            <button
              type="button"
              className="bdash-edit-btn"
              onClick={() => handleOpenEdit(null)}
              disabled={isMonthPending || loadError}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
              <span>{hasAnyLimit ? t('budgets.editLimits') : t('budgets.setupLimits')}</span>
            </button>
          )}
        </div>
      </div>

      {loadError ? (
        <div className="budget-load-error" role="alert">
          <span>{t('budgets.loadFailed')}</span>
          <button type="button" className="btn btn--secondary" onClick={() => setRetryCount((count) => count + 1)}>{t('common.tryAgain')}</button>
        </div>
      ) : (
        <div className={`budget-month-data ${isMonthPending && !showSkeleton ? 'is-pending' : ''}`} aria-busy={isMonthPending}>
          {isMonthPending && !showSkeleton && <div className="budget-pending-overlay" role="status">{t('common.loading')}</div>}

          {/* ── Hero: the one number that matters, plus pace through the month ── */}
          {showSkeleton ? (
            <section className="bdash-hero is-skeleton" aria-hidden="true">
              <span className="budget-skeleton-line is-label" />
              <span className="budget-skeleton-line is-value" />
              <span className="budget-skeleton-line is-meter" />
            </section>
          ) : hasAnyLimit ? (
            <section className={`bdash-hero tone-${heroTone}`} aria-labelledby="bdash-hero-label">
              <div className="bdash-hero__top">
                <div className="bdash-hero__headline">
                  <span id="bdash-hero-label" className="bdash-hero__label">{heroLabel}</span>
                  <strong className="bdash-hero__value">{formatCurrency(Math.abs(remaining))}</strong>
                </div>
                {pace && (
                  <span className={`bdash-chip is-${pace}`} title={paceDetail}>
                    <i aria-hidden="true" />
                    {pace === 'fast' ? t('budgets.paceFast') : t('budgets.paceOk')}
                    <span className="bdash-sr-only"> — {paceDetail}</span>
                  </span>
                )}
              </div>

              <div className="bdash-hero__meter-labels">
                <span>{t('budgets.spentShort')} <b>{formatCurrency(totalSpent)}</b> · {formatPercent(usedPercent)}</span>
                <span>{t('budgets.limitShort')} <b className="bdash-hero__limit-value">{formatCurrency(totalLimit)}</b></span>
              </div>
              <div
                className="bdash-meter"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, usedPercent)}
                aria-label={t('budgets.progressLabel', { percent: formatPercent(usedPercent) })}
              >
                <span className={`bdash-meter__fill tone-${heroTone}`} style={{ width: `${Math.min(100, usedRaw)}%` }} />
                {showToday && <span className="bdash-meter__today" style={{ left: `${timeline.elapsedPercent}%` }} />}
              </div>
              {showToday && (
                <div className="bdash-meter__today-row">
                  <span className={`bdash-meter__today-label align-${todayAlign}`} style={{ left: `${timeline.elapsedPercent}%` }}>
                    {t('budgets.todayMarker', { day: timeline.day, days: timeline.daysInMonth })}
                  </span>
                </div>
              )}

              {heroStats.length > 0 && (
                <dl className={`bdash-hero__stats has-${heroStats.length}`}>
                  {heroStats.map((stat) => (
                    <div key={stat.key} className={`bdash-stat is-${stat.key}`}>
                      <dt>{stat.label}</dt>
                      <dd className={stat.tone ? `tone-${stat.tone}` : undefined}>
                        {stat.value}
                        {stat.note && <small title={stat.note}> · {stat.note}</small>}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          ) : (
            <section className="bdash-hero is-empty" aria-labelledby="bdash-hero-label">
              <span id="bdash-hero-label" className="bdash-hero__label">
                {timeline.isCurrent ? t('budgets.heroSpentThisMonth') : t('budgets.spentShort')}
              </span>
              <strong className="bdash-hero__value">{formatCurrency(monthlyStats.totalExpense)}</strong>
              <p className="bdash-hero__hint">{t('budgets.heroNoLimitsHint')}</p>
            </section>
          )}

          {/* ── Categories: one table on wide screens, two-line rows on phones ── */}
          <section className="bdash-card" aria-labelledby="bdash-list-title">
            <div className="bdash-card__head">
              <h3 id="bdash-list-title" className="bdash-card__title">{t('budgets.categoriesTitle')}</h3>
              {!showSkeleton && limited.length > 0 && (
                <div className="bdash-card__meta">
                  {showToday && (
                    <span className="bdash-legend">
                      <i aria-hidden="true" />
                      {t('budgets.today')}
                    </span>
                  )}
                  {limited.length > 1 && <span className="bdash-card__hint">{t('budgets.sortHint')}</span>}
                </div>
              )}
            </div>

            {showSkeleton ? (
              <ul className="bdash-rows" aria-hidden="true">
                {Array.from({ length: Math.max(3, Math.min(6, limited.length + unbudgeted.length)) }, (_, index) => (
                  <li key={index} className="bdash-row is-skeleton">
                    <span className="bdash-row__icon" />
                    <span className="budget-skeleton-line is-label" />
                    <span className="budget-skeleton-line is-value" />
                  </li>
                ))}
              </ul>
            ) : limited.length + unbudgeted.length === 0 ? (
              <div className="bdash-empty" role="status">
                <BulbOutlineIcon size={20} color="currentColor" />
                <p>{t('budgets.emptyList')}</p>
              </div>
            ) : (
              <div
                className={`bdash-table${showToday ? ' has-today' : ''}`}
                style={showToday ? { '--bdash-today': `${timeline.elapsedPercent}%` } : undefined}
              >
                {limited.length > 0 && (
                  <>
                    <div className="bdash-row bdash-row--head" aria-hidden="true">
                      <span className="bdash-row__head-cat">{t('budgets.colCategory')}</span>
                      <span className="bdash-row__track">{t('budgets.colProgress')}</span>
                      <span className="bdash-row__pct">{t('budgets.colUsed')}</span>
                      <span className="bdash-row__amounts">{t('budgets.colSpentLimit')}</span>
                      <span className="bdash-row__remaining">{t('budgets.colRemaining')}</span>
                    </div>
                    <ul className="bdash-rows">
                      {limited.map((item) => (
                        <li key={item.category} className="bdash-item">
                          <LimitedRow item={item} editable={canEdit} isPastMonth={isPastMonth} onEdit={handleOpenEdit} t={t} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {unbudgeted.length > 0 && (
                  <>
                    <h4 className="bdash-group-title">{t('budgets.unsetGroup')}</h4>
                    <ul className="bdash-rows">
                      {unbudgeted.map((item) => (
                        <li key={item.category} className="bdash-item">
                          <UnsetRow item={item} editable={canEdit} onEdit={handleOpenEdit} t={t} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}

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
