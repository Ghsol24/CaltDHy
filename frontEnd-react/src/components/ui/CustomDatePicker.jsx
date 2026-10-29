import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useAnchoredPlacement } from '../../hooks/useAnchoredPlacement';
import { formatDisplayDate, isoMonth, parseIsoDate, parseIsoMonth, parseTypedDate, shiftIsoMonth } from '../../utils/datePicker';
import './date-picker.css';

const pad = (value) => String(value).padStart(2, '0');
const toIso = (year, monthIndex, day) => `${year}-${pad(monthIndex + 1)}-${pad(day)}`;

/**
 * Themed replacements for <input type="date"> and <input type="month">.
 * Values stay ISO strings ("YYYY-MM-DD" / "YYYY-MM", or "") so callers and the API
 * keep working unchanged. The native browser popups cannot follow the app theme.
 *
 * - CustomDatePicker: typed input + calendar popover.
 * - CalendarPanel / MonthPanel: the bare grids, for places that already sit inside
 *   a popover (no popover-in-popover).
 */

const todayIso = () => {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth(), now.getDate());
};
const currentMonthIso = () => todayIso().slice(0, 7);

const shiftIso = (iso, days) => {
  const { year, month, day } = parseIsoDate(iso);
  const date = new Date(year, month, day + days);
  return toIso(date.getFullYear(), date.getMonth(), date.getDate());
};

const shiftMonths = (iso, months) => {
  const { year, month, day } = parseIsoDate(iso);
  const last = new Date(year, month + months + 1, 0).getDate();
  const date = new Date(year, month + months, Math.min(day, last));
  return toIso(date.getFullYear(), date.getMonth(), date.getDate());
};

const clampValue = (value, min, max) => {
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
};

const LABELS = {
  vi: {
    placeholder: 'dd/mm/yyyy', open: 'Mở lịch chọn ngày', dialog: 'Chọn ngày', prev: 'Tháng trước', next: 'Tháng sau',
    prevYear: 'Năm trước', nextYear: 'Năm sau', thisMonth: 'Tháng này', month: (n) => `Tháng ${n}`,
    today: 'Hôm nay', clear: 'Xoá', weekdays: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'], order: 'dmy'
  },
  en: {
    placeholder: 'dd/mm/yyyy', open: 'Open calendar', dialog: 'Choose a date', prev: 'Previous month', next: 'Next month',
    prevYear: 'Previous year', nextYear: 'Next year', thisMonth: 'This month', month: null,
    today: 'Today', clear: 'Clear', weekdays: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'], order: 'dmy'
  },
  zh: {
    placeholder: 'yyyy/mm/dd', open: '打开日历', dialog: '选择日期', prev: '上个月', next: '下个月',
    prevYear: '上一年', nextYear: '下一年', thisMonth: '本月', month: (n) => `${n}月`,
    today: '今天', clear: '清除', weekdays: ['一', '二', '三', '四', '五', '六', '日'], order: 'ymd'
  }
};

const labelsFor = (lang) => (String(lang || '').startsWith('zh') ? LABELS.zh : LABELS[lang] || LABELS.vi);

