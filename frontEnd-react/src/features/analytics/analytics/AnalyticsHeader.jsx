import React, { useEffect, useRef, useState } from 'react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Icon } from '../../../components/ui/AppIcons';
import { MonthPanel } from '../../../components/ui/CustomDatePicker';
import { useAnchoredPlacement } from '../../../hooks/useAnchoredPlacement';
import { getLocalMonthString } from '../../../utils/formatters';

// One period selector for the whole Analytics page: the month shown here drives the
// summary figures, the category split, the cash-flow chart and the report.
function MonthPicker({ activeMonth, monthLabel, onSelect }) {
  const rootRef = useRef(null);
  const popoverRef = useRef(null);
  const toggleRef = useRef(null);
  const [open, setOpen] = useState(false);
  const popoverStyle = useAnchoredPlacement(rootRef, popoverRef, open, { prefer: 'right' });

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
      <button type="button" ref={toggleRef}
        className="analytics-month-trigger month-current-display month-current-display--layout"
        data-testid="analytics-month-trigger" title="Chọn tháng" aria-haspopup="dialog" aria-expanded={open}
        onClick={() => setOpen((value) => !value)}>
        <Icon name="calendar" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <span aria-live="polite">{monthLabel}</span>
        <Icon name="chevronDown" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </button>
      {open && (
        <div ref={popoverRef} className="calt-date-popover analytics-month-popover" style={popoverStyle || undefined}
          role="dialog" aria-modal="false" aria-label="Chọn tháng" data-testid="analytics-month-popover">
          <MonthPanel id="analytics-month" value={activeMonth} max={getLocalMonthString()} autoFocus
            onSelect={(month) => { onSelect(month); close(true); }} onEscape={() => close(true)} />
        </div>
      )}
    </div>
  );
}

export function AnalyticsHeader({ activeMonth, compact = false, handleNextMonth, handlePrevMonth, handleSelectMonth, handleSetThisMonth, isCurrentMonth, monthLabel }) {
  // Phones on Chi tiêu / Tóm tắt thu chi / Báo cáo show only the month control; the H1 stays
  // for screen readers. Only the full header carries #analytics-overview (scroll/focus target).
  return (
    <PageHeader
      id={compact ? undefined : 'analytics-overview'}
      className={`analytics-header-bar${compact ? ' analytics-header-bar--compact' : ''}`}
      hideTitle={compact}
      icon="analyticsOverview"
      title="Phân tích tài chính"
      titleClassName="analytics-view-title"
      subtitle="Nhìn rõ dòng tiền theo thời gian"
      period={(
        <div className="analytics-header-controls">
          {!isCurrentMonth && (
            <button type="button" className="analytics-this-month-btn" onClick={handleSetThisMonth}>
              Về tháng này
            </button>
          )}

          <div className="analytics-month-stepper" role="group" aria-label="Chuyển tháng">
            <button
              type="button"
              className="month-nav-btn"
              onClick={handlePrevMonth}
              title="Tháng trước"
              aria-label="Xem tháng trước"
            >
              <Icon name="chevronLeft" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </button>

            <MonthPicker activeMonth={activeMonth} monthLabel={monthLabel} onSelect={handleSelectMonth} />

            <button
              type="button"
              className="month-nav-btn"
              onClick={handleNextMonth}
              title="Tháng sau"
              aria-label="Xem tháng sau"
            >
              <Icon name="chevronRight" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </button>
          </div>
        </div>
      )}
    />
  );
}
