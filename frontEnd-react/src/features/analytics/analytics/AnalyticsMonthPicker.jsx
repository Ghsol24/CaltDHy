import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../components/ui/AppIcons';
import { MonthPanel } from '../../../components/ui/CustomDatePicker';
import { useAnchoredPlacement } from '../../../hooks/useAnchoredPlacement';
import { getLocalMonthString } from '../../../utils/formatters';

// Nút "tháng ▾" mở lưới 12 tháng. Dùng ở đầu trang Phân tích và trong thẻ Xu hướng dòng tiền;
// cả hai cùng đổi một tháng chung (selectedMonth) của trang.
export function AnalyticsMonthPicker({
  activeMonth, monthLabel, onSelect, ariaLabel = 'Chọn tháng', prefer = 'right',
  idPrefix = 'analytics-month', testId = 'analytics-month-trigger', popoverTestId = 'analytics-month-popover',
  triggerClassName = 'analytics-month-trigger month-current-display month-current-display--layout',
  popoverClassName = 'analytics-month-popover', showCalendarIcon = true,
}) {
  const rootRef = useRef(null);
  const popoverRef = useRef(null);
  const toggleRef = useRef(null);
  const [open, setOpen] = useState(false);
  const popoverStyle = useAnchoredPlacement(rootRef, popoverRef, open, { prefer });

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const close = (restoreFocus) => {
    setOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  };

  return (
    <div className="analytics-month-picker" ref={rootRef}>
      <button type="button" ref={toggleRef} className={triggerClassName}
        data-testid={testId} title={ariaLabel} aria-haspopup="dialog" aria-expanded={open}
        onClick={() => setOpen((value) => !value)}>
        {showCalendarIcon && <Icon name="calendar" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
        <span aria-live="polite">{monthLabel}</span>
        <Icon name="chevronDown" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </button>
      {open && (
        <div ref={popoverRef} className={`calt-date-popover ${popoverClassName}`} style={popoverStyle || undefined}
          role="dialog" aria-modal="false" aria-label={ariaLabel} data-testid={popoverTestId}>
          <MonthPanel id={idPrefix} value={activeMonth} max={getLocalMonthString()} autoFocus
            onSelect={(month) => { onSelect(month); close(true); }} onEscape={() => close(true)} />
        </div>
      )}
    </div>
  );
}
