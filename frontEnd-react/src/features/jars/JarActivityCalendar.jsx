import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { formatCompactCurrency, formatCurrency } from '../../utils/formatters';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { FlameOutlineIcon } from '../../components/ui/AppIcons';
import {
  compareWithPreviousMonth, elapsedDays, intensityLevel, monthOf, monthTotals, monthWeeks,
  savingStreak, shiftMonth, yearColumns
} from './jarActivity';
import { getJarActivityCopy } from './jarActivityCopy';
import './jar-activity.css';

const YEAR_MIN_WIDTH = 520;
const YEAR_STRIP_WIDTH = 700; // wide cards get the GitHub-style strip, others 12 small months
const NARROW_WIDTH = 420;

const signedMoney = (value, formatter) => (value > 0 ? `+${formatter(value)}` : formatter(value));

function shiftDay(day, delta) {
  const date = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)) + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Savings calendar for the Goals page. Month view is a 7-column calendar whose
 * cells are tinted by the day's net saving; year view is a compact
 * GitHub-style strip of the last 53 weeks. Choosing a day filters the
 * recent-activity list next to it.
 */
export function JarActivityCalendar({
  days, month, monthOptions, onMonthChange, view, onViewChange, selectedDay, onSelectDay, today
}) {
  const { lang, intlLocale } = useTranslation();
  const copy = getJarActivityCopy(lang);
  const rootRef = useRef(null);
  const gridRef = useRef(null);
  const focusFromKeyboard = useRef(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const yearAllowed = width === 0 || width >= YEAR_MIN_WIDTH;
  const activeView = view === 'year' && yearAllowed ? 'year' : 'month';
  const narrow = width > 0 && width < NARROW_WIDTH;
  const yearStrip = width >= YEAR_STRIP_WIDTH;
  const money = (value) => formatCurrency(value, { locale: lang });
  const compact = (value) => formatCompactCurrency(Math.abs(value), { locale: lang });
  const fullDate = useMemo(() => new Intl.DateTimeFormat(intlLocale || 'vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }), [intlLocale]);
  const shortDate = (day) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
  const dateOf = (day) => new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));

  const weeks = useMemo(() => monthWeeks(month), [month]);
  const columns = useMemo(() => yearColumns(today), [today]);
  const yearMonths = useMemo(() => Array.from({ length: 12 }, (_, index) => shiftMonth(monthOf(today), index - 11)), [today]);
  const yearStart = yearStrip ? columns[0][0].day : `${yearMonths[0]}-01`;
  const totals = useMemo(() => monthTotals(days, month), [days, month]);
  const comparison = useMemo(() => compareWithPreviousMonth(days, month), [days, month]);
  const streak = useMemo(() => savingStreak(days, today), [days, today]);
  const year = useMemo(() => {
    let net = 0; let activeDays = 0; let max = 0;
    for (const [day, entry] of days) {
      if (day < yearStart || day > today) continue;
      net += entry.net; activeDays += 1; max = Math.max(max, entry.net);
    }
    return { net, activeDays, max };
  }, [days, yearStart, today]);
  const monthMax = useMemo(() => {
    let max = 0;
    for (const [day, entry] of days) if (monthOf(day) === month) max = Math.max(max, entry.net);
    return max;
  }, [days, month]);

  const isCurrentMonth = month === monthOf(today);
  const monthLabel = monthOptions.find((option) => option.value === month)?.label || month;
  const prettyMonth = monthLabel.charAt(0).toLocaleUpperCase(intlLocale || 'vi-VN') + monthLabel.slice(1);
  const title = activeView === 'year' ? copy.titleYear : isCurrentMonth ? copy.titleThisMonth : copy.titleMonth(prettyMonth);
  const headline = activeView === 'year' ? year.net : totals.net;
  let subline;
  let sublineTone = 'neutral';
  if (activeView === 'year') subline = copy.activeDays(year.activeDays);
  else if (totals.activeDays === 0) subline = copy.noActivity;
  else if (comparison.percent === null) subline = copy.noBaseline;
  else if (comparison.percent > 0) { subline = copy.compareUp(comparison.percent); sublineTone = 'up'; }
  else if (comparison.percent < 0) { subline = copy.compareDown(Math.abs(comparison.percent)); sublineTone = 'down'; }
  else subline = copy.compareSame;

  const describeDay = (day) => {
    const entry = days.get(day);
    const parts = [fullDate.format(dateOf(day))];
    if (!entry) parts.push(copy.dayNone);
    else {
      if (entry.deposit) parts.push(copy.dayDeposit(money(entry.deposit)));
      if (entry.withdraw) parts.push(copy.dayWithdraw(money(entry.withdraw)));
      parts.push(copy.dayCount(entry.count));
    }
    return parts.join(', ');
  };

  const cellTone = (day, max) => {
    const entry = days.get(day);
    if (!entry) return '';
    if (entry.net < 0) return ' is-withdraw';
    const level = intensityLevel(entry.net, max);
    return level ? ` level-${level}` : ' is-neutral';
  };

  // Keyboard: one tab stop per grid, arrows move between days.
  const inMonthDays = useMemo(() => weeks.flat().filter((cell) => cell.inMonth).map((cell) => cell.day), [weeks]);
  const defaultFocus = activeView === 'year'
    ? (selectedDay && selectedDay >= yearStart && selectedDay <= today ? selectedDay : today)
    : (selectedDay && monthOf(selectedDay) === month ? selectedDay
      : isCurrentMonth ? today : inMonthDays[0]);
  const [focusDay, setFocusDay] = useState(defaultFocus);
  useEffect(() => { setFocusDay(defaultFocus); }, [defaultFocus]);
  useLayoutEffect(() => {
    if (!focusFromKeyboard.current) return;
    gridRef.current?.querySelector(`[data-day="${focusDay}"]`)?.focus();
  }, [focusDay]);

  const onGridKeyDown = (event) => {
    const steps = activeView === 'year' && yearStrip
      ? { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }
      : { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (steps[event.key] === undefined) return;
    event.preventDefault();
    const next = shiftDay(focusDay, steps[event.key]);
    const allowed = activeView === 'year' ? next >= yearStart && next <= today : monthOf(next) === month && next <= today;
    if (!allowed) return;
    focusFromKeyboard.current = true;
    setFocusDay(next);
  };

  const choose = (day) => {
    focusFromKeyboard.current = false;
    setFocusDay(day);
    onSelectDay(selectedDay === day ? null : day);
  };

  const shortMonth = (month) => (String(lang).startsWith('vi')
    ? `T${Number(month.slice(5, 7))}`
    : new Intl.DateTimeFormat(intlLocale || 'en-GB', { month: 'short' }).format(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)));
  const yearMonthMarks = columns.map((column, index) => {
    const firstOfMonth = column.find((cell) => cell.day.endsWith('-01'));
    if (!firstOfMonth || index > columns.length - 2) return null;
    return { index, label: shortMonth(monthOf(firstOfMonth.day)) };
  }).filter(Boolean);
  const yearCell = (day, extraClass = '') => (
    <button key={day} type="button" role="gridcell" data-day={day}
      className={`jar-cal-year-cell${extraClass}${cellTone(day, year.max)}${day === today ? ' is-today' : ''}${selectedDay === day ? ' is-selected' : ''}`}
      tabIndex={day === focusDay ? 0 : -1} aria-pressed={selectedDay === day}
      aria-label={describeDay(day)} title={describeDay(day)} onClick={() => choose(day)} />
  );

  return (
    <section ref={rootRef} className={`jar-cal-card${narrow ? ' is-narrow' : ''}`} aria-labelledby="jar-cal-title">
      <header className="jar-cal-header">
        <div className="jar-cal-headline">
          <h2 id="jar-cal-title" className="jar-cal-title">{title}</h2>
          <strong className={`jar-cal-amount-total${headline < 0 ? ' is-negative' : headline > 0 ? ' is-positive' : ''}`}>
            {signedMoney(headline, money)}
          </strong>
          <span className={`jar-cal-compare is-${sublineTone}`}>{subline}</span>
        </div>
        <div className="jar-cal-controls">
          {activeView === 'month' && (
            <CustomSelect options={monthOptions} value={month} onChange={onMonthChange} size="sm" variant="subtle"
              align="right" ariaLabel={copy.monthPicker}
              prefixIcon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" /></svg>} />
          )}
          {yearAllowed && (
            <div className="jar-cal-view-switch" role="group" aria-label={copy.viewLabel}>
              <button type="button" aria-pressed={activeView === 'month'} onClick={() => onViewChange('month')}>{copy.viewMonth}</button>
              <button type="button" aria-pressed={activeView === 'year'} onClick={() => onViewChange('year')}>{copy.viewYear}</button>
            </div>
          )}
        </div>
      </header>

      {activeView === 'month' ? (
        <div className="jar-cal-month">
          <div className="jar-cal-weekdays" aria-hidden="true">
            {copy.weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div ref={gridRef} className="jar-cal-grid" role="grid" aria-label={copy.calendarLabel(prettyMonth)} onKeyDown={onGridKeyDown}>
            {weeks.map((week) => (
              <div key={week[0].day} role="row" className="jar-cal-row">
                {week.map((cell) => {
                  if (!cell.inMonth) return <span key={cell.day} role="gridcell" className="jar-cal-cell is-outside" aria-hidden="true" />;
                  const entry = days.get(cell.day);
                  const future = cell.day > today;
                  return (
                    <button key={cell.day} type="button" role="gridcell" data-day={cell.day}
                      className={`jar-cal-cell${cellTone(cell.day, monthMax)}${cell.day === today ? ' is-today' : ''}${selectedDay === cell.day ? ' is-selected' : ''}${future ? ' is-future' : ''}`}
                      tabIndex={cell.day === focusDay ? 0 : -1} disabled={future}
                      aria-pressed={selectedDay === cell.day} aria-label={describeDay(cell.day)}
                      onClick={() => choose(cell.day)}>
                      <span className="jar-cal-date">{cell.date}</span>
                      {entry && (narrow
                        ? <span className="jar-cal-dot" aria-hidden="true" />
                        : <span className="jar-cal-amount" aria-hidden="true">{entry.net > 0 ? '+' : entry.net < 0 ? '−' : ''}{compact(entry.net)}</span>)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : yearStrip ? (
        <div className="jar-cal-year">
          <div className="jar-cal-year-months" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
            {yearMonthMarks.map((mark) => <span key={mark.index} style={{ gridColumn: `${mark.index + 1} / span 2` }}>{mark.label}</span>)}
          </div>
          <div ref={gridRef} className="jar-cal-year-grid" role="grid" aria-label={copy.titleYear} onKeyDown={onGridKeyDown}
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
            {columns.map((column) => (
              <div key={column[0].day} role="row" className="jar-cal-year-column">
                {column.map((cell) => (cell.future || cell.day < yearStart
                  ? <span key={cell.day} role="gridcell" className="jar-cal-year-cell is-future" aria-hidden="true" />
                  : yearCell(cell.day)))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div ref={gridRef} className="jar-cal-months" role="grid" aria-label={copy.titleYear} onKeyDown={onGridKeyDown}>
          {yearMonths.map((monthKey) => (
            <div key={monthKey} role="rowgroup" className="jar-cal-mini">
              <span className="jar-cal-mini-title" aria-hidden="true">{shortMonth(monthKey)}{monthKey.endsWith('-01') ? ` ${monthKey.slice(0, 4)}` : ''}</span>
              {monthWeeks(monthKey).map((week) => (
                <div key={week[0].day} role="row" className="jar-cal-mini-row">
                  {week.map((cell) => (!cell.inMonth || cell.day > today
                    ? <span key={cell.day} role="gridcell" className={`jar-cal-year-cell${cell.inMonth ? ' is-future' : ' is-blank'}`} aria-hidden="true" />
                    : yearCell(cell.day)))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <footer className="jar-cal-footer">
        <div className="jar-cal-legend" aria-hidden="true">
          <span>{copy.legendLess}</span>
          {[1, 2, 3, 4].map((level) => <i key={level} className={`jar-cal-swatch level-${level}`} />)}
          <span>{copy.legendMore}</span>
          <i className="jar-cal-swatch is-withdraw" />
          <span>{copy.legendWithdraw}</span>
        </div>
        {activeView === 'month' && totals.activeDays > 0 && (
          <ul className="jar-cal-stats">
            {elapsedDays(month, today) > 0 && <li>{copy.avgPerDay(money(Math.round(totals.net / elapsedDays(month, today))))}</li>}
            {totals.best && <li>{copy.bestDay(shortDate(totals.best.day), money(totals.best.net))}</li>}
            <li>{copy.activeDays(totals.activeDays)}</li>
            {isCurrentMonth && streak >= 2 && <li className="jar-cal-streak"><FlameOutlineIcon size={14} aria-hidden="true" />{copy.streak(streak)}</li>}
          </ul>
        )}
      </footer>
    </section>
  );
}
