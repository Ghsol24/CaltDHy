import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDisplayDate, parseIsoDate, parseTypedDate } from '../../utils/datePicker';
import './date-picker.css';

const pad = (value) => String(value).padStart(2, '0');
const toIso = (year, monthIndex, day) => `${year}-${pad(monthIndex + 1)}-${pad(day)}`;

/**
 * CustomDatePicker — a themed replacement for <input type="date">.
 * The value stays an ISO "YYYY-MM-DD" string (or "") so callers and the API
 * keep working unchanged. People can type the date or pick it from a calendar
 * that follows the app theme (the native browser popup cannot be themed).
 */

const todayIso = () => {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth(), now.getDate());
};

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

const clampIso = (iso, min, max) => {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
};

const LABELS = {
  vi: {
    placeholder: 'dd/mm/yyyy', open: 'Mở lịch chọn ngày', dialog: 'Chọn ngày', prev: 'Tháng trước', next: 'Tháng sau',
    today: 'Hôm nay', clear: 'Xoá', weekdays: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'], order: 'dmy'
  },
  en: {
    placeholder: 'dd/mm/yyyy', open: 'Open calendar', dialog: 'Choose a date', prev: 'Previous month', next: 'Next month',
    today: 'Today', clear: 'Clear', weekdays: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'], order: 'dmy'
  },
  zh: {
    placeholder: 'yyyy/mm/dd', open: '打开日历', dialog: '选择日期', prev: '上个月', next: '下个月',
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

export function CustomDatePicker({
  id: explicitId,
  name,
  value = '',
  onChange,
  min,
  max,
  disabled = false,
  placeholder,
  ariaLabel,
  ariaDescribedBy,
  invalid = false,
  clearable = true,
  className = '',
  inputClassName = '',
  inputRef: externalInputRef,
}) {
  const { lang, intlLocale } = useTranslation();
  const labels = labelsFor(lang);
  const generatedId = useId();
  const inputId = explicitId || `date-${generatedId}`;
  const calendarId = `${inputId}-calendar`;
  const titleId = `${inputId}-calendar-title`;
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const gridRef = useRef(null);
  const focusGridRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState(() => formatDisplayDate(value, labels.order));
  const [focusedIso, setFocusedIso] = useState(() => (parseIsoDate(value) ? value : todayIso()));
  const [placement, setPlacement] = useState({ above: false, alignRight: false });
  const today = todayIso();

  const setInputNode = (node) => {
    inputRef.current = node;
    if (typeof externalInputRef === 'function') externalInputRef(node);
    else if (externalInputRef) externalInputRef.current = node;
  };

  // Show the formatted value unless the person is in the middle of typing.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setText(formatDisplayDate(value, labels.order));
  }, [value, labels.order]);

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

  const close = useCallback((returnFocus) => {
    setIsOpen(false);
    if (returnFocus) inputRef.current?.focus();
  }, []);

  const open = (focusGrid) => {
    if (disabled) return;
    const base = clampIso(parseIsoDate(value) ? value : today, min, max);
    setFocusedIso(base);
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      setPlacement({
        above: spaceBelow < 360 && rect.top > spaceBelow,
        alignRight: rect.left + 300 > window.innerWidth - 8 && rect.right >= 300
      });
    }
    focusGridRef.current = Boolean(focusGrid);
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

  // Move keyboard focus to the active day when the grid owns focus.
  useLayoutEffect(() => {
    if (!isOpen || !focusGridRef.current) return;
    gridRef.current?.querySelector(`[data-iso="${focusedIso}"]`)?.focus();
  }, [isOpen, focusedIso]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const frame = requestAnimationFrame(() => gridRef.current?.parentElement?.scrollIntoView?.({ block: 'nearest' }));
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  const commit = (iso) => {
    if (iso && isDisabledDay(iso)) return;
    onChange?.(iso);
    setText(formatDisplayDate(iso, labels.order));
    close(true);
  };

  const commitTyped = () => {
    const parsed = parseTypedDate(text);
    if (parsed === '') {
      if (value) onChange?.('');
      setText('');
      return;
    }
    if (parsed && !isDisabledDay(parsed)) {
      if (parsed !== value) onChange?.(parsed);
      setText(formatDisplayDate(parsed, labels.order));
      return;
    }
    // Unreadable or out-of-range text: keep the last valid date.
    setText(formatDisplayDate(value, labels.order));
  };

  const onGridKeyDown = (event) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next = null;
    if (moves[event.key] !== undefined) next = shiftIso(focusedIso, moves[event.key]);
    else if (event.key === 'PageUp') next = shiftMonths(focusedIso, event.shiftKey ? -12 : -1);
    else if (event.key === 'PageDown') next = shiftMonths(focusedIso, event.shiftKey ? 12 : 1);
    else if (event.key === 'Home') next = shiftIso(focusedIso, -((new Date(viewYear, viewMonth, parseIsoDate(focusedIso).day).getDay() + 6) % 7));
    else if (event.key === 'End') next = shiftIso(focusedIso, 6 - ((new Date(viewYear, viewMonth, parseIsoDate(focusedIso).day).getDay() + 6) % 7));
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
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
    <div ref={rootRef} className={`calt-date-picker${isOpen ? ' is-open' : ''}${disabled ? ' is-disabled' : ''} ${className}`.trim()}>
      <input
        ref={setInputNode}
        id={inputId}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={`calt-date-input ${inputClassName}`.trim()}
        value={text}
        placeholder={placeholder || labels.placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? calendarId : undefined}
        onChange={(event) => setText(event.target.value.replace(/[^\d/.-]/g, '').slice(0, 10))}
        onClick={() => { if (!isOpen) open(false); }}
        onBlur={(event) => { if (!rootRef.current?.contains(event.relatedTarget)) commitTyped(); }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && (event.altKey || !isOpen)) { event.preventDefault(); open(true); }
          else if (event.key === 'Escape' && isOpen) { event.preventDefault(); event.stopPropagation(); close(false); }
          else if (event.key === 'Enter') commitTyped();
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
        <div id={calendarId} className={`calt-date-popover${placement.above ? ' is-above' : ''}${placement.alignRight ? ' is-right' : ''}`}
          role="dialog" aria-modal="false" aria-labelledby={titleId}>
          <div className="calt-date-header">
            <button type="button" className="calt-date-nav" aria-label={labels.prev} onClick={() => changeMonth(-1)}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <strong id={titleId} className="calt-date-title" aria-live="polite">{monthTitle}</strong>
            <button type="button" className="calt-date-nav" aria-label={labels.next} onClick={() => changeMonth(1)}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
          <div className="calt-date-weekdays" aria-hidden="true">
            {labels.weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div ref={gridRef} className="calt-date-grid" role="grid" aria-labelledby={titleId} onKeyDown={onGridKeyDown}>
            {weeks.map((week) => (
              <div key={week[0].iso} role="row" className="calt-date-row">
                {week.map((cell) => {
                  const selected = cell.iso === value;
                  const dayDisabled = isDisabledDay(cell.iso);
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
                      disabled={dayDisabled}
                      className={`calt-date-day${cell.inMonth ? '' : ' is-outside'}${selected ? ' is-selected' : ''}${cell.iso === today ? ' is-today' : ''}`}
                      onClick={() => commit(cell.iso)}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="calt-date-footer">
            {clearable ? <button type="button" className="calt-date-link" onClick={() => commit('')} disabled={!value}>{labels.clear}</button> : <span />}
            <button type="button" className="calt-date-link" disabled={isDisabledDay(today)} onClick={() => commit(today)}>{labels.today}</button>
          </div>
        </div>
      )}
    </div>
  );
}
