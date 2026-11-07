import React, { useId, useMemo, useRef, useState } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useSheetDrag } from '../../hooks/useSheetDrag';
import { CalendarPanel } from '../../components/ui/CustomDatePicker';
import { CategoryOutlineIcon, CheckOutlineIcon } from '../../utils/categoryIcons';
import { formatCurrency } from '../../utils/formatters';
import { formatDisplayDate, parseIsoDate } from '../../utils/datePicker';
import { moneyNumber } from '../../utils/moneyPrecision.js';
import { useTranslation } from '../../i18n/useTranslation';

/*
 * Phone-only pieces of the transaction dialog. On narrow screens the category grid and
 * the anchored calendar popover do not fit, so both become rows that open a sheet
 * sliding up inside the dialog. Sheets are anchored to the bottom and size to the
 * dialog, so they can never spill off-screen.
 */

const SEARCH_THRESHOLD = 8;

const pad = (value) => String(value).padStart(2, '0');

function shiftIsoDays(iso, days) {
  const parts = parseIsoDate(iso);
  if (!parts) return '';
  const date = new Date(parts.year, parts.month, parts.day + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const foldText = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/gi, 'd').toLowerCase().trim();

const ChevronIcon = ({ down = false }) => (
  <svg className="txn-field-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={down ? 'm6 9 6 6 6-6' : 'm9 18 6-6-6-6'} />
  </svg>
);

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

/** A bottom sheet layered inside the transaction dialog. Drag the header down, tap the dim, or press Esc to close. */
export function TransactionSheet({ title, onClose, children }) {
  const { t } = useTranslation();
  const sheetRef = useRef(null);
  const titleId = useId();
  const { offset, handlers } = useSheetDrag(onClose);
  useFocusTrap(sheetRef, true);

  return (
    <div className="txn-sheet-layer" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={sheetRef}
        className={`txn-sheet${offset ? ' is-dragging' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={offset ? { transform: `translateY(${offset}px)` } : undefined}
      >
        <div className="txn-sheet__handle-zone" {...handlers}>
          <span className="txn-sheet-grabber" aria-hidden="true" />
          <div className="txn-sheet__head">
            <h3 id={titleId} className="txn-sheet__title">{title}</h3>
            <button type="button" className="txn-sheet__close" onClick={onClose} aria-label={t('common.closeWindow')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="txn-sheet__body">{children}</div>
      </div>
    </div>
  );
}

/** Text + bar for the selected category; `metric` already includes the draft, `baseline` does not. */
function describeSelectedBudget({ t, type, metric, baseline, hasDraft, budgetReady, budgetError }) {
  if (type !== 'expense') return { line: t('transaction.incomeCategoryHint') };
  if (budgetError) return { line: t('transaction.budgetUnavailable') };
  if (!budgetReady) return { line: t('transaction.budgetLoading') };
  if (!metric) return { line: '' };
  if (!metric.hasLimit) return { line: t('transaction.limitUnset') };

  const pending = Math.max(0, (baseline?.percent ?? metric.percent) - metric.percent);
  const bar = { filled: metric.percent, pending, color: metric.color };
  if (metric.rawRemaining < 0n) {
    return { line: t('transaction.budgetOver', { amount: formatCurrency(moneyNumber(-metric.rawRemaining)) }), tone: 'danger', bar };
  }
  if (metric.rawRemaining === 0n) return { line: t('transaction.limitReached'), tone: 'danger', bar };
  if (!hasDraft) {
    return { line: t('transaction.budgetLeftAmount', { percent: metric.percent, amount: formatCurrency(metric.remaining) }), bar };
  }
  return { line: t('transaction.budgetAfterSave', { amount: formatCurrency(metric.remaining), percent: metric.percent }), bar };
}

export function CategorySummaryButton({ labelId, type, category, metric, baseline, hasDraft, budgetReady, budgetError, onOpen }) {
  const { t, label } = useTranslation();
  const nameId = useId();
  const lineId = useId();
  const { line, tone, bar } = describeSelectedBudget({ t, type, metric, baseline, hasDraft, budgetReady, budgetError });

  return (
    <button
      type="button"
      className="txn-input txn-category-summary"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-labelledby={`${labelId} ${nameId} ${lineId}`}
    >
      <span className="txn-category-summary__row">
        <span className="txn-category-summary__icon" aria-hidden="true">
          <CategoryOutlineIcon name={category} size={20} />
        </span>
        <span className="txn-category-summary__text">
          <span id={nameId} className="txn-category-summary__name">{category ? label(category) : t('transaction.chooseCategory')}</span>
          <span id={lineId} className={`txn-category-summary__line${tone ? ` is-${tone}` : ''}`} aria-live="polite">{line}</span>
        </span>
        <ChevronIcon />
      </span>
      {bar && (
        <span className="txn-budget-track" aria-hidden="true">
          <span className="txn-budget-track__fill" style={{ width: `${bar.filled}%`, background: bar.color }} />
          <span className="txn-budget-track__pending" style={{ width: `${bar.pending}%`, background: bar.color }} />
        </span>
      )}
    </button>
  );
}

export function CategoryPickerList({ type, categories, selected, metrics, onPick }) {
  const { t, label } = useTranslation();
  const [query, setQuery] = useState('');
  const showSearch = categories.length > SEARCH_THRESHOLD;
  const visible = useMemo(() => {
    const needle = foldText(query);
    if (!needle) return categories;
    return categories.filter((cat) => foldText(label(cat.name)).includes(needle) || foldText(cat.name).includes(needle));
  }, [categories, query, label]);

  return (
    <>
      {showSearch && (
        <div className="txn-sheet-search">
          <input
            type="search"
            className="txn-input"
            placeholder={t('transaction.searchCategory')}
            aria-label={t('transaction.searchCategory')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      )}
      <div className="txn-cat-options" role="radiogroup" aria-label={t('transaction.chooseCategory')}>
        {visible.map((cat) => {
          const metric = type === 'expense' ? metrics[cat.name] : null;
          const isSelected = selected.toLowerCase() === cat.name.toLowerCase();
          return (
            <button
              type="button"
              role="radio"
              aria-checked={isSelected}
              key={cat.name}
              className={`txn-cat-option${isSelected ? ' is-selected' : ''}`}
              onClick={() => onPick(cat.name)}
            >
              <span className="txn-cat-option__icon" aria-hidden="true"><CategoryOutlineIcon name={cat.name} size={19} /></span>
              <span className="txn-cat-option__text">
                <span className="txn-cat-option__name">{label(cat.name)}</span>
                {metric && (
                  <span className={`txn-cat-option__meta${metric.hasLimit && metric.status === 'danger' ? ' is-danger' : ''}`}>
                    {metric.hasLimit ? `${formatCurrency(metric.remaining)} · ${metric.statusLabel}` : metric.statusLabel}
                  </span>
                )}
                {metric?.hasLimit && (
                  <span className="txn-budget-track" aria-hidden="true">
                    <span className="txn-budget-track__fill" style={{ width: `${metric.percent}%`, background: metric.color }} />
                  </span>
                )}
              </span>
              <span className="txn-cat-option__check" aria-hidden="true">{isSelected && <CheckOutlineIcon size={12} />}</span>
            </button>
          );
        })}
        {visible.length === 0 && <p className="txn-sheet-empty" role="status">{t('transaction.noCategoryMatch')}</p>}
      </div>
    </>
  );
}

function relativeDayLabel(iso, todayIso, t, intlLocale) {
  if (iso === todayIso) return t('date.today');
  if (iso === shiftIsoDays(todayIso, -1)) return t('date.yesterday');
  const parts = parseIsoDate(iso);
  if (!parts) return '';
  const weekday = new Intl.DateTimeFormat(intlLocale || 'vi-VN', { weekday: 'long' })
    .format(new Date(parts.year, parts.month, parts.day));
  return weekday.charAt(0).toLocaleUpperCase(intlLocale || 'vi-VN') + weekday.slice(1);
}

export function MobileDateField({ id, labelId, value, todayIso, onOpen }) {
  const { t, lang, intlLocale } = useTranslation();
  const valueId = useId();
  const order = String(lang || '').startsWith('zh') ? 'ymd' : 'dmy';
  const relative = relativeDayLabel(value, todayIso, t, intlLocale);
  return (
    <button
      type="button"
      id={id}
      className="txn-input txn-date-trigger"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-labelledby={`${labelId} ${valueId}`}
    >
      <CalendarIcon />
      <span id={valueId} className="txn-date-trigger__value">
        {relative ? `${relative}, ${formatDisplayDate(value, order)}` : formatDisplayDate(value, order)}
      </span>
      <ChevronIcon down />
    </button>
  );
}

export function DateSheetContent({ value, todayIso, onPick, onEscape }) {
  const { t } = useTranslation();
  const shortcuts = [
    ['date.today', todayIso],
    ['date.yesterday', shiftIsoDays(todayIso, -1)],
    ['date.dayBeforeYesterday', shiftIsoDays(todayIso, -2)]
  ];
  return (
    <>
      <div className="txn-date-chips" role="group" aria-label={t('transaction.pickDate')}>
        {shortcuts.map(([key, iso]) => (
          <button
            type="button"
            key={key}
            className={`txn-date-chip${value === iso ? ' is-active' : ''}`}
            aria-pressed={value === iso}
            onClick={() => onPick(iso)}
          >
            {t(key)}
          </button>
        ))}
      </div>
      <CalendarPanel
        value={value}
        max={todayIso}
        onSelect={(iso) => { if (iso) onPick(iso); }}
        onEscape={onEscape}
        className="txn-sheet-calendar"
      />
      <p className="txn-sheet-hint">{t('transaction.futureDateHint')}</p>
    </>
  );
}
