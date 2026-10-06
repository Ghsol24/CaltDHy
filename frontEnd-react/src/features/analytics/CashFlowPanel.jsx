import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CheckOutlineIcon, ClockOutlineIcon, CloseOutlineIcon, StarOutlineIcon, TrendOutlineIcon } from '../../components/ui/AppIcons';
import { CashFlowPopover } from './CashFlowPopover';
import { formatCurrency, formatDate, getLocalDateString } from '../../utils/formatters';
import '../../assets/css/cash-flow.css';

const PERIOD_OPTIONS = [
  { value: 'daily', label: 'oneMonth', detail: 'byDay' },
  { value: '3months', label: 'threeMonths', detail: 'byMonth' },
  { value: '6months', label: 'sixMonths', detail: 'byMonth' },
];
const SERIES_OPTIONS = ['expense', 'income', 'both'];

function SmallIcon({ children, className = '' }) {
  return <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

function ChevronIcon() {
  return <SmallIcon><polyline points="6 9 12 15 18 9" /></SmallIcon>;
}

function SearchIcon() {
  return <SmallIcon><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></SmallIcon>;
}

/** Presentation only: data aggregation, persistence and the chart are supplied by AnalyticsView. */
export function CashFlowPanel({
  t, lang, intlLocale, periodMode, series, excludeRecurring, activeMonth, periodLabel, summary,
  chart, weekNavigation, hasData, emptyMessage, topDays = [], unusualContent,
  onPeriodModeChange, onSeriesChange, onExcludeRecurringChange, onMonthChange,
  onOpenDay, onViewHistory, onPinDefault, onClearDefault, pinnedDefault,
  savingPreferences = false, drilldownOrigin, onBackToPeriod, currentMonth, latestMonth, preferenceMode = periodMode,
}) {
  const id = useId();
  const [popover, setPopover] = useState(null);
  const [inspectedDate, setInspectedDate] = useState('');
  const [showAllDays, setShowAllDays] = useState(false);
  const triggersRef = useRef({});
  const isIncomeOnly = series === 'income';
  const visibleDays = topDays.slice(0, showAllDays ? 5 : 3);
  const ongoing = activeMonth === currentMonth;
  const text = (key, values) => t(`analytics.cashflow.${key}`, values);
  const isCurrentDefault = pinnedDefault?.mode === preferenceMode
    && pinnedDefault?.series === series && pinnedDefault?.excludeRecurring === excludeRecurring;
  const [monthYear, monthNumber] = activeMonth.split('-').map(Number);
  const rangeMonthCount = periodMode === '6months' ? 6 : periodMode === '3months' ? 3 : 1;
  const monthAnchor = new Date(`${activeMonth}-01T00:00:00`);
  const firstMonthDate = new Date(monthAnchor);
  firstMonthDate.setMonth(monthNumber - rangeMonthCount);
  const lastMonthDate = new Date(monthAnchor);
  lastMonthDate.setMonth(monthNumber, 0);
  const dateMin = firstMonthDate.getFullYear() < 1 ? '0001-01-01'
    : `${String(firstMonthDate.getFullYear()).padStart(4, '0')}-${String(firstMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
  const dateMax = `${activeMonth}-${String(lastMonthDate.getDate()).padStart(2, '0')}`;
  const rangeCrossesYear = firstMonthDate.getFullYear() !== monthYear;
  const dayLabelFormatter = useMemo(() => new Intl.DateTimeFormat(intlLocale || lang, {
    day: 'numeric', month: 'short', ...(rangeCrossesYear ? { year: 'numeric' } : {}),
  }), [intlLocale, lang, rangeCrossesYear]);

  useEffect(() => { setShowAllDays(false); }, [periodLabel, excludeRecurring, series]);

  const closePopover = useCallback(() => setPopover(null), []);

  const togglePopover = (name) => {
    if (name === 'date' && (!inspectedDate || inspectedDate < dateMin || inspectedDate > dateMax)) {
      setInspectedDate(activeMonth === currentMonth ? getLocalDateString() : `${activeMonth}-01`);
    }
    setPopover((open) => open === name ? null : name);
  };

  const defaultDescription = pinnedDefault ? text('defaultSummary', {
    series: text(pinnedDefault.series),
    period: text(PERIOD_OPTIONS.find((option) => option.value === pinnedDefault.mode)?.label || 'oneMonth'),
    recurring: text(pinnedDefault.excludeRecurring ? 'recurringExcluded' : 'recurringIncluded'),
  }) : null;

  const popoverContent = popover && (
    <CashFlowPopover key={popover} id={`${id}-${popover}`} name={popover}
      triggersRef={triggersRef} onClose={closePopover}>
        <div className="cashflow-popover__heading">
          <h4 id={`${id}-${popover}-title`}>{text(popover === 'date' ? 'daySearch' : popover)}</h4>
          <button type="button" className="cashflow-icon-button" onClick={() => setPopover(null)}
            aria-label={t('common.close')}><CloseOutlineIcon size={18} /></button>
        </div>
        {popover === 'period' && <>
          <fieldset className="cashflow-options">
            <legend className="cashflow-visually-hidden">{text('period')}</legend>
            {PERIOD_OPTIONS.map((option) => <label className="cashflow-option" key={option.value}>
              <input type="radio" name={`${id}-period`} value={option.value} checked={periodMode === option.value}
                onChange={() => onPeriodModeChange(option.value)} />
              <span className="cashflow-option__copy"><strong>{text(option.label)}</strong><small>{text(option.detail)}</small></span>
              <CheckOutlineIcon className="cashflow-option__check" size={17} />
            </label>)}
          </fieldset>
          <div className="cashflow-month-control">
            <label htmlFor={`${id}-month`}>{text(periodMode === 'daily' ? 'monthToView' : 'endMonth')}</label>
            <input type="month" id={`${id}-month`} data-testid="cashflow-month-input" value={activeMonth}
              min="0001-01" max={latestMonth} onChange={(event) => {
                const month = event.target.value;
                if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number(month.slice(0, 4)) > 0
                  && (!latestMonth || month <= latestMonth)) onMonthChange(month);
              }} />
          </div>
        </>}
        {popover === 'display' && <>
          <fieldset className="cashflow-options">
            <legend className="cashflow-visually-hidden">{text('display')}</legend>
            {SERIES_OPTIONS.map((value) => <label className="cashflow-option" key={value}>
              <input type="radio" name={`${id}-series`} value={value} checked={series === value}
                onChange={() => onSeriesChange(value)} />
              <span className={`cashflow-series-swatch cashflow-series-swatch--${value}`} aria-hidden="true" />
              <span className="cashflow-option__copy"><strong>{text(value)}</strong></span>
              <CheckOutlineIcon className="cashflow-option__check" size={17} />
            </label>)}
          </fieldset>
          <label className="cashflow-recurring-control">
            <span><strong>{text('includeRecurring')}</strong><small>{text('scopeHint')}</small></span>
            <input type="checkbox" data-testid="cashflow-recurring-input" checked={!excludeRecurring}
              disabled={savingPreferences} onChange={(event) => onExcludeRecurringChange(!event.target.checked)} />
          </label>
          <div className="cashflow-default-control" aria-busy={savingPreferences}>
            <div className="cashflow-default-control__status" data-testid="cashflow-default-status">
              {pinnedDefault ? <StarOutlineIcon size={16} /> : <ClockOutlineIcon size={16} />}
              <strong>{text(pinnedDefault ? 'pinnedView' : 'rememberLast')}</strong>
            </div>
            {defaultDescription && <p>{defaultDescription}</p>}
            <p>{text('preferenceScope')}</p>
            <div className="cashflow-default-control__actions">
              <button type="button" className="cashflow-text-button" data-testid="cashflow-pin-default"
                disabled={savingPreferences || isCurrentDefault} onClick={onPinDefault}>
                <StarOutlineIcon size={16} />{text(isCurrentDefault ? 'alreadyDefault' : 'pinDefault')}
              </button>
              {pinnedDefault && <button type="button" className="cashflow-text-button cashflow-text-button--muted"
                data-testid="cashflow-clear-default" disabled={savingPreferences} onClick={onClearDefault}>{text('clearDefault')}</button>}
            </div>
            {savingPreferences && <span className="cashflow-save-status" role="status">{t('common.saving')}</span>}
          </div>
        </>}
        {popover === 'date' && <form className="cashflow-date-form" onSubmit={(event) => {
          event.preventDefault();
          if (!inspectedDate) return;
          setPopover(null);
          onOpenDay(inspectedDate, isIncomeOnly ? 'income' : 'expense');
        }}>
          <p>{text('daySearchHelp')}</p>
          <label htmlFor={`${id}-date-input`}>{t('analytics.pickDay')}</label>
          <input type="date" id={`${id}-date-input`} data-testid="cashflow-date-input" required value={inspectedDate}
            min={dateMin} max={dateMax}
            onChange={(event) => setInspectedDate(event.target.value)} />
          <button type="submit" data-testid="cashflow-date-open" className="cashflow-primary-button">{text('openDay')}</button>
          <button type="button" className="cashflow-text-button" onClick={() => { setPopover(null); onViewHistory(); }}>
            {t('analytics.viewHistory')}
          </button>
        </form>}
    </CashFlowPopover>
  );

  return <section className="analytics-section-panel cashflow-panel" id="analytics-cashflow" data-testid="cashflow-panel"
    aria-labelledby={`${id}-title`}>
    <header className="cashflow-header">
      <h3 id={`${id}-title`}><TrendOutlineIcon size={20} />{t('nav.cashFlowTrend')}</h3>
      <div className="cashflow-controls">
        <button type="button" className="cashflow-control" data-testid="cashflow-period-trigger"
          ref={(node) => { triggersRef.current.period = node; }} onClick={() => togglePopover('period')}
          aria-haspopup="dialog" aria-expanded={popover === 'period'} aria-controls={popover === 'period' ? `${id}-period` : undefined}
          aria-label={`${text('period')}: ${periodLabel}`}>
          <SmallIcon><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></SmallIcon>
          <span>{periodLabel}</span><ChevronIcon />
        </button>
        <button type="button" className="cashflow-control" data-testid="cashflow-display-trigger"
          ref={(node) => { triggersRef.current.display = node; }} onClick={() => togglePopover('display')}
          aria-haspopup="dialog" aria-expanded={popover === 'display'} aria-controls={popover === 'display' ? `${id}-display` : undefined}
          aria-label={`${text('display')}: ${text(series)}`}>
          <span className={`cashflow-series-swatch cashflow-series-swatch--${series}`} aria-hidden="true" />
          <span>{text(series)}</span><ChevronIcon />
        </button>
        <button type="button" className="cashflow-date-trigger" data-testid="cashflow-date-trigger"
          ref={(node) => { triggersRef.current.date = node; }} onClick={() => togglePopover('date')}
          aria-label={text('daySearchAria')} title={text('daySearchAria')} aria-haspopup="dialog"
          aria-expanded={popover === 'date'} aria-controls={popover === 'date' ? `${id}-date` : undefined}>
          <SearchIcon /><span>{text('daySearch')}</span>
        </button>
      </div>
    </header>
    <div className="cashflow-context">
      <div className="cashflow-current-view" aria-live="polite">
        <span>{text(series)} · {text(periodMode === 'daily' ? 'byDay' : 'byMonth')}</span>
        <span className="cashflow-scope"><ClockOutlineIcon size={13} />{text(excludeRecurring ? 'recurringExcluded' : 'recurringIncluded')}</span>
        {ongoing && <span className="cashflow-ongoing" title={text('ongoingHint')}>{text('ongoing')}</span>}
      </div>
      {drilldownOrigin && <button type="button" className="cashflow-text-button" data-testid="cashflow-back-period" onClick={onBackToPeriod}>
        <SmallIcon><path d="m15 18-6-6 6-6" /></SmallIcon>{text('backToPeriod')}
      </button>}
    </div>
    <dl className="cashflow-summary" data-testid="cashflow-summary" aria-label={text('scopeHint')}>
      <div><dt>{text('income')}</dt><dd className="cashflow-money--income">{formatCurrency(summary?.income || 0, { locale: lang })}</dd></div>
      <div><dt>{text('expense')}</dt><dd className="cashflow-money--expense">{formatCurrency(summary?.expense || 0, { locale: lang })}</dd></div>
      <div><dt>{text('net')}</dt><dd className={(summary?.net || 0) < 0 ? 'cashflow-money--expense' : ''}>
        {formatCurrency(summary?.net || 0, { locale: lang })}
      </dd></div>
    </dl>
    <div className={`cashflow-body${!isIncomeOnly && topDays.length ? ' cashflow-body--with-days' : ''}`}>
      <div className="cashflow-main">
        {weekNavigation}
        <div className={`cashflow-chart${!hasData ? ' cashflow-chart--empty' : ''}`} data-testid="cashflow-chart-region">
          {hasData ? chart : <p>{emptyMessage || t('analytics.noChartData')}</p>}
        </div>
        <p className="cashflow-chart-hint">{periodMode === 'daily' ? t('analytics.chartHint') : text('monthlyHint')}</p>
        <button type="button" className="cashflow-text-button cashflow-history-link" onClick={onViewHistory}>
          {t('analytics.viewHistory')}<SmallIcon><path d="m9 6 6 6-6 6" /></SmallIcon>
        </button>
      </div>
      {!isIncomeOnly && topDays.length > 0 && <aside className="cashflow-top-days" data-testid="cashflow-top-days"
        aria-labelledby={`${id}-top-days`}>
        <h4 id={`${id}-top-days`}>{t('analytics.highestDays')}</h4>
        <p>{text('topDaysPeriod', { period: periodLabel })}</p>
        <ol>
          {visibleDays.map((day, index) => <li key={day.date}>
            <button type="button" data-testid="cashflow-top-day" data-date={day.date} onClick={() => onOpenDay(day.date, 'expense')}
              aria-label={`${t('analytics.dayTransactions', { date: formatDate(day.date, 'short', { locale: lang }) })} · ${formatCurrency(day.expense, { locale: lang })}`}>
              <span className="cashflow-day-rank" aria-hidden="true">{index + 1}</span>
              <span className="cashflow-day-date">{dayLabelFormatter.format(new Date(`${day.date}T00:00:00`))}</span>
              <strong>{formatCurrency(day.expense, { locale: lang })}</strong>
              <SmallIcon><path d="m9 6 6 6-6 6" /></SmallIcon>
            </button>
          </li>)}
        </ol>
        {topDays.length > 3 && <button type="button" className="cashflow-text-button cashflow-more-days"
          data-testid="cashflow-more-days" aria-expanded={showAllDays} onClick={() => setShowAllDays((show) => !show)}>
          {text(showAllDays ? 'lessDays' : 'moreDays')}<ChevronIcon />
        </button>}
      </aside>}
    </div>
    {!isIncomeOnly && unusualContent && <div className="cashflow-unusual">{unusualContent}</div>}
    {popoverContent}
  </section>;
}
