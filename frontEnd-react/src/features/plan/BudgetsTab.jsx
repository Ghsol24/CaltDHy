import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { BudgetEditModal } from './BudgetEditModal';
import { formatCurrency, formatPercent, formatDate, getLocalMonthString } from '../../utils/formatters';
import { monthPeriod, shiftMonth } from '../../utils/budgetPeriod';
import { buildBudgetModel } from '../../utils/budgetModel';
import { CategoryOutlineIcon, BulbOutlineIcon, AlertTriangleOutlineIcon } from '../../utils/categoryIcons';
import { useBudgetCopy } from './budgetCopy';
import { PageTitleIcon } from '../../components/ui/NavIcons';

// Colour follows how much of a limit is used, never the category itself.
const WARN_PERCENT = 80;
// How far (in percentage points) spending may run ahead of the calendar before
// the month is flagged as "spending faster than planned".
const PACE_TOLERANCE = 10;
// Phones: a quick, clearly horizontal swipe on the month content changes month.
// Touches starting at the screen edges are left to the system back gesture.
const SWIPE_MIN_PX = 56;
const SWIPE_EDGE_PX = 24;
const SWIPE_MAX_MS = 700;
// Neighbouring months are fetched shortly after a month settles on screen.
const PREFETCH_DELAY_MS = 120;

function monthStartDate(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

function getMonthTimeline(monthStr, todayMonthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const period = monthPeriod(monthStr, todayMonthStr);
  if (period === 'current') {
    const day = new Date().getDate();
    return { period, day, daysInMonth, daysLeft: daysInMonth - day + 1, elapsedPercent: (day / daysInMonth) * 100 };
  }
  if (period === 'future') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { period, daysInMonth, startsIn: Math.round((new Date(year, month - 1, 1) - today) / 86400000) };
  }
  return { period, daysInMonth };
}

function toneFor(percent, isOver) {
  if (isOver) return 'over';
  return percent >= WARN_PERCENT ? 'warn' : 'ok';
}

function roundDownToThousand(value) {
  return value >= 1000 ? Math.floor(value / 1000) * 1000 : Math.floor(value);
}

