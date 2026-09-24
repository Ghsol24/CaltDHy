import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useTranslation } from '../../i18n/useTranslation';
import { formatCurrency } from '../../utils/formatters';
import { isRecurringTrendTransaction } from '../../utils/analyticsFilters';
import { summarizeTransactions, transactionTotal } from '../../utils/transactionInsights';
import { historyDateRange } from '../../utils/historyDatePresets';
import { TransactionFilterDropdown } from './TransactionFilterDropdown';
import { TransactionRows } from './TransactionRows';

const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function TransactionHistoryView() {
  const { t, label } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const seedDate = searchParams.get('date');
  const seedFrom = searchParams.get('from');
  const seedTo = searchParams.get('to');
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState(VALID_DATE.test(seedDate || '') ? seedDate
    : VALID_DATE.test(seedFrom || '') ? seedFrom : '');
  const [endDate, setEndDate] = useState(VALID_DATE.test(seedDate || '') ? seedDate
    : VALID_DATE.test(seedTo || '') ? seedTo : '');
  const [datePreset, setDatePreset] = useState(seedDate || seedFrom || seedTo ? 'custom' : 'all');
  const [type, setType] = useState(['income', 'expense', 'transfer'].includes(searchParams.get('type'))
    ? searchParams.get('type') : 'all');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [walletId, setWalletId] = useState('all');
  const [excludeRecurring, setExcludeRecurring] = useState(searchParams.get('excludeRecurring') === '1');
  const [visibleCount, setVisibleCount] = useState(50);
  const transactions = useTransactionStore((state) => state.transactions);
  const loadError = useTransactionStore((state) => state.error);
  const reloadTransactions = useTransactionStore((state) => state.fetchTransactions);
  const openEditTransaction = useTransactionStore((state) => state.openEditTransaction);
  const wallets = useWalletStore((state) => state.wallets);
  const archivedWallets = useWalletStore((state) => state.archivedWallets);
  const navigateTo = useSpendingStore((state) => state.navigateTo);

  const categories = useMemo(() => [...new Set(transactions.map((row) => row.category).filter(Boolean))].sort(), [transactions]);
  const invalidRange = Boolean(startDate && endDate && startDate > endDate);
  const filtered = useMemo(() => {
    if (invalidRange) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return transactions.filter((row) =>
      (!startDate || row.date >= startDate) && (!endDate || row.date <= endDate) &&
      (type === 'all' || row.type === type) &&
      (category === 'all' || row.category === category) &&
      (walletId === 'all' || row.walletId === walletId || row.toWalletId === walletId) &&
      (!excludeRecurring || !isRecurringTrendTransaction(row)) &&
      (!normalizedQuery || `${row.desc || ''} ${row.category || ''}`.toLocaleLowerCase().includes(normalizedQuery))
    ).sort((a, b) => b.date.localeCompare(a.date) || transactionTotal(b) - transactionTotal(a));
  }, [transactions, startDate, endDate, type, category, walletId, excludeRecurring, query, invalidRange]);
  const summary = useMemo(() => summarizeTransactions(filtered), [filtered]);
  const hasActiveFilters = Boolean(query || startDate || endDate || datePreset !== 'all' ||
    type !== 'all' || category !== 'all' || walletId !== 'all' || excludeRecurring);

  useEffect(() => { setVisibleCount(50); }, [startDate, endDate, type, category, walletId, excludeRecurring, query]);

  const clearFilters = () => {
    setQuery(''); setStartDate(''); setEndDate(''); setType('all');
    setCategory('all'); setWalletId('all'); setExcludeRecurring(false); setDatePreset('all');
    setSearchParams({}, { replace: true });
  };

  const chooseDatePreset = (preset) => {
    setDatePreset(preset);
    if (preset === 'custom') return;
    const range = historyDateRange(preset);
    setStartDate(range.from);
    setEndDate(range.to);
  };

  const manageSource = (source) => navigateTo(source === 'jars' ? 'jars' : 'plan',
    source === 'jars' ? 'history' : 'recurring');

  return <section className="transaction-history" aria-labelledby="transaction-history-title">
    <header className="transaction-history-header">
      <div>
        <h2 id="transaction-history-title">{t('history.title')}</h2>
        <p>{t('history.subtitle')}</p>
      </div>
    </header>

    <div className="transaction-filter-bar">
      <label className="transaction-history-search">
        <span className="transaction-filter-sr-only">{t('common.search')}</span>
        <span className="transaction-history-search-control">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
          </svg>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder={t('history.searchPlaceholder')} />
        </span>
      </label>
      <div className="transaction-filter-controls">
        <TransactionFilterDropdown compact label={t('history.filterType')} value={type} onChange={setType}
          options={[{ value: 'all', label: t('history.allTypes') },
            ...['expense', 'income', 'transfer'].map((value) => ({ value, label: t(`type.${value}`) }))]} />
        <TransactionFilterDropdown compact label={t('history.filterCategory')} value={category} onChange={setCategory}
          options={[{ value: 'all', label: t('history.allCategories') },
            ...categories.map((value) => ({ value, label: label(value) }))]} />
        <TransactionFilterDropdown compact label={t('history.filterWallet')} value={walletId} onChange={setWalletId}
          options={[{ value: 'all', label: t('history.allWallets') },
            ...[...wallets, ...archivedWallets].map((wallet) => ({ value: wallet.id, label: wallet.name }))]} />
        <TransactionFilterDropdown compact label={t('history.filterPeriod')} value={datePreset}
          onChange={chooseDatePreset} options={[
            { value: 'all', label: t('history.allTime') },
            { value: 'thisMonth', label: t('history.thisMonth') },
            { value: 'lastMonth', label: t('history.lastMonth') },
            { value: 'last7Days', label: t('history.last7Days') },
            { value: 'custom', label: t('history.customDate') }
          ]} />
        <label className={`transaction-history-checkbox${excludeRecurring ? ' is-active' : ''}`}>
          <input type="checkbox" checked={excludeRecurring}
            onChange={(event) => setExcludeRecurring(event.target.checked)} />
          <span className="transaction-history-switch" aria-hidden="true"><span /></span>
          <span>{t('history.excludeRecurring')}</span>
        </label>
        <button type="button" className="transaction-history-clear" onClick={clearFilters}
          disabled={!hasActiveFilters}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>{t('history.clear')}
        </button>
      </div>
    </div>

    {datePreset === 'custom' && <div className="transaction-filter-custom-dates">
      <label><span>{t('history.fromDate')}</span><input type="date" value={startDate}
        onChange={(event) => setStartDate(event.target.value)} /></label>
      <label><span>{t('history.toDate')}</span><input type="date" value={endDate}
        onChange={(event) => setEndDate(event.target.value)} /></label>
    </div>}

    {invalidRange && <p role="alert" className="transaction-history-error">{t('history.invalidRange')}</p>}
    {loadError && <div role="alert" className="transaction-history-error">
      <span>{t('history.loadFailed')}</span>
      <button type="button" onClick={() => { void reloadTransactions(); }}>{t('common.tryAgain')}</button>
    </div>}
    <div className="transaction-history-summary" aria-live="polite">
      <strong>{t('history.results', { count: summary.count })}</strong>
      <span>{t('type.expense')}: {formatCurrency(summary.expense)}</span>
      <span>{t('type.income')}: {formatCurrency(summary.income)}</span>
    </div>
    {(!loadError || transactions.length > 0) && <TransactionRows transactions={filtered.slice(0, visibleCount)}
      onEdit={openEditTransaction} onManage={manageSource} showDate variant="ledger" />}
    {visibleCount < filtered.length && <button type="button" className="transaction-history-more"
      onClick={() => setVisibleCount((count) => count + 50)}>{t('history.loadMore')}
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>}
  </section>;
}
