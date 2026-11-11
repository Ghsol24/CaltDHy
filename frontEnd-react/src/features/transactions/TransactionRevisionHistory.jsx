import React, { useEffect, useState } from 'react';
import { spendingService } from '../../services/spendingService';
import { useTranslation } from '../../i18n/useTranslation';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { Icon } from '../../components/ui/AppIcons';

const FIELD_KEYS = {
  amount: 'transaction.amount', fee: 'transaction.fee', type: 'transaction.type',
  category: 'transaction.category', date: 'transaction.date', walletId: 'history.filterWallet',
  toWalletId: 'transaction.receivingWallet', desc: 'transaction.note'
};

/**
 * "Edited 2 times · View history". Most entries were never changed, so nothing is
 * shown for them: the first page loads with the dialog and its total decides.
 */
export function TransactionRevisionHistory({ transactionId, wallets }) {
  const { t, label, lang } = useTranslation();
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ status: 'loading', entries: [], total: 0, totalPages: 1 });
  useEffect(() => {
    let active = true;
    setState((previous) => ({ ...previous, status: 'loading' }));
    spendingService.getTransactionHistory(transactionId, page).then((response) => {
      if (!response?.success || !Array.isArray(response.data)) throw new Error('history');
      if (active) {
        setState((previous) => ({ status: 'ready',
          entries: page === 1 ? response.data : [...previous.entries, ...response.data],
          total: response.pagination?.total ?? response.data.length,
          totalPages: response.pagination?.totalPages || 1 }));
      }
    }).catch(() => { if (active) setState((previous) => ({ ...previous, status: 'error' })); });
    return () => { active = false; };
  }, [transactionId, page, request]);

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

  const retry = <button type="button" className="txn-revisions-retry"
    onClick={() => setRequest((previous) => previous + 1)}>{t('common.tryAgain')}</button>;
  const icon = <Icon name="history" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />;

  if (state.entries.length === 0) {
    if (state.status === 'error') {
      return <p className="txn-revisions-summary">{icon}<span>{t('transaction.historyFailed')}</span>{retry}</p>;
    }
    return null;
  }

  return <section className="txn-revisions" aria-label={t('transaction.revisionHistory')}>
    <p className="txn-revisions-summary">
      {icon}
      <span>{state.total === 1 ? t('transaction.revisionSummaryOne') : t('transaction.revisionSummary', { count: state.total })}</span>
      <span aria-hidden="true">·</span>
      <button type="button" className="txn-revisions-toggle" aria-expanded={open}
        aria-controls="txn-revisions-content" onClick={() => setOpen((previous) => !previous)}>
        {open ? t('transaction.revisionHide') : t('transaction.revisionShow')}
      </button>
    </p>
    {open && <div id="txn-revisions-content" className="txn-revisions-content" aria-live="polite">
      {state.entries.map((entry) => <article key={entry.id} className="txn-revision-entry">
        <header><strong>{entry.actorName || t('transaction.accountOwner')}</strong>
          <time dateTime={entry.occurredAt}>{formatDateTime(entry.occurredAt, { locale: lang })}</time></header>
        {/* A delete or undo touches every field; one line says what happened instead of "x → —" rows. */}
        {entry.action === 'delete' || entry.action === 'restore'
          ? <ul><li className={`txn-revision-action is-${entry.action}`}>
            <span>{t(entry.action === 'delete' ? 'transaction.revisionDeleted' : 'transaction.revisionRestored')}</span>
            <span>{valueLabel('amount', entry.before || entry.after)}</span>
          </li></ul>
          : <ul>{entry.changedFields.filter((field) => FIELD_KEYS[field]).map((field) =>
            <li key={field}><span>{t(FIELD_KEYS[field])}</span><span>{valueLabel(field, entry.before)} → {valueLabel(field, entry.after)}</span></li>)}</ul>}
      </article>)}
      {state.status === 'loading' && <p role="status">{t('transaction.historyLoading')}</p>}
      {state.status === 'error' && <p role="alert">{t('transaction.historyFailed')} {retry}</p>}
      {state.status === 'ready' && page < state.totalPages && <button type="button"
        onClick={() => setPage((previous) => previous + 1)}>{t('history.loadMore')}</button>}
    </div>}
  </section>;
}
