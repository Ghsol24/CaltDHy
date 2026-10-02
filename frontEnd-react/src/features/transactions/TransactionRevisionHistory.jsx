import React, { useEffect, useRef, useState } from 'react';
import { spendingService } from '../../services/spendingService';
import { useTranslation } from '../../i18n/useTranslation';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';

const FIELD_KEYS = {
  amount: 'transaction.amount', fee: 'transaction.fee', type: 'transaction.type',
  category: 'transaction.category', date: 'transaction.date', walletId: 'history.filterWallet',
  toWalletId: 'transaction.receivingWallet', desc: 'transaction.note'
};

export function TransactionRevisionHistory({ transactionId, wallets }) {
  const { t, label, lang } = useTranslation();
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState(0);
  const [page, setPage] = useState(1);
  const loaded = useRef({ page: 0, request: 0 });
  const [state, setState] = useState({ loading: false, error: false, entries: [], totalPages: 1 });
  useEffect(() => {
    if (!open || (loaded.current.page === page && loaded.current.request === request)) return undefined;
    let active = true;
    setState((previous) => ({ ...previous, loading: true, error: false }));
    spendingService.getTransactionHistory(transactionId, page).then((response) => {
      if (!response.success) throw new Error('history');
      if (active) {
        loaded.current = { page, request };
        setState((previous) => ({ loading: false, error: false,
          entries: page === 1 ? response.data : [...previous.entries, ...response.data],
          totalPages: response.pagination?.totalPages || 1 }));
      }
    }).catch(() => { if (active) setState((previous) => ({ ...previous, loading: false, error: true })); });
    return () => { active = false; };
  }, [open, transactionId, page, request]);

  const valueLabel = (field, snapshot) => {
    const value = snapshot?.[field];
    if (value === null || value === undefined || value === '') return '—';
    if (field === 'amount' || field === 'fee') return formatCurrency(value);
    if (field === 'date') return formatDate(value, 'compact', { locale: lang });
    if (field === 'type') return t(`type.${value}`);
    if (field === 'category') return label(value);
    if (field === 'walletId' || field === 'toWalletId') return wallets.find((wallet) => wallet.id === value)?.name
      || t('transaction.previousWallet');
    return String(value);
  };

  return <section className="txn-revisions">
    <button type="button" className="txn-revisions-toggle" aria-expanded={open}
      aria-controls="txn-revisions-content" onClick={() => setOpen((previous) => !previous)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7M3 3v6h6M12 7v5l3 2" /></svg>
      {t('transaction.revisionHistory')}
      <span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open && <div id="txn-revisions-content" className="txn-revisions-content" aria-live="polite">
      {state.entries.map((entry) => <article key={entry.id} className="txn-revision-entry">
        <header><strong>{entry.actorName || t('transaction.accountOwner')}</strong>
          <time dateTime={entry.occurredAt}>{formatDateTime(entry.occurredAt, { locale: lang })}</time></header>
        <ul>{entry.changedFields.filter((field) => FIELD_KEYS[field]).map((field) =>
          <li key={field}><span>{t(FIELD_KEYS[field])}</span><span>{valueLabel(field, entry.before)} → {valueLabel(field, entry.after)}</span></li>)}</ul>
      </article>)}
      {state.loading && <p role="status">{t('transaction.historyLoading')}</p>}
      {state.error && <p role="alert">{t('transaction.historyFailed')} <button type="button"
        onClick={() => setRequest((previous) => previous + 1)}>{t('common.tryAgain')}</button></p>}
      {!state.loading && !state.error && state.entries.length === 0 && <p>{t('transaction.historyEmpty')}</p>}
      {!state.loading && !state.error && page < state.totalPages && <button type="button"
        onClick={() => setPage((previous) => previous + 1)}>{t('history.loadMore')}</button>}
    </div>}
  </section>;
}