function buildWeeks(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first weeks
  const start = new Date(year, month, 1 - offset);
  const lastOfMonth = new Date(year, month + 1, 0);
  const weeks = [];
  const cursor = new Date(start);
  while (weeks.length < 6 && (weeks.length === 0 || cursor <= lastOfMonth)) {
    const week = [];
    for (let i = 0; i < 7; i += 1) {
      week.push({ iso: toIso(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()), day: cursor.getDate(), inMonth: cursor.getMonth() === month });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
);
const ChevronRight = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
);

/** Month-of-days grid with keyboard navigation. `onSelect('')` clears when clearable. */
export function CalendarPanel({
  id: explicitId, value = '', onSelect, min, max, clearable = false, autoFocus = false, onEscape, className = ''
}) {
  const { lang, intlLocale } = useTranslation();
  const labels = labelsFor(lang);
  const generatedId = useId();
  const titleId = `${explicitId || `calendar-${generatedId}`}-title`;
  const gridRef = useRef(null);
  const focusGridRef = useRef(autoFocus);
  const today = todayIso();
  const [focusedIso, setFocusedIso] = useState(() => clampValue(parseIsoDate(value) ? value : today, min, max));

  // Follow outside changes (e.g. the typed input) while the grid is not being navigated.
  useEffect(() => {
    if (parseIsoDate(value) && !focusGridRef.current) setFocusedIso(value);
  }, [value]);

  const monthTitle = useMemo(() => {
    const { year, month } = parseIsoDate(focusedIso);
    const title = new Intl.DateTimeFormat(intlLocale || 'vi-VN', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
    return title.charAt(0).toLocaleUpperCase(intlLocale || 'vi-VN') + title.slice(1);
  }, [focusedIso, intlLocale]);
  const dayLabel = useCallback((iso) => {
    const { year, month, day } = parseIsoDate(iso);
    return new Intl.DateTimeFormat(intlLocale || 'vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      .format(new Date(year, month, day));
  }, [intlLocale]);

  const { year: viewYear, month: viewMonth } = parseIsoDate(focusedIso);
  const weeks = useMemo(() => buildWeeks(viewYear, viewMonth), [viewYear, viewMonth]);
  const isDisabledDay = (iso) => Boolean((min && iso < min) || (max && iso > max));

  // Move keyboard focus to the active day when the grid owns focus.
  useLayoutEffect(() => {
    if (focusGridRef.current) gridRef.current?.querySelector(`[data-iso="${focusedIso}"]`)?.focus();
  }, [focusedIso]);

  const select = (iso) => {
    if (iso && isDisabledDay(iso)) return;
    focusGridRef.current = false;
    onSelect?.(iso);
  };

  const onGridKeyDown = (event) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const weekday = (new Date(viewYear, viewMonth, parseIsoDate(focusedIso).day).getDay() + 6) % 7;
    let next = null;
    if (moves[event.key] !== undefined) next = shiftIso(focusedIso, moves[event.key]);
    else if (event.key === 'PageUp') next = shiftMonths(focusedIso, event.shiftKey ? -12 : -1);
    else if (event.key === 'PageDown') next = shiftMonths(focusedIso, event.shiftKey ? 12 : 1);
    else if (event.key === 'Home') next = shiftIso(focusedIso, -weekday);
    else if (event.key === 'End') next = shiftIso(focusedIso, 6 - weekday);
    else if (event.key === 'Escape' && onEscape) { event.preventDefault(); event.stopPropagation(); onEscape(); return; }
    if (next) {
      event.preventDefault();
      focusGridRef.current = true;
      setFocusedIso(next);
    }
  };

  const changeMonth = (delta) => {
    focusGridRef.current = false;
    setFocusedIso((current) => shiftMonths(current, delta));
  };

  return (
    <div className={`calt-date-panel ${className}`.trim()}>
      <div className="calt-date-header">
        <button type="button" className="calt-date-nav" aria-label={labels.prev} onClick={() => changeMonth(-1)}><ChevronLeft /></button>
        <strong id={titleId} className="calt-date-title" aria-live="polite">{monthTitle}</strong>
        <button type="button" className="calt-date-nav" aria-label={labels.next} onClick={() => changeMonth(1)}><ChevronRight /></button>
      </div>
      <div className="calt-date-weekdays" aria-hidden="true">
        {labels.weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>
      <div ref={gridRef} className="calt-date-grid" role="grid" aria-labelledby={titleId} onKeyDown={onGridKeyDown}>
        {weeks.map((week) => (
          <div key={week[0].iso} role="row" className="calt-date-row">
            {week.map((cell) => {
              const selected = cell.iso === value;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  role="gridcell"
                  data-iso={cell.iso}
                  tabIndex={cell.iso === focusedIso ? 0 : -1}
                  aria-selected={selected}
                  aria-current={cell.iso === today ? 'date' : undefined}
                  aria-label={dayLabel(cell.iso)}
                  disabled={isDisabledDay(cell.iso)}
                  className={`calt-date-day${cell.inMonth ? '' : ' is-outside'}${selected ? ' is-selected' : ''}${cell.iso === today ? ' is-today' : ''}`}
                  onClick={() => select(cell.iso)}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="calt-date-footer">
        {clearable ? <button type="button" className="calt-date-link" onClick={() => select('')} disabled={!value}>{labels.clear}</button> : <span />}
        <button type="button" className="calt-date-link" disabled={isDisabledDay(today)} onClick={() => select(today)}>{labels.today}</button>
      </div>
    </div>
  );
}

/** Year header + 12-month grid. Value is "YYYY-MM"; `min`/`max` use the same format. */
export function MonthPanel({ id: explicitId, value = '', onSelect, min, max, className = '', autoFocus = false, onEscape }) {
  const { lang, intlLocale } = useTranslation();
  const labels = labelsFor(lang);
  const generatedId = useId();
  const titleId = `${explicitId || `months-${generatedId}`}-title`;
  const gridRef = useRef(null);
  const focusGridRef = useRef(autoFocus);
  const thisMonth = currentMonthIso();
  const [focused, setFocused] = useState(() => clampValue(parseIsoMonth(value) ? value : thisMonth, min, max));

  useEffect(() => {
    if (parseIsoMonth(value) && !focusGridRef.current) setFocused(value);
  }, [value]);

  useLayoutEffect(() => {
    if (focusGridRef.current) gridRef.current?.querySelector(`[data-month="${focused}"]`)?.focus();
  }, [focused]);

  const { year } = parseIsoMonth(focused);
  const monthName = (monthIndex) => (labels.month
    ? labels.month(monthIndex + 1)
    : new Intl.DateTimeFormat(intlLocale || 'en-US', { month: 'short' }).format(new Date(2000, monthIndex, 1)));
  const fullName = (monthIndex) => new Intl.DateTimeFormat(intlLocale || 'vi-VN', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthIndex, 1));
  const isDisabled = (month) => Boolean((min && month < min) || (max && month > max));

  const select = (month) => {
    if (isDisabled(month)) return;
    focusGridRef.current = false;
    onSelect?.(month);
  };

  const onGridKeyDown = (event) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4, PageUp: -12, PageDown: 12 };
    if (event.key === 'Escape' && onEscape) { event.preventDefault(); event.stopPropagation(); onEscape(); return; }
    if (moves[event.key] === undefined) return;
    event.preventDefault();
    focusGridRef.current = true;
    setFocused((current) => shiftIsoMonth(current, moves[event.key]));
  };

  const changeYear = (delta) => {
    focusGridRef.current = false;
    setFocused((current) => shiftIsoMonth(current, delta * 12));
  };

  return (
    <div className={`calt-date-panel calt-month-panel ${className}`.trim()}>
      <div className="calt-date-header">
        <button type="button" className="calt-date-nav" aria-label={labels.prevYear} onClick={() => changeYear(-1)}
          disabled={Boolean(min && `${year - 1}-12` < min)}><ChevronLeft /></button>
        <strong id={titleId} className="calt-date-title" aria-live="polite">{year}</strong>
        <button type="button" className="calt-date-nav" aria-label={labels.nextYear} onClick={() => changeYear(1)}
          disabled={Boolean(max && `${year + 1}-01` > max)}><ChevronRight /></button>
      </div>
      <div ref={gridRef} className="calt-month-grid" role="grid" aria-labelledby={titleId} onKeyDown={onGridKeyDown}>
        {[0, 1, 2].map((row) => (
          <div key={row} role="row" className="calt-month-row">
            {[0, 1, 2, 3].map((col) => {
              const monthIndex = row * 4 + col;
              const month = isoMonth(year, monthIndex);
              const selected = month === value;
              return (
                <button key={month} type="button" role="gridcell" data-month={month}
                  tabIndex={month === focused ? 0 : -1} aria-selected={selected}
                  aria-current={month === thisMonth ? 'date' : undefined} aria-label={fullName(monthIndex)}
                  disabled={isDisabled(month)}
                  className={`calt-month-cell${selected ? ' is-selected' : ''}${month === thisMonth ? ' is-today' : ''}`}
                  onClick={() => select(month)}>
                  {monthName(monthIndex)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="calt-date-footer">
        <span />
        <button type="button" className="calt-date-link" disabled={isDisabled(thisMonth)} onClick={() => select(thisMonth)}>{labels.thisMonth}</button>
      </div>
    </div>
  );
}

export function CustomDatePicker({
  id: explicitId,
  name,
  value = '',
  onChange,
  min,
  max,
  disabled = false,
  required = false,
  placeholder,
  ariaLabel,
  ariaDescribedBy,
  invalid = false,
  clearable = true,
  className = '',
  inputClassName = '',
  inputRef: externalInputRef,
  testId,
}) {
  const { lang } = useTranslation();
  const labels = labelsFor(lang);
  const generatedId = useId();
  const inputId = explicitId || `date-${generatedId}`;
  const calendarId = `${inputId}-calendar`;
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const popoverRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [focusGrid, setFocusGrid] = useState(false);
  const [text, setText] = useState(() => formatDisplayDate(value, labels.order));
  const popoverStyle = useAnchoredPlacement(rootRef, popoverRef, isOpen);
  // A required date can't be emptied, so "Clear" would only ever be a dead end.
  const canClear = clearable && !required;

  const setInputNode = (node) => {
    inputRef.current = node;
    if (typeof externalInputRef === 'function') externalInputRef(node);
    else if (externalInputRef) externalInputRef.current = node;
  };

  // Show the formatted value unless the person is in the middle of typing.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setText(formatDisplayDate(value, labels.order));
  }, [value, labels.order]);

  const close = useCallback((returnFocus) => {
    setIsOpen(false);
    if (returnFocus) inputRef.current?.focus();
  }, []);

  const open = (withGridFocus) => {
    if (disabled) return;
    setFocusGrid(Boolean(withGridFocus));
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const frame = requestAnimationFrame(() => popoverRef.current?.scrollIntoView?.({ block: 'nearest' }));
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  const isOutOfRange = (iso) => Boolean((min && iso < min) || (max && iso > max));

  const commit = (iso) => {
    onChange?.(iso);
    setText(formatDisplayDate(iso, labels.order));
    close(true);
  };

  const commitTyped = () => {
    const parsed = parseTypedDate(text);
    if (parsed === '' && !required) {
      if (value) onChange?.('');
      setText('');
      return;
    }
    if (parsed && !isOutOfRange(parsed)) {
      if (parsed !== value) onChange?.(parsed);
      setText(formatDisplayDate(parsed, labels.order));
      return;
    }
    // Unreadable, out-of-range or emptied-while-required text: keep the last valid date.
    setText(formatDisplayDate(value, labels.order));
  };

  return (
    <div ref={rootRef} className={`calt-date-picker${isOpen ? ' is-open' : ''}${disabled ? ' is-disabled' : ''} ${className}`.trim()}>
      <input
        ref={setInputNode}
        id={inputId}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        data-testid={testId}
        className={`calt-date-input ${inputClassName}`.trim()}
        value={text}
        placeholder={placeholder || labels.placeholder}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? calendarId : undefined}
        onChange={(event) => {
          const next = event.target.value.replace(/[^\d/.-]/g, '').slice(0, 10);
          setText(next);
          // A complete, valid date applies at once so previews follow the typing.
          const parsed = parseTypedDate(next);
          if (parsed && parsed !== value && !isOutOfRange(parsed)) onChange?.(parsed);
        }}
        onClick={() => { if (!isOpen) open(false); }}
        onBlur={(event) => { if (!rootRef.current?.contains(event.relatedTarget)) commitTyped(); }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && (event.altKey || !isOpen)) { event.preventDefault(); open(true); }
          else if (event.key === 'Escape' && isOpen) { event.preventDefault(); event.stopPropagation(); close(false); }
          else if (event.key === 'Enter') { event.preventDefault(); commitTyped(); }
          else if (event.key === 'Tab') setIsOpen(false);
        }}
      />
      <button type="button" className="calt-date-toggle" tabIndex={-1} disabled={disabled}
        aria-label={labels.open} onClick={() => (isOpen ? close(true) : open(true))}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {isOpen && (
        <div ref={popoverRef} id={calendarId} className="calt-date-popover" style={popoverStyle || undefined}
          role="dialog" aria-modal="false" aria-label={labels.dialog}>
          <CalendarPanel id={inputId} value={value} min={min} max={max} clearable={canClear}
            autoFocus={focusGrid} onSelect={commit} onEscape={() => close(true)} />
        </div>
      )}
    </div>
  );
}
