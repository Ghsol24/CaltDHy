import React, { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../../../components/ui/AppIcons';
import { CategoryMark } from '../../../components/ui/CategoryMark';
import { CalendarPanel, CustomDatePicker } from '../../../components/ui/CustomDatePicker';
import { CustomWalletDropdown } from '../../../components/ui/CustomWalletDropdown';
import { useAnchoredPlacement } from '../../../hooks/useAnchoredPlacement';
import { CategoryOutlineIcon, CheckOutlineIcon } from '../../../utils/categoryIcons';
import { useTranslation } from '../../../i18n/useTranslation';
import { CategoryPickerList } from '../TransactionMobileFields';
import { shiftIsoDays } from './relativeDay';
import { useRadioArrows } from './useRadioArrows';

/*
 * Máy tính, "Phương án 3": chip danh mục nhanh và danh sách nhóm bốn dòng
 * (Danh mục · Tài khoản · Ngày · Ghi chú). Mỗi dòng mở một popover cố định theo màn hình
 * (useAnchoredPlacement 'fixed'), nên hộp thoại không bao giờ cắt hay cuộn ngang vì nó.
 */

const Chevron = ({ open = false }) => (
  <Icon name={open ? 'chevronUpAlt' : 'chevronDown'} className="txn-row__chevron" width="16" height="16" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
);

/** Danh mục hay dùng: một nhóm chọn một (một điểm dừng Tab, mũi tên đổi lựa chọn). */
export function TransactionQuickChips({ categories, category, setCategory, ariaLabel }) {
  const { label } = useTranslation();
  const { groupRef, onKeyDown } = useRadioArrows();
  const selectedKey = String(category || '').toLowerCase();
  const anySelected = categories.some((cat) => cat.name.toLowerCase() === selectedKey);
  if (categories.length === 0) return null;
  return (
    <div className="txn-quick-chips" role="radiogroup" aria-label={ariaLabel} ref={groupRef} onKeyDown={onKeyDown}>
      {categories.map((cat, index) => {
        const isSelected = cat.name.toLowerCase() === selectedKey;
        const name = label(cat.name);
        return (
          <button
            type="button"
            key={cat.name}
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected || (!anySelected && index === 0) ? 0 : -1}
            title={name}
            className={`txn-quick-chip${isSelected ? ' is-selected' : ''}`}
            onClick={() => setCategory(cat.name)}
          >
            <span className="txn-quick-chip__icon" aria-hidden="true">
              {isSelected ? <CheckOutlineIcon size={13} /> : <CategoryMark name={cat.name} size={14} />}
            </span>
            <span className="txn-quick-chip__name">{name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Popover of a list row: fixed to the screen, Esc / click outside closes it, focus returns to the row. */
function RowPopover({ id, anchorRef, triggerRef, label, onClose, initialFocusRef, className = '', children }) {
  const popoverRef = useRef(null);
  const style = useAnchoredPlacement(anchorRef, popoverRef, true, {
    strategy: 'fixed', prefer: 'right', maxHeight: 360, onAnchorHidden: () => onClose(false)
  });

  useEffect(() => {
    const target = initialFocusRef?.current
      || popoverRef.current?.querySelector('[aria-checked="true"], [tabindex="0"], button, input');
    target?.focus({ preventScroll: true });
    const onPointerDown = (event) => {
      if (!popoverRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) onClose(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [initialFocusRef, onClose, triggerRef]);

  return (
    <div
      ref={popoverRef}
      id={id}
      className={`txn-row-popover ${className}`.trim()}
      role="dialog"
      aria-modal="false"
      aria-label={label}
      style={style || undefined}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        onClose(true);
      }}
    >
      {children}
    </div>
  );
}

export function TransactionCategoryRow({ type, category, categories, metrics, setCategory, open, setOpen, invalid, describedBy, copy }) {
  const { label } = useTranslation();
  const anchorRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const popoverId = useId();
  const rowLabel = type === 'income' ? copy.rowIncomeSource : copy.rowCategory;
  const close = (returnFocus) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
  };
  const empty = categories.length === 0;

  return (
    <div className="txn-row" ref={anchorRef}>
      <button
        ref={triggerRef}
        type="button"
        id="txn-category-row"
        className={`txn-row__trigger${open ? ' is-open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={empty}
        onClick={() => setOpen(!open)}
      >
        <span className="txn-row__icon" aria-hidden="true"><CategoryOutlineIcon name={category} size={18} /></span>
        <span className="txn-row__label">{rowLabel}</span>
        <span className="txn-row__value">{empty ? copy.noCategories : category ? label(category) : copy.chooseCategory}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <RowPopover id={popoverId} anchorRef={anchorRef} triggerRef={triggerRef} label={copy.chooseCategory}
          onClose={close} initialFocusRef={searchRef} className="txn-row-popover--category">
          <CategoryPickerList
            type={type}
            categories={categories}
            selected={category}
            metrics={metrics}
            alwaysSearch
            searchRef={searchRef}
            searchPlaceholder={copy.searchIn(categories.length)}
            onPick={(name) => { setCategory(name); close(true); }}
          />
        </RowPopover>
      )}
    </div>
  );
}

export function TransactionWalletRow({ type, wallets, walletId, setWalletId, placeholder, copy }) {
  return (
    <div className="txn-row txn-row--wallet">
      <CustomWalletDropdown
        id="txn-wallet-select"
        wallets={wallets}
        value={walletId}
        onChange={setWalletId}
        placeholder={placeholder}
        rowLabel={type === 'income' ? copy.rowIncomeWallet : copy.rowWallet}
        className="custom-wallet-dropdown--row"
      />
    </div>
  );
}

// Khớp thời lượng hiệu ứng .txn-row__calendar trong transaction-modal.css.
const CALENDAR_OPEN_MS = 200;
const CALENDAR_CLOSE_MS = 160;

/**
 * Ngày: hai nút nhanh Hôm nay / Hôm qua, ô gõ ngày, và lịch xổ ngay dưới dòng (trong danh sách,
 * đẩy Ghi chú xuống) thay vì nổi lên trên — cùng hướng mở xuống với Danh mục và Tài khoản.
 */
export function TransactionDateRow({ date, setDate, maxDate, invalid, describedBy, copy }) {
  const { t } = useTranslation();
  const groupRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  // Lịch còn trên trang trong lúc gập lại (hiệu ứng 160ms), rồi mới gỡ khỏi DOM.
  const [panelShown, setPanelShown] = useState(false);
  const yesterday = shiftIsoDays(maxDate, -1);
  const quickDays = [{ iso: maxDate, label: t('date.today') }, { iso: yesterday, label: t('date.yesterday') }];
  const reduceMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const revealPanel = () => panelRef.current?.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });

  // Hẹn giờ thay cho animationend: sự kiện đó không tới khi tab bị ẩn giữa chừng, lịch sẽ kẹt.
  useEffect(() => {
    if (open) {
      setPanelShown(true);
      return undefined;
    }
    const timer = setTimeout(() => setPanelShown(false), reduceMotion() ? 0 : CALENDAR_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // Mở xong thì cuộn cho thấy đủ lịch (lúc bắt đầu mở nó còn cao 0); click ra ngoài thì gấp lại.
  useEffect(() => {
    if (!open) return undefined;
    const reveal = reduceMotion() ? 0 : CALENDAR_OPEN_MS + 60;
    const timer = setTimeout(revealPanel, reveal);
    // Dự phòng: cuộn mượt có lúc bị trình duyệt bỏ qua; 'nearest' không làm gì nếu lịch đã thấy đủ.
    const fallback = setTimeout(() => panelRef.current?.scrollIntoView({ block: 'nearest' }), reveal + 400);
    const onPointerDown = (event) => {
      if (!groupRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      clearTimeout(timer);
      clearTimeout(fallback);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const focusInput = () => document.getElementById('txn-date-input')?.focus({ preventScroll: true });

  return (
    <div className={`txn-row-group txn-row-group--date${open ? ' is-open' : ''}`} ref={groupRef}>
      <div className="txn-row txn-row--date">
        <span className="txn-row__icon" aria-hidden="true">
          <Icon name="calendarCompact" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </span>
        <label className="txn-row__label" htmlFor="txn-date-input">{copy.rowDate}</label>
        <div className="txn-day-chips" role="group" aria-label={copy.quickDays}>
          {quickDays.map((day) => (
            <button key={day.iso} type="button" className={`txn-day-chip${date === day.iso ? ' is-selected' : ''}`}
              aria-pressed={date === day.iso} onClick={() => { setDate(day.iso); setOpen(false); }}>
              {day.label}
            </button>
          ))}
        </div>
        <CustomDatePicker
          id="txn-date-input"
          className="calt-date-picker--row"
          inputClassName="txn-row__input"
          value={date}
          onChange={setDate}
          max={maxDate}
          required
          invalid={invalid}
          ariaDescribedBy={describedBy}
          inlinePanel
          open={open}
          onOpenChange={setOpen}
          toggleIconName={open ? 'chevronUpAlt' : 'chevronDown'}
        />
      </div>
      {(open || panelShown) && (
        <div ref={panelRef} id="txn-date-input-calendar" className={`txn-row__calendar${open ? '' : ' is-closing'}`}
          role="region" aria-label={copy.rowDate} inert={open ? undefined : true}>
          <div className="txn-row__calendar-clip">
            <div className="txn-row__calendar-body">
              <CalendarPanel id="txn-date-input" value={date} max={maxDate}
                onSelect={(iso) => { setDate(iso); setOpen(false); focusInput(); }}
                onEscape={() => { setOpen(false); focusInput(); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TransactionNoteRow({ desc, setDesc, copy }) {
  return (
    <div className="txn-row txn-row--note">
      <span className="txn-row__icon" aria-hidden="true">
        <Icon name="pencil" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </span>
      <label className="txn-row__label" htmlFor="txn-desc-input">{copy.rowNote}</label>
      <input
        id="txn-desc-input"
        type="text"
        className="txn-row__input txn-row__input--note"
        placeholder={copy.notePlaceholder}
        value={desc}
        onChange={(event) => setDesc(event.target.value)}
        maxLength={100}
      />
    </div>
  );
}
