import { useCallback, useMemo } from 'react';
import { filterTrendTransactions, summarizeRecurringExpenses } from '../../../utils/analyticsFilters';
import { cashFlowDays, cashFlowMonthTotals, cashFlowMonths, cashFlowSummary, cashFlowTopDays, hasCashFlowData } from '../../../utils/cashFlowData';
import { formatCurrency, formatMonthShort, getLocalDateString, getLocalMonthString } from '../../../utils/formatters';
import { unusualSpendingDays } from '../../../utils/transactionInsights';
import { getUserErrorMessage, isSilentError } from '../../../utils/userErrors.js';
import { useSpendingStore } from '../../../stores/useSpendingStore';

export function useCashFlowTrend({ activeMonth, addToast, barChartRef, clearDefault, drilldown, drilldownRevision, excludeRecurring, expectedDays, intlLocale, isCompactChart, lang, mobileWeek, monthLabel, navigate, navigateTo, pinDefault, setCashFlowView, setDrilldown, setMobileWeek, setSelectedDay, setSelectedMonth, t, transactions, trendMode, trendSeries }) {
  const trendTransactions = useMemo(
    () => filterTrendTransactions(transactions, excludeRecurring),
    [transactions, excludeRecurring]
  );

  // All chart, summary and ranked-day values share the selected period and filter.
  const trendMonths = useMemo(() => cashFlowMonths(activeMonth, trendMode), [activeMonth, trendMode]);
  const periodRows = useMemo(() => cashFlowMonthTotals(trendTransactions, trendMonths),
    [trendTransactions, trendMonths]);
  const monthlyTrend = useMemo(() => periodRows.map((row) => ({ ...row,
    label: formatMonthShort(new Date(`${row.prefix}-01T12:00:00`), { locale: lang }),
  })), [periodRows, lang]);
  const trendSummary = useMemo(() => cashFlowSummary(periodRows), [periodRows]);
  const periodLabel = useMemo(() => {
    if (trendMonths.length === 1) return monthLabel;
    const formatter = new Intl.DateTimeFormat(intlLocale, { month: 'short', year: 'numeric' });
    return `${formatter.format(new Date(`${trendMonths[0]}-01T12:00:00`))} – ${formatter.format(new Date(`${activeMonth}-01T12:00:00`))}`;
  }, [trendMonths, monthLabel, intlLocale, activeMonth]);
  const dailyTrend = useMemo(() => {
    const days = cashFlowDays(trendTransactions, activeMonth);
    return { days, hasAnyData: hasCashFlowData(days, trendSeries) };
  }, [trendTransactions, activeMonth, trendSeries]);

  const weekCount = Math.ceil(dailyTrend.days.length / 7);
  const defaultWeekIndex = useMemo(() => {
    const lastActiveDay = dailyTrend.days.reduce((last, day, index) =>
      hasCashFlowData([day], trendSeries) ? index : last, -1);
    return lastActiveDay < 0 ? 0 : Math.floor(lastActiveDay / 7);
  }, [dailyTrend.days, trendSeries]);
  const selectedWeekIndex = mobileWeek.month === activeMonth && mobileWeek.index !== null
    ? Math.min(mobileWeek.index, weekCount - 1) : defaultWeekIndex;
  const visibleDailyDays = useMemo(() => isCompactChart
    ? dailyTrend.days.slice(selectedWeekIndex * 7, (selectedWeekIndex + 1) * 7)
    : dailyTrend.days, [dailyTrend.days, isCompactChart, selectedWeekIndex]);
  const weekStart = visibleDailyDays[0]?.day;
  const weekEnd = visibleDailyDays.at(-1)?.day;
  const highestSpendingDays = useMemo(() => cashFlowTopDays(trendTransactions, trendMonths),
    [trendTransactions, trendMonths]);
  const unusualDays = useMemo(() => unusualSpendingDays(
    transactions, activeMonth, expectedDays, getLocalDateString()
  ).slice(0, 3), [transactions, activeMonth, expectedDays]);

  const openDay = useCallback((date, type = 'expense', dayExcludeRecurring = excludeRecurring) => {
    setSelectedDay({ date, type, excludeRecurring: dayExcludeRecurring });
  }, [setSelectedDay, excludeRecurring]);

  const viewDayHistory = useCallback((date, type, dayExcludeRecurring = excludeRecurring) => {
    setSelectedDay(null);
    const search = new URLSearchParams({ date, type });
    if (dayExcludeRecurring) search.set('excludeRecurring', '1');
    navigate(`/spending/analytics/transactions?${search.toString()}`);
  }, [setSelectedDay, excludeRecurring, navigate]);

  const viewCategoryHistory = useCallback((category, months = [activeMonth]) => {
    const firstMonth = months[0];
    const lastMonth = months.at(-1);
    const [year, month] = lastMonth.split('-').map(Number);
    const lastDay = String(new Date(year, month, 0).getDate()).padStart(2, '0');
    const search = new URLSearchParams({
      from: `${firstMonth}-01`, to: `${lastMonth}-${lastDay}`, type: 'expense', category
    });
    navigate(`/spending/analytics/transactions?${search.toString()}`);
  }, [activeMonth, navigate]);

  const manageTransactionSource = useCallback((source) => {
    setSelectedDay(null);
    navigateTo(source === 'jars' ? 'jars' : 'plan', source === 'jars' ? 'history' : 'recurring');
  }, [setSelectedDay, navigateTo]);

  const recurringFilterSummary = useMemo(() => summarizeRecurringExpenses(transactions, trendMonths),
    [transactions, trendMonths]);

  const saveCashFlowChoice = useCallback(async (patch) => {
    const chart = barChartRef.current;
    chart?.stop();
    if (patch.series) setMobileWeek({ month: null, index: null });
    try {
      await setCashFlowView(patch);
      if (typeof patch.excludeRecurring === 'boolean') {
        const { count, amount } = recurringFilterSummary;
        addToast({ dedupeKey: 'analytics-recurring-filter', type: 'info', duration: 3000,
          message: count === 0 ? t('analytics.recurringEmptyToast')
            : t(patch.excludeRecurring ? 'analytics.recurringExcludedToast' : 'analytics.recurringIncludedToast', {
                count, amount: formatCurrency(amount, { locale: lang }),
              }),
        });
      }
      return true;
    } catch (error) {
      addToast({
        dedupeKey: 'cashflow-preferences', type: 'error', message: getUserErrorMessage(error, 'analytics.cashflow.saveFailed'),
      });
      return isSilentError(error) ? null : false;
    }
  }, [barChartRef, setMobileWeek, setCashFlowView, recurringFilterSummary, addToast, t, lang]);
  const changeCashFlowPeriod = useCallback(async (mode) => {
    const previousDrilldown = drilldown;
    const revision = ++drilldownRevision.current;
    setDrilldown(null);
    const saved = await saveCashFlowChoice({ mode });
    const currentMonth = useSpendingStore.getState().selectedMonth || getLocalMonthString();
    if (saved === false && previousDrilldown && drilldownRevision.current === revision && currentMonth === activeMonth) {
      setDrilldown(previousDrilldown);
    }
  }, [setDrilldown, drilldownRevision, saveCashFlowChoice, drilldown, activeMonth]);
  const changeCashFlowMonth = useCallback((month) => {
    drilldownRevision.current += 1;
    setDrilldown(null);
    setMobileWeek({ month: null, index: null });
    setSelectedMonth(month);
  }, [setDrilldown, setMobileWeek, drilldownRevision, setSelectedMonth]);
  const backToCashFlowPeriod = useCallback(() => {
    if (!drilldown) return;
    drilldownRevision.current += 1;
    setSelectedMonth(drilldown.month);
    setDrilldown(null);
    setMobileWeek({ month: null, index: null });
  }, [setDrilldown, setMobileWeek, drilldownRevision, drilldown, setSelectedMonth]);
  const saveCashFlowDefault = useCallback(async (remove = false) => {
    const revision = drilldownRevision.current;
    try {
      if (remove) {
        await clearDefault();
        const currentMonth = useSpendingStore.getState().selectedMonth || getLocalMonthString();
        if (drilldownRevision.current === revision && currentMonth === activeMonth) {
          if (drilldown) setSelectedMonth(drilldown.month);
          drilldownRevision.current += 1;
          setDrilldown(null);
        }
      }
      else {
        // Pin the visible view independently of remembered deliberate choices.
        await pinDefault({ mode: trendMode });
      }
    } catch (error) {
      addToast({
        dedupeKey: 'cashflow-preferences', type: 'error', message: getUserErrorMessage(error, 'analytics.cashflow.saveFailed'),
      });
    }
  }, [setDrilldown, drilldownRevision, pinDefault, clearDefault, drilldown, trendMode, activeMonth, setSelectedMonth, addToast]);
  const viewCashFlowHistory = useCallback(() => {
    const [year, month] = activeMonth.split('-').map(Number);
    const search = new URLSearchParams({ from: `${trendMonths[0]}-01`,
      to: `${activeMonth}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}` });
    if (trendSeries !== 'both') search.set('type', trendSeries);
    if (excludeRecurring) search.set('excludeRecurring', '1');
    navigate(`/spending/analytics/transactions?${search.toString()}`);
  }, [activeMonth, trendMonths, trendSeries, excludeRecurring, navigate]);

  const hasTrendData = useMemo(() => hasCashFlowData(
    trendMode === 'daily' ? visibleDailyDays : monthlyTrend, trendSeries),
  [trendMode, visibleDailyDays, monthlyTrend, trendSeries]);
  return { backToCashFlowPeriod, changeCashFlowMonth, changeCashFlowPeriod, dailyTrend, hasTrendData, highestSpendingDays, manageTransactionSource, monthlyTrend, openDay, periodLabel, saveCashFlowChoice, saveCashFlowDefault, selectedWeekIndex, trendSummary, unusualDays, viewCashFlowHistory, viewCategoryHistory, viewDayHistory, visibleDailyDays, weekCount, weekEnd, weekStart };
}
