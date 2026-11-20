import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
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
import { PageHeader } from '../../components/ui/PageHeader';
import { getTransactionExtrasCopy } from './transactionExtrasCopy';
import { AmountRangeInputs, SavedFiltersBody } from './HistoryAdvancedFilters';
import { useFinanceSettingsStore } from '../../stores/useFinanceSettingsStore';
import { useToastStore } from '../../stores/useToastStore';

import { Icon } from '../../components/ui/AppIcons';
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function TransactionHistoryView() {
  const { t, label, lang } = useTranslation();
  const chipCopy = getHistoryFilterCopy(lang);
  const extrasCopy = getTransactionExtrasCopy(lang);
  const savedFilters = useFinanceSettingsStore((state) => state.savedFilters);
  const loadSettings = useFinanceSettingsStore((state) => state.load);
  const saveFilters = useFinanceSettingsStore((state) => state.saveFilters);
  const addToast = useToastStore((state) => state.addToast);
  useEffect(() => { void loadSettings(); }, [loadSettings]);
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
  const [walletId, setWalletId] = useState(searchParams.get('wallet') || 'all');
  const [excludeRecurring, setExcludeRecurring] = useState(searchParams.get('excludeRecurring') === '1');
  const [minAmount, setMinAmount] = useState(null);
  const [maxAmount, setMaxAmount] = useState(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const isCompact = useMediaQuery('(max-width: 640px)');
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const openAddTxnModal = useSpendingStore((state) => state.openAddTxnModal);

  const categories = useMemo(() => [...new Set(historyRows.map((row) => row.category).filter(Boolean))].sort(), [historyRows]);
  const invalidRange = Boolean(startDate && endDate && startDate > endDate);
  const invalidAmount = Boolean(minAmount && maxAmount && minAmount > maxAmount);
  const filtered = useMemo(() => {
    if (invalidRange || invalidAmount) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const amountOf = (row) => (row.type === 'wallet_created' ? Number(row.initialBalance) || 0 : transactionTotal(row));
    return historyRows.filter((row) =>
      (!startDate || row.date >= startDate) && (!endDate || row.date <= endDate) &&
      (type === 'all' || row.type === type) &&
      (category === 'all' || row.category === category) &&
      (walletId === 'all' || row.walletId === walletId || row.toWalletId === walletId) &&
      (!excludeRecurring || !isRecurringTrendTransaction(row)) &&
      (!minAmount || amountOf(row) >= minAmount) && (!maxAmount || amountOf(row) <= maxAmount) &&
      (!normalizedQuery || `${row.desc || ''} ${row.category || ''}`.toLocaleLowerCase().includes(normalizedQuery))
    ).sort((a, b) => b.date.localeCompare(a.date) || transactionTotal(b) - transactionTotal(a));
  }, [historyRows, startDate, endDate, type, category, walletId, excludeRecurring, query, invalidRange, minAmount, maxAmount, invalidAmount]);
  const summary = useMemo(() => summarizeTransactions(filtered), [filtered]);
  const hasActiveFilters = Boolean(query || startDate || endDate || datePreset !== 'all' ||
    type !== 'all' || category !== 'all' || walletId !== 'all' || excludeRecurring || minAmount || maxAmount);

  useEffect(() => { setVisibleCount(50); }, [startDate, endDate, type, category, walletId, excludeRecurring, query, minAmount, maxAmount]);

  const clearFilters = () => {
    setQuery(''); setStartDate(''); setEndDate(''); setType('all');
    setCategory('all'); setWalletId('all'); setExcludeRecurring(false); setDatePreset('all');
    setMinAmount(null); setMaxAmount(null);
    setSearchParams({}, { replace: true });
  };
  const changeAmount = (min, max) => { setMinAmount(min); setMaxAmount(max); };

  // A search from the command palette arrives as router state, also while this page is already open:
  // it replaces whatever filters were set, so the result is exactly what was asked for.
  const commandSearch = useLocation().state?.commandSearch;
  useEffect(() => {
    if (!commandSearch) return;
    setQuery(commandSearch.query || ''); setCategory(commandSearch.category || 'all');
    setStartDate(''); setEndDate(''); setDatePreset('all'); setType('all'); setWalletId('all');
    setExcludeRecurring(false); setMinAmount(null); setMaxAmount(null);
  }, [commandSearch]);

  // A saved filter stores the preset ("this month"), not its dates, so it stays current when reused later.
  const currentCriteria = () => ({ query: query.trim(), type, category, walletId, tag: 'all', minAmount, maxAmount,
    datePreset, startDate: datePreset === 'custom' ? startDate : '', endDate: datePreset === 'custom' ? endDate : '', excludeRecurring });
  const applySaved = ({ criteria }) => {
    const knownWallet = [...wallets, ...archivedWallets].some((wallet) => wallet.id === criteria.walletId);
    setQuery(criteria.query || ''); setType(criteria.type || 'all'); setCategory(criteria.category || 'all');
    setWalletId(knownWallet ? criteria.walletId : 'all');
    setMinAmount(criteria.minAmount || null); setMaxAmount(criteria.maxAmount || null);
    setExcludeRecurring(Boolean(criteria.excludeRecurring));
    const preset = criteria.datePreset || 'all';
    setDatePreset(preset);
    if (preset === 'custom') { setStartDate(criteria.startDate || ''); setEndDate(criteria.endDate || ''); }
    else { const range = historyDateRange(preset); setStartDate(range.from); setEndDate(range.to); }
    setSearchParams({}, { replace: true });
  };
  const saveCurrent = async (name) => {
    await saveFilters([...savedFilters, { name, criteria: currentCriteria() }]);
    addToast({ type: 'success', message: extrasCopy.savedOk });
  };
  const deleteSaved = (id) => saveFilters(savedFilters.filter((filter) => filter.id !== id));

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
  const filterCount = [type !== 'all', category !== 'all', walletId !== 'all', Boolean(periodText), excludeRecurring, Boolean(minAmount || maxAmount)]
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
  const changeWallet = (value) => { setWalletId(value); if (value === 'all') dropParams('wallet'); };
  const changeRecurring = (checked) => { setExcludeRecurring(checked); if (!checked) dropParams('excludeRecurring'); };

  // The row keeps two quick filters (period, type); everything else lives in "Bộ lọc (n)" and, once
  // applied, shows as a removable chip under the row.
  const panelCount = [category !== 'all', walletId !== 'all', Boolean(minAmount || maxAmount), excludeRecurring].filter(Boolean).length;
  const walletName = [...wallets, ...archivedWallets].find((wallet) => wallet.id === walletId)?.name || '';
  const appliedChips = [
    category !== 'all' && { id: 'category', text: chipCopy.chipCategory(label(category)), clear: () => changeCategory('all') },
    walletId !== 'all' && { id: 'wallet', text: chipCopy.chipWallet(walletName), clear: () => changeWallet('all') },
    Boolean(minAmount || maxAmount) && { id: 'amount', text: extrasCopy.amountChip(minAmount ? formatCurrency(minAmount) : '', maxAmount ? formatCurrency(maxAmount) : ''), clear: () => changeAmount(null, null) },
    excludeRecurring && { id: 'recurring', text: t('history.excludeRecurring'), clear: () => changeRecurring(false) },
  ].filter(Boolean);

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

  const manageSource = (source) => navigateTo(source === 'jars' ? 'jars' : 'plan',
    source === 'jars' ? 'history' : 'recurring');

  return <section className="transaction-history" aria-labelledby="transaction-history-title">
    <PageHeader icon="transactions" className="transaction-history-header"
      title={t('history.title')} titleId="transaction-history-title" />

    <div className="transaction-filter-bar">
      <label className="transaction-history-search">
        <span className="transaction-filter-sr-only">{t('common.search')}</span>
        <span className="transaction-history-search-control">
          <Icon name="searchSmall" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
          <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder={t('history.searchPlaceholder')} />
        </span>
      </label>
      <div className="transaction-filter-controls" role="group" aria-label={chipCopy.activeFilters}>
        <TransactionFilterDropdown sheet={isCompact} active={datePreset !== 'all'} label={t('history.filterPeriod')}
          value={datePreset} onChange={changePeriod} options={options.period} valueText={periodText || undefined} />
        <TransactionFilterDropdown sheet={isCompact} active={type !== 'all'} label={t('history.filterType')}
          value={type} onChange={changeType} options={options.type} />
        <button type="button" className={`transaction-filter-toggle${panelCount ? ' has-filters' : ''}`}
          aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
          <Icon name="filterLines" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
          <span>{panelCount ? `${chipCopy.filters} (${panelCount})` : chipCopy.filters}</span>
        </button>
      </div>
    </div>

    {hasActiveFilters && <div className="transaction-applied-filters" role="group" aria-label={chipCopy.appliedFilters}>
      {appliedChips.map((chip) => <button type="button" key={chip.id} className="transaction-applied-chip"
        aria-label={chipCopy.removeFilter(chip.text)} onClick={chip.clear}>
        <span>{chip.text}</span>
        <Icon name="closeAlt" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
      </button>)}
      <button type="button" className="transaction-history-clear"
        onClick={() => { clearFilters(); requestAnimationFrame(() => searchRef.current?.focus()); }}>
        <Icon name="closeAlt" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />{t('history.clear')}{filterCount > 0 && ` (${filterCount})`}
      </button>
    </div>}

    {datePreset === 'custom' && !filtersOpen && customDates('history-date')}

    <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={chipCopy.filters}
      className="transaction-filter-full-sheet" testId="history-filter-sheet"
      footer={<>
        <button type="button" className="transaction-sheet-reset" onClick={clearFilters} disabled={!hasActiveFilters}>{chipCopy.reset}</button>
        <button type="button" className="transaction-sheet-apply" onClick={() => setFiltersOpen(false)}>{chipCopy.showResults(summary.count)}</button>
      </>}>
      <FilterOptionGroup title={t('history.filterCategory')} options={options.category} value={category} onChange={changeCategory} />
      <FilterOptionGroup title={t('history.filterWallet')} options={options.wallet} value={walletId} onChange={changeWallet} />
      <fieldset className="transaction-sheet-group">
        <legend>{extrasCopy.amountRange}</legend>
        <AmountRangeInputs copy={extrasCopy} min={minAmount} max={maxAmount} onChange={changeAmount} className="history-sheet-amount" />
        {invalidAmount && <p className="history-popover-error" role="alert">{extrasCopy.amountInvalid}</p>}
      </fieldset>
      <label className="transaction-sheet-switch">
        <span>{t('history.excludeRecurring')}</span>
        <input type="checkbox" role="switch" checked={excludeRecurring} onChange={(event) => changeRecurring(event.target.checked)} />
      </label>
      <fieldset className="transaction-sheet-group">
        <legend>{extrasCopy.savedFilters}</legend>
        <SavedFiltersBody copy={extrasCopy} filters={savedFilters} canSave={hasActiveFilters && !invalidRange && !invalidAmount}
          onApply={(filter) => { applySaved(filter); setFiltersOpen(false); }} onSave={saveCurrent} onDelete={deleteSaved} />
      </fieldset>
    </BottomSheet>

    {invalidRange && <p role="alert" className="transaction-history-error">{t('history.invalidRange')}</p>}
    {invalidAmount && <p role="alert" className="transaction-history-error">{extrasCopy.amountInvalid}</p>}
    {(loadError || walletLoadError) && <div role="alert" className="transaction-history-error">
      <span>{t('history.loadFailed')}</span>
      <button type="button" onClick={() => { void reloadTransactions(); void reloadWallets(); }}>{t('common.tryAgain')}</button>
    </div>}
    <div className="transaction-history-summary" aria-live="polite">
      <strong>{hasActiveFilters
        ? chipCopy.entriesFiltered({ count: summary.count, total: historyRows.length })
        : t('history.entries', { count: summary.count })}</strong>
      <span className="transaction-history-total">{chipCopy.income} <b>{formatCurrency(summary.income)}</b></span>
      <span className="transaction-history-total">{chipCopy.expense} <b>{formatCurrency(summary.expense)}</b></span>
      <span className="transaction-history-total">{chipCopy.difference} <b>{`${summary.income - summary.expense < 0 ? '−' : '+'}${formatCurrency(Math.abs(summary.income - summary.expense))}`}</b></span>
    </div>
    {(!loadError || historyRows.length > 0) && <TransactionRows transactions={filtered.slice(0, visibleCount)}
      onEdit={openEditTransaction} onManage={manageSource} showDate variant="ledger"
      emptyState={historyRows.length === 0 ? (
        // No data yet and "nothing matches the filters" are different situations (TXN-07).
        <div className="transaction-history-empty">
          <strong>Chưa có giao dịch nào</strong>
          <button type="button" className="btn btn--primary btn--sm" onClick={openAddTxnModal}>+ Thêm giao dịch</button>
        </div>
      ) : (
        <div className="transaction-history-empty">
          <strong>Không có giao dịch khớp bộ lọc</strong>
          <button type="button" className="btn btn--secondary btn--sm" onClick={clearFilters}>Xóa bộ lọc</button>
        </div>
      )} />}
    {visibleCount < filtered.length && <button type="button" className="transaction-history-more"
      onClick={() => setVisibleCount((count) => count + 50)}>{t('history.loadMore')}
      <Icon name="chevronDownAlt" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
        {option.value === value && <Icon name="checkAlt" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
        {option.label}
      </button>)}
    </div>
  </fieldset>;
}