const capitalize = (text) => (text ? text.charAt(0).toLocaleUpperCase() + text.slice(1) : text);

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function LimitedRow({ item, editable, period, onEdit, t }) {
  const tone = toneFor(item.percent, item.isOver);
  const overAmount = item.isOver ? item.spent - item.limit : 0;
  const Tag = editable ? 'button' : 'div';
  const interactiveProps = editable ? { type: 'button', onClick: () => onEdit(item.category) } : {};

  return (
    <Tag className={`bdash-row tone-${tone}${item.isOver ? ' is-over' : ''}`} {...interactiveProps}>
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
        ) : period === 'past' ? (
          t('budgets.leftoverAmount', { amount: formatCurrency(item.remaining) })
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
  const selectedMonthRaw = useSpendingStore((s) => s.selectedMonth);
  const setSelectedMonth = useSpendingStore((s) => s.setSelectedMonth);
  const transactions = useTransactionStore((s) => s.transactions);
  const expenseCategories = useTransactionStore((s) => s.expenseCategories);
  const budgetsByMonth = useTransactionStore((s) => s.budgetsByMonth);
  const fetchBudgets = useTransactionStore((s) => s.fetchBudgets);
  const prefetchBudgetMonths = useTransactionStore((s) => s.prefetchBudgetMonths);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCategoryToEdit, setSelectedCategoryToEdit] = useState(null);
  const [shownMonth, setShownMonth] = useState(null);
  const [failedMonth, setFailedMonth] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const contentRef = useRef(null);
  const animatedMonthRef = useRef(null);
  const swipeRef = useRef(null);

  const localCurrentMonth = getLocalMonthString();
  const selectedMonth = selectedMonthRaw || localCurrentMonth;
  const selectedReady = Boolean(budgetsByMonth[selectedMonth]);
  // Months swap in one piece: until the selected month's limits are in, the last
  // complete month stays on screen, so spending and limits never mix two months.
  const displayedMonth = selectedReady ? selectedMonth : shownMonth;
  const loadError = !selectedReady && failedMonth === selectedMonth;
  const isSwitching = !selectedReady && !loadError;

  useEffect(() => {
    if (selectedReady && shownMonth !== selectedMonth) setShownMonth(selectedMonth);
  }, [selectedReady, selectedMonth, shownMonth]);

  // Load (or quietly revalidate) the selected month; cached months show at once.
  useEffect(() => {
    let active = true;
    setFailedMonth(null);
    fetchBudgets(selectedMonth).then((result) => {
      if (active && !result?.success) setFailedMonth(selectedMonth);
    });
    return () => { active = false; };
  }, [selectedMonth, fetchBudgets, retryCount]);

  useEffect(() => {
    if (!displayedMonth) return undefined;
    const timer = setTimeout(() => {
      prefetchBudgetMonths([shiftMonth(displayedMonth, -1), shiftMonth(displayedMonth, 1)]);
    }, PREFETCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [displayedMonth, prefetchBudgetMonths]);

  // A short fade and 12px shift in the direction of travel; bars morph on their own.
  useLayoutEffect(() => {
    const from = animatedMonthRef.current;
    animatedMonthRef.current = displayedMonth;
    const element = contentRef.current;
    if (!from || !displayedMonth || from === displayedMonth || typeof element?.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const direction = displayedMonth > from ? 1 : -1;
    element.animate([
      { opacity: 0.4, transform: `translateX(${direction * 12}px)` },
      { opacity: 1, transform: 'translateX(0)' }
    ], { duration: 160, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
  }, [displayedMonth]);

  const handlePrevMonth = () => setSelectedMonth(shiftMonth(selectedMonth, -1));
  const handleNextMonth = () => setSelectedMonth(shiftMonth(selectedMonth, 1));
  const handleResetToCurrentMonth = () => setSelectedMonth(localCurrentMonth);
  // Desktop: pointing at an arrow warms the next two months that way, so even a
  // double click lands on cached data.
  const warmMonths = (direction) => prefetchBudgetMonths([shiftMonth(selectedMonth, direction), shiftMonth(selectedMonth, 2 * direction)]);
  const handleMonthKeys = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') handlePrevMonth();
    else handleNextMonth();
  };

  const handleTouchStart = (event) => {
    const touch = event.touches[0];
    swipeRef.current = event.touches.length === 1 && touch.clientX > SWIPE_EDGE_PX
      && touch.clientX < window.innerWidth - SWIPE_EDGE_PX
      ? { x: touch.clientX, y: touch.clientY, at: Date.now() } : null;
  };
  const handleTouchEnd = (event) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch || isEditModalOpen) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Date.now() - start.at > SWIPE_MAX_MS || Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < 2 * Math.abs(dy)) return;
    if (dx < 0) handleNextMonth();
    else handlePrevMonth();
  };

  const categoryNames = useMemo(() => (expenseCategories || []).map((c) => c.name), [expenseCategories]);
  const displayedBudgets = displayedMonth ? budgetsByMonth[displayedMonth]?.data : null;
  const model = useMemo(() => (displayedMonth && displayedBudgets
    ? buildBudgetModel({ transactions, month: displayedMonth, budgets: displayedBudgets, categoryNames })
    : null), [transactions, displayedMonth, displayedBudgets, categoryNames]);
  const previousMonth = displayedMonth ? shiftMonth(displayedMonth, -1) : null;
  const previousBudgets = previousMonth ? budgetsByMonth[previousMonth]?.data : null;
  const previousModel = useMemo(() => (previousBudgets
    ? buildBudgetModel({ transactions, month: previousMonth, budgets: previousBudgets, categoryNames })
    : null), [transactions, previousMonth, previousBudgets, categoryNames]);

  const timeline = useMemo(
    () => getMonthTimeline(displayedMonth || selectedMonth, localCurrentMonth),
    [displayedMonth, selectedMonth, localCurrentMonth]
  );
  const period = timeline.period;
  const isPastMonth = period === 'past';
  const canEdit = Boolean(model) && !isPastMonth && !isSwitching && !loadError;
  const onCurrentMonth = selectedMonth === localCurrentMonth;

  const handleOpenEdit = (category = null) => {
    if (!canEdit) return;
    setSelectedCategoryToEdit(category);
    setIsEditModalOpen(true);
  };

  const monthDisplayLabel = formatDate(monthStartDate(selectedMonth), 'month');
  const hero = model && model.hasAnyLimit ? (() => {
    const { remaining, isOver, usedRaw, usedPercent, totalSpent, totalLimit, limited, overCount } = model;
    const heroTone = toneFor(usedPercent, isOver);
    const pace = period === 'current' && !isOver
      ? (usedRaw > timeline.elapsedPercent + PACE_TOLERANCE ? 'fast' : 'ok') : null;
    const paceDetail = t('budgets.paceDetail', {
      used: formatPercent(usedPercent), elapsed: formatPercent(Math.round(timeline.elapsedPercent || 0))
    });

    let label = t('budgets.heroRemaining');
    if (isOver) label = t('budgets.heroOver');
    else if (period === 'past') label = t('budgets.heroLeftover');
    else if (period === 'current') label = t('budgets.heroRemainingThisMonth');

    // Every period fills the same slots, so switching month never changes the height.
    let chip;
    if (isOver) chip = { tone: 'over', text: t('budgets.chipOver', { percent: formatPercent(usedPercent - 100) }) };
    else if (pace) chip = { tone: pace, text: t(pace === 'fast' ? 'budgets.paceFast' : 'budgets.paceOk'), detail: paceDetail };
    else if (period === 'past') chip = { tone: 'ok', text: t('budgets.chipLeftover', { percent: formatPercent(100 - usedPercent) }) };
    else chip = { tone: 'idle', text: t('budgets.chipNotStarted') };

    let marker;
    if (period === 'current') {
      const align = timeline.elapsedPercent < 14 ? 'start' : timeline.elapsedPercent > 86 ? 'end' : 'center';
      marker = { left: timeline.elapsedPercent, align, text: t('budgets.todayMarker', { day: timeline.day, days: timeline.daysInMonth }) };
    } else if (period === 'past') {
      marker = { left: 100, align: 'end', text: t('budgets.periodEnded', { days: timeline.daysInMonth }) };
    } else {
      marker = { left: 0, align: 'start', text: t('budgets.periodStarts', { date: formatDate(`${displayedMonth}-01`, 'compact') }) };
    }

    let stats;
    if (period === 'current') {
      stats = [
        { key: 'daily', label: t('budgets.dailyCapLabel'),
          value: formatCurrency(roundDownToThousand(Math.max(0, remaining) / timeline.daysLeft)), tone: remaining <= 0 ? 'over' : null },
        { key: 'days', label: t('budgets.daysLeftLabel'), value: t('budgets.daysLeftValue', { count: timeline.daysLeft }) }
      ];
    } else if (period === 'past') {
      stats = [
        { key: 'average', label: t('budgets.avgDailyLabel'), value: formatCurrency(Math.round(totalSpent / timeline.daysInMonth)) },
        { key: 'overCount', label: t('budgets.overCountLabel'),
          value: t('budgets.overCountValue', { count: overCount, total: limited.length }), tone: overCount > 0 ? 'over' : null }
      ];
    } else {
      stats = [
        { key: 'dailyLimit', label: t('budgets.dailyLimitLabel'), value: formatCurrency(roundDownToThousand(totalLimit / timeline.daysInMonth)) },
        { key: 'startsIn', label: t('budgets.startsInLabel'), value: t('budgets.daysLeftValue', { count: timeline.startsIn }) }
      ];
    }

    // How the month before ended; the line keeps its height while that month loads.
    const previousLabel = capitalize(formatDate(monthStartDate(previousMonth), 'month'));
    let previous = null;
    if (previousModel && !previousModel.hasAnyLimit) {
      previous = { tone: 'muted', text: t('budgets.prevNoLimit', { month: previousLabel }) };
    } else if (previousModel?.isOver) {
      previous = { tone: 'over', text: t('budgets.prevOver', { month: previousLabel, amount: formatCurrency(-previousModel.remaining) }) };
    } else if (previousModel) {
      previous = { tone: 'ok', text: t('budgets.prevLeftover', { month: previousLabel, amount: formatCurrency(previousModel.remaining) }) };
    }

    return { heroTone, label, chip, marker, stats, previous, previousLabel, remaining, usedRaw, usedPercent, totalSpent, totalLimit };
  })() : null;

  const limited = model?.limited || [];
  const unbudgeted = model?.unbudgeted || [];
  const showToday = period === 'current' && Boolean(hero);

  return (
    <div className="budgets-tab-container" role="region" aria-label="Quản lý ngân sách">
      {/* ── Header: title, month, one action ── */}
      <div className="budgets-page-header bdash-header">
        <div className="page-title-lead bdash-header__title">
          <PageTitleIcon name="budgets" />
          <div className="budgets-header-titles">
            <h1 className="budgets-view-title">Ngân sách</h1>
            <p className="budgets-view-subtitle">{t('budgets.subtitle')}</p>
          </div>
        </div>

        <div className="bdash-header__month">
          <div className="budget-month-selector" role="group" aria-label={t('budgets.monthPicker')}
            aria-keyshortcuts="ArrowLeft ArrowRight" onKeyDown={handleMonthKeys}>
            <button type="button" className="month-nav-btn month-nav-btn--prev" onClick={handlePrevMonth}
              onPointerEnter={() => warmMonths(-1)} onFocus={() => warmMonths(-1)}
              aria-label={t('budgets.prevMonth')} title={t('budgets.prevMonth')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="month-current-display" aria-live="polite">
              <span className={`month-icon${isSwitching ? ' is-loading' : ''}`} aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
                <span className="month-spinner" />
              </span>
              <strong className="month-name-text">{monthDisplayLabel}</strong>
            </div>
            <button type="button" className="month-nav-btn month-nav-btn--next" onClick={handleNextMonth}
              onPointerEnter={() => warmMonths(1)} onFocus={() => warmMonths(1)}
              aria-label={t('budgets.nextMonth')} title={t('budgets.nextMonth')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            {/* Always rendered so the switcher never changes size; idle on the current month. */}
            <button type="button" className={`month-today-btn${onCurrentMonth ? ' is-idle' : ''}`}
              onClick={handleResetToCurrentMonth} aria-hidden={onCurrentMonth || undefined}
              tabIndex={onCurrentMonth ? -1 : undefined}>
              {t('budgets.backToCurrent')}
            </button>
          </div>
        </div>

        <div className="bdash-header__action">
          {isPastMonth ? (
            <span className="bdash-closed" title={t('budgets.closedPeriodHint')}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>{t('budgets.closed')}</span>
            </span>
          ) : (
            <button
              type="button"
              className="bdash-edit-btn"
              onClick={() => handleOpenEdit(null)}
              disabled={!canEdit}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
              <span>{model?.hasAnyLimit ? t('budgets.editLimits') : t('budgets.setupLimits')}</span>
            </button>
          )}
        </div>
      </div>

      <div
        ref={contentRef}
        className="budget-month-data"
        aria-busy={isSwitching}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => { swipeRef.current = null; }}
      >
        {loadError ? (
          <div className="budget-load-error" role="alert">
            <span>{t('budgets.loadFailed')}</span>
            <button type="button" className="btn btn--secondary" onClick={() => setRetryCount((count) => count + 1)}>{t('common.tryAgain')}</button>
          </div>
        ) : (
          <>
            {/* ── Hero: the one number that matters, plus where the month stands ── */}
            {!model ? (
              <section className="bdash-hero is-skeleton" aria-hidden="true">
                <span className="budget-skeleton-line is-label" />
                <span className="budget-skeleton-line is-value" />
                <span className="budget-skeleton-line is-meter" />
              </section>
            ) : hero ? (
              <section className={`bdash-hero tone-${hero.heroTone}`} aria-labelledby="bdash-hero-label">
                <div className="bdash-hero__top">
                  <div className="bdash-hero__headline">
                    <span id="bdash-hero-label" className="bdash-hero__label">{hero.label}</span>
                    <strong className="bdash-hero__value">{formatCurrency(Math.abs(hero.remaining))}</strong>
                  </div>
                  <span className={`bdash-chip is-${hero.chip.tone}`} title={hero.chip.detail}>
                    <i aria-hidden="true" />
                    {hero.chip.text}
                    {hero.chip.detail && <span className="bdash-sr-only"> — {hero.chip.detail}</span>}
                  </span>
                </div>

                <div className="bdash-hero__meter-labels">
                  <span>{t('budgets.spentShort')} <b>{formatCurrency(hero.totalSpent)}</b> · {formatPercent(hero.usedPercent)}</span>
                  <span>{t('budgets.limitShort')} <b className="bdash-hero__limit-value">{formatCurrency(hero.totalLimit)}</b></span>
                </div>
                <div
                  className="bdash-meter"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(100, hero.usedPercent)}
                  aria-label={t('budgets.progressLabel', { percent: formatPercent(hero.usedPercent) })}
                >
                  <span className={`bdash-meter__fill tone-${hero.heroTone}`} style={{ width: `${Math.min(100, hero.usedRaw)}%` }} />
                  {showToday && <span className="bdash-meter__today" style={{ left: `${timeline.elapsedPercent}%` }} />}
                </div>
                <div className="bdash-meter__today-row">
                  <span className={`bdash-meter__today-label align-${hero.marker.align}`} style={{ left: `${hero.marker.left}%` }}>
                    {hero.marker.text}
                  </span>
                </div>

                {/* The link is rendered even while that month loads (hidden), so the line
                    has the same height either way, touch-target sizing included. */}
                <p className={`bdash-hero__previous${hero.previous ? ` tone-${hero.previous.tone}` : ''}`}>
                  <span className="bdash-hero__previous-text" title={hero.previous?.text}>{hero.previous?.text || ' '}</span>
                  <button type="button" className={`bdash-hero__previous-link${hero.previous ? '' : ' is-pending'}`}
                    onClick={() => setSelectedMonth(previousMonth)} aria-hidden={hero.previous ? undefined : true}
                    tabIndex={hero.previous ? undefined : -1} aria-label={t('budgets.viewMonthAria', { month: hero.previousLabel })}>
                    {t('budgets.viewMonth')}
                  </button>
                </p>

                <dl className="bdash-hero__stats has-2">
                  {hero.stats.map((stat) => (
                    <div key={stat.key} className={`bdash-stat is-${stat.key}`}>
                      <dt>{stat.label}</dt>
                      <dd className={stat.tone ? `tone-${stat.tone}` : undefined}>{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : (
              <section className="bdash-hero is-empty" aria-labelledby="bdash-hero-label">
                <span id="bdash-hero-label" className="bdash-hero__label">
                  {period === 'current' ? t('budgets.heroSpentThisMonth') : t('budgets.spentShort')}
                </span>
                <strong className="bdash-hero__value">{formatCurrency(model.totalExpense)}</strong>
                <p className="bdash-hero__hint">{t('budgets.heroNoLimitsHint')}</p>
              </section>
            )}

            {/* ── Categories: one table on wide screens, two-line rows on phones ── */}
            <section className="bdash-card" aria-labelledby="bdash-list-title">
              <div className="bdash-card__head">
                <h3 id="bdash-list-title" className="bdash-card__title">{t('budgets.categoriesTitle')}</h3>
                {model && limited.length > 0 && (
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

              {!model ? (
                <ul className="bdash-rows" aria-hidden="true">
                  {Array.from({ length: 4 }, (_, index) => (
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
                        <span className="bdash-row__remaining">{t(isPastMonth ? 'budgets.colResult' : 'budgets.colRemaining')}</span>
                      </div>
                      <ul className="bdash-rows">
                        {limited.map((item) => (
                          <li key={item.category} className="bdash-item">
                            <LimitedRow item={item} editable={canEdit} period={period} onEdit={handleOpenEdit} t={t} />
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {unbudgeted.length > 0 && (
                    <>
                      <h4 className="bdash-group-title">
                        {t('budgets.unsetGroup')}
                        <span className="bdash-group-title__total">{formatCurrency(model.unbudgetedTotal)}</span>
                      </h4>
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
          </>
        )}
      </div>

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
