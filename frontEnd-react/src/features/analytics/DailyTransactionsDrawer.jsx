import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useTranslation } from '../../i18n/useTranslation';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { summarizeTransactions, transactionsForDay } from '../../utils/transactionInsights';
import { TransactionRows } from '../transactions/TransactionRows';

export function DailyTransactionsDrawer({ date, initialType, transactions, excludeRecurring,
  expected, savingExpected, onToggleExpected, onClose, onEdit, onManage, onViewHistory }) {
  const { t, label, lang } = useTranslation();
  const [type, setType] = useState(initialType);
  const panelRef = useRef(null);
  useFocusTrap(panelRef, true);
  useBodyScrollLock(true);

  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const rows = useMemo(() => transactionsForDay(transactions, date, { type, excludeRecurring }),
    [transactions, date, type, excludeRecurring]);
  const summary = useMemo(() => summarizeTransactions(rows), [rows]);
  const total = type === 'income' ? summary.income : summary.expense;
  const categories = useMemo(() => {
    const totals = new Map();
    for (const row of rows) {
      const name = row.category || '';
      totals.set(name, (totals.get(name) || 0) + (type === 'expense'
        ? (Number(row.amount) || 0) + (Number(row.fee) || 0) : Number(row.amount) || 0));
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [rows, type]);

  return createPortal(<div className="day-drawer-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section ref={panelRef} className="day-drawer" role="dialog" aria-modal="true" aria-labelledby="day-drawer-title">
      <div className="day-drawer-header">
        <div>
          <span className="day-drawer-eyebrow">{t('analytics.pickDay')}</span>
          <h2 id="day-drawer-title">{t('analytics.dayTransactions', { date: formatDate(date, 'short', { locale: lang }) })}</h2>
        </div>
        <button type="button" className="day-drawer-close" onClick={onClose} aria-label={t('common.close')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="day-drawer-tabs" role="group" aria-label={t('history.allTypes')}>
        {['expense', 'income'].map((value) => <button key={value} type="button" aria-pressed={type === value}
          className={type === value ? 'is-active' : ''} onClick={() => setType(value)}>{t(`type.${value}`)}</button>)}
      </div>
      <div className="day-drawer-summary">
        <span>{t(`type.${type}`)} · {t('history.results', { count: summary.count })}</span>
        <strong>{formatCurrency(total)}</strong>
        {excludeRecurring && <small>{t('analytics.recurringExcluded')}</small>}
      </div>
      {categories.length > 0 && <div className="day-drawer-categories">
        {categories.map(([name, amount]) => <span key={name}>{label(name)} · {formatCurrency(amount)}</span>)}
      </div>}
      <div className="day-drawer-list">
        {rows.length > 0 ? <TransactionRows transactions={rows} onEdit={onEdit} onManage={onManage} />
          : <p className="transaction-inspection-empty">{t('analytics.dayEmpty')}</p>}
      </div>
      <div className="day-drawer-actions">
        {type === 'expense' && summary.count > 0 && <button type="button" className="day-drawer-secondary" disabled={savingExpected}
          onClick={() => onToggleExpected(date, !expected)}>
          {t(expected ? 'analytics.unusualUndoExpected' : 'analytics.unusualMarkExpected')}
        </button>}
        <button type="button" className="day-drawer-primary" onClick={() => onViewHistory(date, type)}>
          {t('analytics.viewHistory')}
        </button>
      </div>
    </section>
  </div>, document.body);
}
