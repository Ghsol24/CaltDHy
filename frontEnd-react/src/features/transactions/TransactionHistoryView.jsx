import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { BottomSheet } from '../../components/ui/BottomSheet';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { formatDisplayDate } from '../../utils/datePicker';
import { getHistoryFilterCopy } from './historyFilterCopy';

const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function TransactionHistoryView() {
  const { t, label, lang } = useTranslation();
  const chipCopy = getHistoryFilterCopy(lang);
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
  const searchRef = useRef(null);
  const controlsRef = useRef(null);
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

  // Text for a period filter, e.g. "Tháng này" or "01/10/2026 – 15/10/2026".
  const periodText = (() => {
    if (datePreset === 'all' || (datePreset === 'custom' && !startDate && !endDate)) return null;
    if (datePreset !== 'custom') return t(`history.${datePreset}`);
    const dateOrder = String(lang).startsWith('zh') ? 'ymd' : 'dmy';
    const showDate = (iso) => formatDisplayDate(iso, dateOrder);
    if (startDate && endDate) return startDate === endDate ? showDate(startDate) : `${showDate(startDate)} – ${showDate(endDate)}`;
    return startDate ? chipCopy.rangeFrom(showDate(startDate)) : chipCopy.rangeTo(showDate(endDate));
  })();
  const filterCount = [type !== 'all', category !== 'all', walletId !== 'all', Boolean(periodText), excludeRecurring]
    .filter(Boolean).length;

  const options = {
    type: [{ value: 'all', label: t('history.allTypes') },
      ...['expense', 'income', 'transfer', 'wallet_created'].map((value) => ({ value, label: t(`type.${value}`) }))],
    category: [{ value: 'all', label: t('history.allCategories') },
      ...categories.map((value) => ({ value, label: label(value) }))],
    wallet: [{ value: 'all', label: t('history.allWallets') },
      ...[...wallets, ...archivedWallets].map((wallet) => ({ value: wallet.id, label: wallet.name }))],
    period: [
      { value: 'all', label: t('history.allTime') },
      { value: 'thisMonth', label: t('history.thisMonth') },
      { value: 'lastMonth', label: t('history.lastMonth') },
      { value: 'last7Days', label: t('history.last7Days') },
      { value: 'custom', label: t('history.customDate') }
    ]
  };
  const changeType = (value) => { setType(value); if (value === 'all') dropParams('type'); };
  const changeCategory = (value) => { setCategory(value); if (value === 'all') dropParams('category'); };
  const changePeriod = (value) => { chooseDatePreset(value); if (value === 'all') dropParams('date', 'from', 'to'); };
  const changeRecurring = (checked) => { setExcludeRecurring(checked); if (!checked) dropParams('excludeRecurring'); };

  // One chip per filter: the name while unused, the chosen value while filtering.
  const filterChips = [
    { id: 'type', active: type !== 'all', node: <TransactionFilterDropdown sheet={isCompact} active={type !== 'all'}
      label={t('history.filterType')} value={type} onChange={changeType} options={options.type} /> },
    { id: 'category', active: category !== 'all', node: <TransactionFilterDropdown sheet={isCompact} active={category !== 'all'}
      label={t('history.filterCategory')} value={category} onChange={changeCategory} options={options.category} /> },
    { id: 'wallet', active: walletId !== 'all', node: <TransactionFilterDropdown sheet={isCompact} active={walletId !== 'all'}
      label={t('history.filterWallet')} value={walletId} onChange={setWalletId} options={options.wallet} /> },
    { id: 'period', active: datePreset !== 'all', node: <TransactionFilterDropdown sheet={isCompact} active={datePreset !== 'all'}
      label={t('history.filterPeriod')} value={datePreset} onChange={changePeriod} options={options.period}
      valueText={periodText || undefined} /> },
    { id: 'recurring', active: excludeRecurring, node: <label className={`transaction-history-checkbox${excludeRecurring ? ' is-active' : ''}`}>
      <input type="checkbox" checked={excludeRecurring} onChange={(event) => changeRecurring(event.target.checked)} />
      <svg className="transaction-history-check" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
        strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
      <span>{t('history.excludeRecurring')}</span>
    </label> }
  ];
  // On phones the chip row scrolls sideways, so what is filtering comes first.
  const orderedChips = isCompact
    ? [...filterChips.filter((chip) => chip.active), ...filterChips.filter((chip) => !chip.active)]
    : filterChips;
  const activeChipKey = orderedChips.filter((chip) => chip.active).map((chip) => chip.id).join();

  const customDates = (idPrefix) => <div className="transaction-filter-custom-dates">
    <div className="transaction-filter-date-field">
      <label htmlFor={`${idPrefix}-from`}>{t('history.fromDate')}</label>
      <CustomDatePicker id={`${idPrefix}-from`} value={startDate} max={endDate || undefined} onChange={setStartDate} />
    </div>
    <div className="transaction-filter-date-field">
      <label htmlFor={`${idPrefix}-to`}>{t('history.toDate')}</label>
      <CustomDatePicker id={`${idPrefix}-to`} value={endDate} min={startDate || undefined} onChange={setEndDate} />
    </div>
  </div>;

  // Filtering moves a chip to the front; bring the row back so it (and "Xóa bộ lọc") is in view.
  useEffect(() => {
    if (isCompact) controlsRef.current?.scrollTo?.({ left: 0 });
  }, [isCompact, activeChipKey]);

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
        aria-haspopup="dialog" aria-expanded={filtersOpen} aria-label={filterCount ? `${chipCopy.filters} (${filterCount})` : chipCopy.filters}
        onClick={() => setFiltersOpen(true)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        {filterCount > 0 && <span className="transaction-filter-count" aria-hidden="true">{filterCount}</span>}
      </button>}
      <div ref={controlsRef} className="transaction-filter-controls" role="group" aria-label={chipCopy.activeFilters}>
        {hasActiveFilters && <button type="button" className="transaction-history-clear"
          onClick={() => { clearFilters(); requestAnimationFrame(() => searchRef.current?.focus()); }}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>{t('history.clear')}{filterCount > 0 && ` (${filterCount})`}
        </button>}
        {orderedChips.map((chip) => <React.Fragment key={chip.id}>{chip.node}</React.Fragment>)}
      </div>
    </div>

    {datePreset === 'custom' && !filtersOpen && customDates('history-date')}

    {isCompact && <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={chipCopy.filters}
      className="transaction-filter-full-sheet" testId="history-filter-sheet"
      footer={<>
        <button type="button" className="transaction-sheet-reset" onClick={clearFilters} disabled={!hasActiveFilters}>{chipCopy.reset}</button>
        <button type="button" className="transaction-sheet-apply" onClick={() => setFiltersOpen(false)}>{chipCopy.showResults(summary.count)}</button>
      </>}>
      <FilterOptionGroup title={t('history.filterType')} options={options.type} value={type} onChange={changeType} />
      <FilterOptionGroup title={t('history.filterWallet')} options={options.wallet} value={walletId} onChange={setWalletId} />
      <FilterOptionGroup title={t('history.filterPeriod')} options={options.period} value={datePreset} onChange={changePeriod} />
      {datePreset === 'custom' && customDates('history-sheet-date')}
      <FilterOptionGroup title={t('history.filterCategory')} options={options.category} value={category} onChange={changeCategory} />
      <label className="transaction-sheet-switch">
        <span>{t('history.excludeRecurring')}</span>
        <input type="checkbox" role="switch" checked={excludeRecurring} onChange={(event) => changeRecurring(event.target.checked)} />
      </label>
    </BottomSheet>}

    {invalidRange && <p role="alert" className="transaction-history-error">{t('history.invalidRange')}</p>}
    {(loadError || walletLoadError) && <div role="alert" className="transaction-history-error">
      <span>{t('history.loadFailed')}</span>
      <button type="button" onClick={() => { void reloadTransactions(); void reloadWallets(); }}>{t('common.tryAgain')}</button>
    </div>}
    <div className="transaction-history-summary" aria-live="polite">
      <strong>{hasActiveFilters
        ? chipCopy.entriesFiltered({ count: summary.count, total: historyRows.length })
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

/** One filter as a set of tappable options, for the full filter sheet. */
function FilterOptionGroup({ title, options, value, onChange }) {
  return <fieldset className="transaction-sheet-group">
    <legend>{title}</legend>
    <div className="transaction-sheet-options">
      {options.map((option) => <button key={option.value} type="button" aria-pressed={option.value === value}
        className={`transaction-sheet-option${option.value === value ? ' is-selected' : ''}`} onClick={() => onChange(option.value)}>
        {option.value === value && <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}
        {option.label}
      </button>)}
    </div>
  </fieldset>;
}
