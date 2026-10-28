import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
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
import { CustomDatePicker } from '../../components/ui/CustomDatePicker';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { formatDisplayDate } from '../../utils/datePicker';

const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function TransactionHistoryView() {
  const { t, label, lang } = useTranslation();
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
  const [type, setType] = useState(['income', 'expense', 'transfer', 'wallet_created'].includes(searchParams.get('type'))
    ? searchParams.get('type') : 'all');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [walletId, setWalletId] = useState('all');
  const [excludeRecurring, setExcludeRecurring] = useState(searchParams.get('excludeRecurring') === '1');
  const [visibleCount, setVisibleCount] = useState(50);
  const isCompact = useMediaQuery('(max-width: 640px)');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const controlsId = useId();
  const chipsRef = useRef(null);
  const searchRef = useRef(null);
  const transactions = useTransactionStore((state) => state.transactions);
  const loadError = useTransactionStore((state) => state.error);
  const reloadTransactions = useTransactionStore((state) => state.fetchTransactions);
  const openEditTransaction = useTransactionStore((state) => state.openEditTransaction);
  const wallets = useWalletStore((state) => state.wallets);
  const archivedWallets = useWalletStore((state) => state.archivedWallets);
  const walletHistory = useWalletStore((state) => state.walletHistory);
  const walletLoadError = useWalletStore((state) => state.error);
  const reloadWallets = useWalletStore((state) => state.fetchWallets);
  const historyRows = useMemo(() => [...transactions, ...walletHistory.map((event) => ({
    ...event, systemGenerated: true, category: t('type.wallet_created'),
    desc: t('history.walletCreated', { name: event.walletName })
  }))], [transactions, walletHistory, t]);
  const navigateTo = useSpendingStore((state) => state.navigateTo);

  const categories = useMemo(() => [...new Set(historyRows.map((row) => row.category).filter(Boolean))].sort(), [historyRows]);
  const invalidRange = Boolean(startDate && endDate && startDate > endDate);
  const filtered = useMemo(() => {
    if (invalidRange) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return historyRows.filter((row) =>
      (!startDate || row.date >= startDate) && (!endDate || row.date <= endDate) &&
      (type === 'all' || row.type === type) &&
      (category === 'all' || row.category === category) &&
      (walletId === 'all' || row.walletId === walletId || row.toWalletId === walletId) &&
      (!excludeRecurring || !isRecurringTrendTransaction(row)) &&
      (!normalizedQuery || `${row.desc || ''} ${row.category || ''}`.toLocaleLowerCase().includes(normalizedQuery))
    ).sort((a, b) => b.date.localeCompare(a.date) || transactionTotal(b) - transactionTotal(a));
  }, [historyRows, startDate, endDate, type, category, walletId, excludeRecurring, query, invalidRange]);
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

  const dropParams = (...keys) => {
    if (!keys.some((key) => searchParams.has(key))) return;
    const next = new URLSearchParams(searchParams);
    keys.forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  };

  // Every condition currently narrowing the list, shown as a removable chip
  // right where it takes effect (instead of hiding it inside the dropdowns).
  const activeFilters = (() => {
    const dateOrder = String(lang).startsWith('zh') ? 'ymd' : 'dmy';
    const showDate = (iso) => formatDisplayDate(iso, dateOrder);
    const chips = [];
    if (query.trim()) chips.push({ id: 'query', text: t('history.searchChip', { query: query.trim() }), remove: () => setQuery('') });
    if (type !== 'all') chips.push({ id: 'type', text: `${t('history.filterType')}: ${t(`type.${type}`)}`,
      remove: () => { setType('all'); dropParams('type'); } });
    if (category !== 'all') chips.push({ id: 'category', text: `${t('history.filterCategory')}: ${label(category)}`,
      remove: () => { setCategory('all'); dropParams('category'); } });
    if (walletId !== 'all') {
      const wallet = [...wallets, ...archivedWallets].find((item) => item.id === walletId);
      chips.push({ id: 'wallet', text: `${t('history.filterWallet')}: ${wallet?.name || walletId}`, remove: () => setWalletId('all') });
    }
    if (datePreset !== 'all' && (datePreset !== 'custom' || startDate || endDate)) {
      let period;
      if (datePreset !== 'custom') period = t(`history.${datePreset}`);
      else if (startDate && endDate) period = startDate === endDate ? showDate(startDate) : `${showDate(startDate)} – ${showDate(endDate)}`;
      else period = startDate ? t('history.rangeFrom', { date: showDate(startDate) }) : t('history.rangeTo', { date: showDate(endDate) });
      chips.push({ id: 'period', text: `${t('history.filterPeriod')}: ${period}`,
        remove: () => { setDatePreset('all'); setStartDate(''); setEndDate(''); dropParams('date', 'from', 'to'); } });
    }
    if (excludeRecurring) chips.push({ id: 'recurring', text: t('history.excludeRecurring'),
      remove: () => { setExcludeRecurring(false); dropParams('excludeRecurring'); } });
    return chips;
  })();
  const filterCount = activeFilters.filter((chip) => chip.id !== 'query').length;

  const removeChip = (chip, index) => {
    chip.remove();
    // Keep keyboard focus on the chip row instead of dropping it on <body>.
    requestAnimationFrame(() => {
      const remaining = chipsRef.current?.querySelectorAll('.transaction-filter-chip');
      const target = remaining?.[Math.min(index, remaining.length - 1)];
      (target || searchRef.current)?.focus();
    });
  };

  const manageSource = (source) => navigateTo(source === 'jars' ? 'jars' : 'plan',
    source === 'jars' ? 'history' : 'recurring');

  return <section className="transaction-history" aria-labelledby="transaction-history-title">
    <header className="transaction-history-header">
      <div>
        <h2 id="transaction-history-title">{t('history.title')}</h2>
      </div>
    </header>

    <div className={`transaction-filter-bar${isCompact ? ' is-compact' : ''}`}>
      <label className="transaction-history-search">
        <span className="transaction-filter-sr-only">{t('common.search')}</span>
        <span className="transaction-history-search-control">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
          </svg>
          <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder={t('history.searchPlaceholder')} />
        </span>
      </label>
      {isCompact && <button type="button" className={`transaction-filter-toggle${filterCount ? ' has-filters' : ''}`}
        aria-expanded={filtersOpen} aria-controls={controlsId} onClick={() => setFiltersOpen((open) => !open)}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        <span>{t('history.filters')}</span>
        {filterCount > 0 && <span className="transaction-filter-count">{filterCount}</span>}
        <svg className="transaction-filter-toggle-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>}
      <div id={controlsId} className="transaction-filter-controls" hidden={isCompact && !filtersOpen}>
        <TransactionFilterDropdown compact active={type !== 'all'} label={t('history.filterType')} value={type} onChange={setType}
          options={[{ value: 'all', label: t('history.allTypes') },
            ...['expense', 'income', 'transfer', 'wallet_created'].map((value) => ({ value, label: t(`type.${value}`) }))]} />
        <TransactionFilterDropdown compact active={category !== 'all'} label={t('history.filterCategory')} value={category} onChange={setCategory}
          options={[{ value: 'all', label: t('history.allCategories') },
            ...categories.map((value) => ({ value, label: label(value) }))]} />
        <TransactionFilterDropdown compact active={walletId !== 'all'} label={t('history.filterWallet')} value={walletId} onChange={setWalletId}
          options={[{ value: 'all', label: t('history.allWallets') },
            ...[...wallets, ...archivedWallets].map((wallet) => ({ value: wallet.id, label: wallet.name }))]} />
        <TransactionFilterDropdown compact active={datePreset !== 'all'} label={t('history.filterPeriod')} value={datePreset}
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

    {activeFilters.length > 0 && <div ref={chipsRef} className="transaction-active-filters" role="group"
      aria-label={t('history.activeFilters')}>
      {activeFilters.map((chip, index) => <button key={chip.id} type="button" className="transaction-filter-chip"
        aria-label={t('history.removeFilter', { name: chip.text })} onClick={() => removeChip(chip, index)}>
        <span>{chip.text}</span>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>)}
      {isCompact && activeFilters.length > 1 && <button type="button" className="transaction-filter-chip-clear"
        onClick={() => { clearFilters(); requestAnimationFrame(() => searchRef.current?.focus()); }}>{t('history.clearAll')}</button>}
    </div>}

    {datePreset === 'custom' && <div className="transaction-filter-custom-dates">
      <div className="transaction-filter-date-field">
        <label htmlFor="history-date-from">{t('history.fromDate')}</label>
        <CustomDatePicker id="history-date-from" value={startDate} max={endDate || undefined} onChange={setStartDate} />
      </div>
      <div className="transaction-filter-date-field">
        <label htmlFor="history-date-to">{t('history.toDate')}</label>
        <CustomDatePicker id="history-date-to" value={endDate} min={startDate || undefined} onChange={setEndDate} />
      </div>
    </div>}

    {invalidRange && <p role="alert" className="transaction-history-error">{t('history.invalidRange')}</p>}
    {(loadError || walletLoadError) && <div role="alert" className="transaction-history-error">
      <span>{t('history.loadFailed')}</span>
      <button type="button" onClick={() => { void reloadTransactions(); void reloadWallets(); }}>{t('common.tryAgain')}</button>
    </div>}
    <div className="transaction-history-summary" aria-live="polite">
      <strong>{activeFilters.length > 0
        ? t('history.entriesFiltered', { count: summary.count, total: historyRows.length })
        : t('history.entries', { count: summary.count })}</strong>
      <span>{t('type.expense')}: {formatCurrency(summary.expense)}</span>
      <span>{t('type.income')}: {formatCurrency(summary.income)}</span>
    </div>
    {(!loadError || historyRows.length > 0) && <TransactionRows transactions={filtered.slice(0, visibleCount)}
      onEdit={openEditTransaction} onManage={manageSource} showDate variant="ledger" />}
    {visibleCount < filtered.length && <button type="button" className="transaction-history-more"
      onClick={() => setVisibleCount((count) => count + 50)}>{t('history.loadMore')}
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>}
  </section>;
}
