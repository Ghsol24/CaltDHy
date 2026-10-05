import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Filler
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { useNavigate } from 'react-router';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useToastStore } from '../../stores/useToastStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { formatCompactCurrency, formatCurrency, formatDate, formatDateTime, formatMonthShort, formatPercent, getLocalDateString, getLocalMonthString } from '../../utils/formatters';
import { getCategoryIcon } from '../../utils/categories';
import { getBudgetStatus } from '../../utils/financeMath';
import { filterTrendTransactions, summarizeRecurringExpenses } from '../../utils/analyticsFilters';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useSectionScrollSpy } from '../../hooks/useSectionScrollSpy';
import { useTranslation } from '../../i18n/useTranslation';
import { translateLegacyText } from '../../i18n/legacyTranslations';
import { spendingService } from '../../services/spendingService';
import { unusualSpendingDays } from '../../utils/transactionInsights';
import { csvRow } from '../../utils/csv';
import { DailyTransactionsDrawer } from './DailyTransactionsDrawer';
import { CashFlowPanel } from './CashFlowPanel';
import { cashFlowChartContext } from './cashFlowChartContext';
import { useCashFlowPreferences } from '../../hooks/useCashFlowPreferences';
import { cashFlowDays, cashFlowMonths, cashFlowMonthTotals, cashFlowSummary,
  cashFlowTopDays, cashFlowSeriesTypes, hasCashFlowData } from '../../utils/cashFlowData';
import {
  CategoryOutlineIcon,
  ChartOutlineIcon,
  ClipboardOutlineIcon,
  BulbOutlineIcon,
  StarOutlineIcon,
  AlertTriangleOutlineIcon,
  InfoOutlineIcon,
  CheckOutlineIcon,
  ZapOutlineIcon
} from '../../utils/categoryIcons';

// Register Chart.js components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Filler
);

const CATEGORY_COLORS = [
  '#008B57', // Mint Brand
  '#2563EB', // Royal Blue
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#10B981', // Sea Green
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#64748B'  // Slate
];

const ANALYTICS_SCROLL_SECTIONS = Object.freeze([
  ['analytics-overview', 'overview'],
  ['analytics-spending', 'spending'],
  ['analytics-cashflow', 'cash-flow'],
  ['analytics-reports', 'reports'],
]);

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setPrefersReducedMotion(media.matches);
    media.addEventListener?.('change', syncPreference);
    return () => media.removeEventListener?.('change', syncPreference);
  }, []);

  return prefersReducedMotion;
}

export function AnalyticsView() {
  const { t, label, lang, intlLocale } = useTranslation();
  const transactions = useTransactionStore((s) => s.transactions);
  const budgets = useTransactionStore((s) => s.budgets);
  const financialResetVersion = useTransactionStore((s) => s.financialResetVersion);
  const openEditTransaction = useTransactionStore((s) => s.openEditTransaction);
  const selectedMonth = useSpendingStore((s) => s.selectedMonth);
  const setSelectedMonth = useSpendingStore((s) => s.setSelectedMonth);
  const openAddTxnModal = useSpendingStore((s) => s.openAddTxnModal);
  const analyticsSubTab = useSpendingStore((s) => s.analyticsSubTab);
  const setAnalyticsSubTab = useSpendingStore((s) => s.setAnalyticsSubTab);
  const navigateTo = useSpendingStore((s) => s.navigateTo);
  const addToast = useToastStore((s) => s.addToast);
  const theme = useThemeStore((s) => s.theme);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile(900);
  const isCompactChart = useIsMobile(599);
  const navigate = useNavigate();

  const cashFlowActive = !isMobile || analyticsSubTab === 'cash-flow';
  const { view: cashFlowView, setView: setCashFlowView, pinnedDefault,
    pinDefault, clearDefault, saving: savingCashFlowPreferences } = useCashFlowPreferences({ active: cashFlowActive });
  const [drilldown, setDrilldown] = useState(null);
  const drilldownRevision = useRef(0);
  const trendMode = drilldown ? 'daily' : cashFlowView.mode;
  const trendSeries = cashFlowView.series;
  const excludeRecurring = cashFlowView.excludeRecurring;
  const [mobileWeek, setMobileWeek] = useState({ month: null, index: null });
  const [reportPeriodType, setReportPeriodType] = useState('monthly'); // 'monthly' | 'quarterly'
  const [selectedDay, setSelectedDay] = useState(null);
  const [expectedDays, setExpectedDays] = useState([]);
  const [savingExpectedDay, setSavingExpectedDay] = useState('');
  const barChartRef = useRef(null);

  // Current active month in 'YYYY-MM' format
  const activeMonth = selectedMonth || getLocalMonthString();

  useEffect(() => {
    if (!cashFlowActive) {
      drilldownRevision.current += 1;
      setDrilldown(null);
    }
  }, [cashFlowActive]);

  useEffect(() => { setSelectedDay(null); }, [activeMonth]);

  useEffect(() => {
    let active = true;
    setExpectedDays([]);
    spendingService.getExpectedDays(activeMonth).then((result) => {
      if (active) setExpectedDays(Array.isArray(result.data) ? result.data : []);
    }).catch((error) => {
      if (active && error.code !== 'SESSION_CHANGED') addToast({ type: 'error', message: t('analytics.unusualLoadFailed') });
    });
    return () => { active = false; };
  }, [activeMonth, financialResetVersion, addToast, t]);

  const toggleExpectedDay = useCallback(async (date, expected) => {
    setSavingExpectedDay(date);
    try {
      await spendingService.setExpectedDay(date, expected);
      setExpectedDays((days) => expected ? [...new Set([...days, date])] : days.filter((day) => day !== date));
    } catch (error) {
      if (error.code !== 'SESSION_CHANGED') addToast({ type: 'error', message: t('analytics.unusualSaveFailed') });
    } finally {
      setSavingExpectedDay('');
    }
  }, [addToast, t]);

  // Month & Quarter navigation helpers
  const {
    currentMonthNum,
    monthLabel,
    prevMonthStr,
    nextMonthStr,
    isCurrentMonth,
    quarterLabel,
    prevQuarterLabel,
    curQuarterMonths,
    prevQuarterMonths
  } = useMemo(() => {
    const [yStr, mStr] = activeMonth.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10); // 1-12

    const prevDate = new Date(year, month - 2, 1);
    const prevYear = prevDate.getFullYear();
    const prevM = String(prevDate.getMonth() + 1).padStart(2, '0');

    const nextDate = new Date(year, month, 1);
    const nextYear = nextDate.getFullYear();
    const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');

    const nowMonthStr = getLocalMonthString();

    // Quarter calculations
    const cQuarter = Math.ceil(month / 3);
    const pQuarter = cQuarter === 1 ? 4 : cQuarter - 1;
    const pQuarterYear = cQuarter === 1 ? year - 1 : year;

    const curQMonths = [1, 2, 3].map((i) => `${year}-${String((cQuarter - 1) * 3 + i).padStart(2, '0')}`);
    const prevQMonths = [1, 2, 3].map((i) => `${pQuarterYear}-${String((pQuarter - 1) * 3 + i).padStart(2, '0')}`);

    return {
      currentYear: year,
      currentMonthNum: month,
      monthLabel: formatDate(`${activeMonth}-01`, 'month', { locale: lang }),
      prevMonthStr: `${prevYear}-${prevM}`,
      nextMonthStr: `${nextYear}-${nextM}`,
      isCurrentMonth: activeMonth === nowMonthStr,
      currentQuarter: cQuarter,
      prevQuarter: pQuarter,
      prevQuarterYear: pQuarterYear,
      quarterLabel: t('date.quarterRange', { quarter: cQuarter, year, start: (cQuarter - 1) * 3 + 1, end: cQuarter * 3 }),
      prevQuarterLabel: t('date.quarterRange', { quarter: pQuarter, year: pQuarterYear, start: (pQuarter - 1) * 3 + 1, end: pQuarter * 3 }),
      curQuarterMonths: curQMonths,
      prevQuarterMonths: prevQMonths
    };
  }, [activeMonth, lang, t]);

  const handlePrevMonth = () => changeCashFlowMonth(prevMonthStr);
  const handleNextMonth = () => changeCashFlowMonth(nextMonthStr);
  const handleSetThisMonth = () => {
    changeCashFlowMonth(getLocalMonthString());
  };
  const handleSetLastMonth = () => {
    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    changeCashFlowMonth(getLocalMonthString(lastMonthDate));
  };

  // 1. Current Month Stats & Breakdown
  const monthData = useMemo(() => {
    const filtered = transactions.filter((t) => t.date && t.date.startsWith(activeMonth));
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    const catMap = Object.create(null);

    filtered.forEach((t) => {
      const amt = Number(t.amount) || 0;
      const fee = Number(t.fee) || 0;

      if (t.type === 'income') {
        income += amt;
        incomeCount += 1;
      } else if (t.type === 'expense') {
        const total = amt + fee;
        expense += total;
        expenseCount += 1;
        const cat = t.category || 'Khác';
        catMap[cat] = (catMap[cat] || 0) + total;
      }
    });

    const net = income - expense;
    const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

    const categories = Object.entries(catMap)
      .map(([name, amount], idx) => ({
        name,
        amount,
        percent: expense > 0 ? (amount / expense) * 100 : 0,
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
        icon: getCategoryIcon(name, 'expense')
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      income,
      expense,
      net,
      savingsRate,
      incomeCount,
      expenseCount,
      totalCount: filtered.length,
      categories
    };
  }, [transactions, activeMonth]);

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
  }, [excludeRecurring]);

  const viewDayHistory = useCallback((date, type, dayExcludeRecurring = excludeRecurring) => {
    setSelectedDay(null);
    const search = new URLSearchParams({ date, type });
    if (dayExcludeRecurring) search.set('excludeRecurring', '1');
    navigate(`/spending/analytics/transactions?${search.toString()}`);
  }, [excludeRecurring, navigate]);

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
  }, [navigateTo]);

  const recurringFilterSummary = useMemo(() => summarizeRecurringExpenses(transactions, trendMonths),
    [transactions, trendMonths]);

  const saveCashFlowChoice = useCallback(async (patch) => {
    barChartRef.current?.stop();
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
      if (error.code !== 'SESSION_CHANGED') addToast({
        dedupeKey: 'cashflow-preferences', type: 'error', message: t('analytics.cashflow.saveFailed'),
      });
      return error.code === 'SESSION_CHANGED' ? null : false;
    }
  }, [setCashFlowView, recurringFilterSummary, addToast, t, lang]);
  const changeCashFlowPeriod = useCallback(async (mode) => {
    const previousDrilldown = drilldown;
    const revision = ++drilldownRevision.current;
    setDrilldown(null);
    const saved = await saveCashFlowChoice({ mode });
    const currentMonth = useSpendingStore.getState().selectedMonth || getLocalMonthString();
    if (saved === false && previousDrilldown && drilldownRevision.current === revision && currentMonth === activeMonth) {
      setDrilldown(previousDrilldown);
    }
  }, [saveCashFlowChoice, drilldown, activeMonth]);
  const changeCashFlowMonth = useCallback((month) => {
    drilldownRevision.current += 1;
    setDrilldown(null);
    setMobileWeek({ month: null, index: null });
    setSelectedMonth(month);
  }, [setSelectedMonth]);
  const backToCashFlowPeriod = useCallback(() => {
    if (!drilldown) return;
    drilldownRevision.current += 1;
    setSelectedMonth(drilldown.month);
    setDrilldown(null);
    setMobileWeek({ month: null, index: null });
  }, [drilldown, setSelectedMonth]);
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
      if (error.code !== 'SESSION_CHANGED') addToast({
        dedupeKey: 'cashflow-preferences', type: 'error', message: t('analytics.cashflow.saveFailed'),
      });
    }
  }, [pinDefault, clearDefault, drilldown, trendMode, activeMonth, setSelectedMonth, addToast, t]);
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

  // Resolve semantic tokens for canvas, which cannot interpret CSS variables.
  const chartThemeTokens = useMemo(() => {
    const styles = getComputedStyle(document.documentElement);
    const read = (name) => styles.getPropertyValue(name).trim();
    return {
      theme,
      income: read('--color-success'), expense: read('--color-danger'),
      tick: read('--color-text-muted'), grid: read('--color-border'),
      tooltipBg: read('--color-surface'), text: read('--color-text'),
      sliceBorder: read('--color-surface'), future: read('--color-surface-muted'),
    };
  }, [theme]);

  // Doughnut Chart Configuration
  const doughnutChartData = useMemo(() => {
    if (monthData.categories.length === 0) return null;

    return {
      labels: monthData.categories.map((c) => label(c.name)),
      datasets: [
        {
          data: monthData.categories.map((c) => c.amount),
          backgroundColor: monthData.categories.map((c) => c.color),
          borderColor: chartThemeTokens.sliceBorder,
          borderWidth: 2,
          hoverOffset: 6
        }
      ]
    };
  }, [monthData.categories, chartThemeTokens, label]);

  const doughnutOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_event, elements) => {
        const category = monthData.categories[elements[0]?.index];
        if (category) viewCategoryHistory(category.name);
      },
      onHover: (_event, elements, chart) => {
        chart.canvas.style.cursor = elements.length ? 'pointer' : 'default';
      },
      animation: prefersReducedMotion ? false : {
        duration: 850,
        easing: 'easeOutQuart'
      },
      resizeDelay: 150,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: chartThemeTokens.tooltipBg,
          titleColor: chartThemeTokens.text,
          bodyColor: chartThemeTokens.text,
          titleFont: { family: 'Inter, sans-serif', size: 12, weight: '600' },
          bodyFont: { family: 'Inter, sans-serif', size: 13, weight: 'bold' },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const val = context.parsed || 0;
              const pct = monthData.expense > 0 ? Math.round((val / monthData.expense) * 100) : 0;
              return ` ${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      }
    };
  }, [monthData.expense, monthData.categories, chartThemeTokens, prefersReducedMotion, viewCategoryHistory]);

  const chartRows = trendMode === 'daily' ? visibleDailyDays : monthlyTrend;
  const barChartData = useMemo(() => ({
    labels: chartRows.map((row) => row.label),
    datasets: cashFlowSeriesTypes(trendSeries).map((type) => ({
      cashFlowType: type,
      label: t(`type.${type}`),
      data: chartRows.map((row) => row[type]),
      backgroundColor: chartThemeTokens[type],
      borderRadius: trendMode === 'daily' ? 4 : 6,
      barPercentage: trendMode === 'daily' ? 0.7 : 0.65,
      categoryPercentage: trendMode === 'daily' ? 0.8 : 0.65,
    })),
  }), [chartRows, trendSeries, trendMode, chartThemeTokens, t]);

  const today = getLocalDateString();
  const chartContextRef = useRef(null);
  chartContextRef.current = {
    mode: trendMode, days: visibleDailyDays, months: monthlyTrend, today,
    colors: chartThemeTokens, futureLabel: t('analytics.cashflow.futureDays'),
    ongoingLabel: t('analytics.cashflow.ongoing'),
  };
  // react-chartjs-2 registers plugins only when creating a chart, so keep the
  // plugin stable and read the latest period, theme and labels for every draw.
  const chartContext = useMemo(() => cashFlowChartContext(() => chartContextRef.current), []);
  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: trendMode === 'daily' ? 0 : 26 } },
    onClick: (_event, elements) => {
      if (!elements.length) return;
      const { index, datasetIndex } = elements[0];
      if (trendMode === 'daily') {
        const day = visibleDailyDays[index];
        if (day) openDay(day.date, barChartData.datasets[datasetIndex].cashFlowType);
      } else {
        const month = monthlyTrend[index];
        if (month) {
          drilldownRevision.current += 1;
          setDrilldown({ month: activeMonth, mode: trendMode });
          setMobileWeek({ month: null, index: null });
          setSelectedMonth(month.prefix);
        }
      }
    },
    onHover: (_event, elements, chart) => {
      chart.canvas.style.cursor = elements.length ? 'pointer' : 'default';
    },
    animation: prefersReducedMotion ? false : { duration: 250, easing: 'easeOutQuart' },
    resizeDelay: 150,
    interaction: isCompactChart ? { mode: 'nearest', intersect: false, axis: 'x' } : undefined,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: chartThemeTokens.tooltipBg,
        titleColor: chartThemeTokens.text,
        bodyColor: chartThemeTokens.text,
        borderColor: chartThemeTokens.grid,
        borderWidth: 1,
        titleFont: { family: 'Inter, sans-serif', size: 12, weight: '600' },
        bodyFont: { family: 'Inter, sans-serif', size: 12 },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          title: (items) => {
            if (!items.length) return '';
            const row = chartRows[items[0].dataIndex];
            if (trendMode === 'daily') return formatDate(row.date, 'compact', { locale: lang });
            const label = formatDate(`${row.prefix}-01`, 'month', { locale: lang });
            return row.prefix === today.slice(0, 7)
              ? `${label} · ${t('analytics.cashflow.ongoing')}` : label;
          },
          label: (context) => ` ${context.dataset.label}: ${formatCurrency(context.parsed.y || 0)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: {
        color: chartThemeTokens.tick, font: { family: 'Inter, sans-serif', size: 12 },
        minRotation: 0, maxRotation: 0,
        maxTicksLimit: isCompactChart ? 7 : 11,
        autoSkip: !(isCompactChart && trendMode === 'daily'),
      } },
      y: { min: 0, grid: { color: chartThemeTokens.grid }, ticks: {
        color: chartThemeTokens.tick, font: { family: 'Inter, sans-serif', size: 11 },
        maxTicksLimit: 6, callback: (value) => formatCompactCurrency(value),
      } },
    },
  }), [trendMode, visibleDailyDays, monthlyTrend, chartRows, barChartData, activeMonth,
    chartThemeTokens, prefersReducedMotion, isCompactChart, openDay, setSelectedMonth, today, t, lang]);

  // ── Financial Report Statistics & Comparison ──
  const reportData = useMemo(() => {
    const isQuarter = reportPeriodType === 'quarterly';
    const curLabel = isQuarter ? quarterLabel : monthLabel;
    const prevLabel = isQuarter ? prevQuarterLabel : formatDate(`${prevMonthStr}-01`, 'month', { locale: lang });

    const matchesCurrent = (txDate) => {
      if (!txDate) return false;
      if (isQuarter) {
        return curQuarterMonths.some((m) => txDate.startsWith(m));
      }
      return txDate.startsWith(activeMonth);
    };

    const matchesPrevious = (txDate) => {
      if (!txDate) return false;
      if (isQuarter) {
        return prevQuarterMonths.some((m) => txDate.startsWith(m));
      }
      return txDate.startsWith(prevMonthStr);
    };

    const curTxns = transactions.filter((t) => matchesCurrent(t.date || t.createdAt));
    const prevTxns = transactions.filter((t) => matchesPrevious(t.date || t.createdAt));

    const calcStats = (txList) => {
      let income = 0;
      let expense = 0;
      let incomeCount = 0;
      let expenseCount = 0;
      const catMap = Object.create(null);

      txList.forEach((t) => {
        const amt = Number(t.amount) || 0;
        const fee = Number(t.fee) || 0;
        if (t.type === 'income') {
          income += amt;
          incomeCount += 1;
        } else if (t.type === 'expense') {
          const total = amt + fee;
          expense += total;
          expenseCount += 1;
          const cat = t.category || 'Khác';
          if (!catMap[cat]) {
            catMap[cat] = { amount: 0, count: 0 };
          }
          catMap[cat].amount += total;
          catMap[cat].count += 1;
        }
      });

      const net = income - expense;
      const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;
      return { income, expense, incomeCount, expenseCount, net, savingsRate, catMap };
    };

    const curStats = calcStats(curTxns);
    const prevStats = calcStats(prevTxns);

    const incomeDelta = curStats.income - prevStats.income;
    const incomeDeltaPct = prevStats.income > 0 
      ? ((curStats.income - prevStats.income) / prevStats.income) * 100 
      : (curStats.income > 0 ? 100 : 0);

    const expenseDelta = curStats.expense - prevStats.expense;
    const expenseDeltaPct = prevStats.expense > 0 
      ? ((curStats.expense - prevStats.expense) / prevStats.expense) * 100 
      : (curStats.expense > 0 ? 100 : 0);

    const netDelta = curStats.net - prevStats.net;
    const savingsRateDelta = curStats.savingsRate - prevStats.savingsRate;

    const allCatNamesSet = new Set([
      ...Object.keys(curStats.catMap),
      ...Object.keys(prevStats.catMap),
      ...Object.keys(budgets || {})
    ]);

    const multiplier = isQuarter ? 3 : 1;

    const categoryRows = Array.from(allCatNamesSet).map((catName) => {
      const curCat = curStats.catMap[catName] || { amount: 0, count: 0 };
      const prevCat = prevStats.catMap[catName] || { amount: 0, count: 0 };

      const spentCur = curCat.amount;
      const countCur = curCat.count;
      const spentPrev = prevCat.amount;
      const countPrev = prevCat.count;

      const isNewInPeriod = spentPrev === 0 && spentCur > 0;
      const isEliminated = spentCur === 0 && spentPrev > 0;
      const deltaAmt = spentCur - spentPrev;
      const deltaPct = spentPrev > 0 
        ? ((spentCur - spentPrev) / spentPrev) * 100 
        : 0;

      const pctOfTotal = curStats.expense > 0 ? (spentCur / curStats.expense) * 100 : 0;

      const rawLimit = budgets && budgets[catName] !== undefined ? Number(budgets[catName]) : null;
      const limit = rawLimit && rawLimit > 0 ? rawLimit * multiplier : null;
      const budgetStatus = getBudgetStatus(spentCur, limit || 0);

      // Evaluate delta badge status accurately (never show false alarms)
      let deltaBadgeType = 'neutral'; // 'good' | 'bad' | 'warn' | 'new' | 'neutral'
      let deltaBadgeText = '';

      if (spentCur === 0 && spentPrev === 0) {
        deltaBadgeType = 'neutral';
        deltaBadgeText = formatCurrency(0);
      } else if (isNewInPeriod) {
        if (limit && budgetStatus.isOver) {
          deltaBadgeType = 'bad';
          deltaBadgeText = 'Mới (Vượt trần)';
        } else if (limit && (budgetStatus.status === 'warning' || budgetStatus.percent >= 100)) {
          deltaBadgeType = 'warn';
          deltaBadgeText = 'Mới (Cận trần)';
        } else {
          deltaBadgeType = 'new';
          deltaBadgeText = 'Mới trong kỳ';
        }
      } else if (isEliminated) {
        deltaBadgeType = 'good';
        deltaBadgeText = '↓ -100%';
      } else if (deltaAmt < 0) {
        deltaBadgeType = 'good';
        deltaBadgeText = `↓ -${formatPercent(Math.abs(deltaPct), { fractionDigits: 1 })}`;
      } else if (deltaAmt === 0 || Math.abs(deltaPct) < 0.5) {
        deltaBadgeType = 'neutral';
        deltaBadgeText = `~ ${formatPercent(0, { fractionDigits: 1 })}`;
      } else {
        // deltaAmt > 0 (Chi tiêu tăng so với kỳ trước)
        if (limit && budgetStatus.isOver) {
          deltaBadgeType = 'bad';
          deltaBadgeText = `↑ +${formatPercent(deltaPct, { fractionDigits: 1 })}`;
        } else if (limit && (budgetStatus.status === 'warning' || budgetStatus.percent >= 100)) {
          deltaBadgeType = 'warn';
          deltaBadgeText = `↑ +${formatPercent(deltaPct, { fractionDigits: 1 })}`;
        } else if (limit && spentCur <= limit * 0.75) {
          // Tăng nhưng an toàn dưới 75% hạn mức
          if (deltaPct > 30) {
            deltaBadgeType = 'warn';
          } else {
            deltaBadgeType = 'neutral';
          }
          deltaBadgeText = `↑ +${formatPercent(deltaPct, { fractionDigits: 1 })}`;
        } else {
          // Chưa đặt hạn mức
          if (deltaPct > 50) {
            deltaBadgeType = 'bad';
          } else if (deltaPct > 20) {
            deltaBadgeType = 'warn';
          } else {
            deltaBadgeType = 'neutral';
          }
          deltaBadgeText = `↑ +${formatPercent(deltaPct, { fractionDigits: 1 })}`;
        }
      }

      let adviceText = '';
      let adviceType = 'neutral';

      if (spentCur === 0 && spentPrev === 0) {
        adviceText = 'Không phát sinh chi tiêu trong kỳ';
        adviceType = 'neutral';
      } else if (spentCur === 0 && spentPrev > 0) {
        adviceText = 'Không phát sinh chi tiêu (tiết kiệm 100% so với kỳ trước)';
        adviceType = 'good';
      } else if (limit && budgetStatus.isOver) {
        const overPct = budgetStatus.percent - 100;
        adviceText = `Vượt ${formatPercent(overPct)} ngân sách! Cần thắt chặt chi tiêu`;
        adviceType = 'danger';
      } else if (limit && budgetStatus.percent === 100) {
        adviceText = `Đã chạm 100% hạn mức trần! Hạn chế phát sinh thêm chi phí`;
        adviceType = 'warning';
      } else if (limit && budgetStatus.status === 'warning') {
        adviceText = `Đã chạm ${budgetStatus.percent}% hạn mức, còn ${formatCurrency(budgetStatus.remaining)}`;
        adviceType = 'warning';
      } else if (limit && spentCur < limit * 0.75 && deltaAmt < 0) {
        adviceText = `Tiết kiệm tốt (giảm ${formatPercent(Math.abs(deltaPct))}), an toàn dưới ngân sách`;
        adviceType = 'good';
      } else if (limit && spentCur < limit * 0.75) {
        adviceText = `Kiểm soát tốt dưới hạn mức ngân sách (${budgetStatus.percent}%)`;
        adviceType = 'good';
      } else if (!limit && deltaAmt < 0) {
        adviceText = `Chi tiêu giảm ${formatPercent(Math.abs(deltaPct))} so với kỳ trước`;
        adviceType = 'good';
      } else if (!limit && deltaPct > 30) {
        adviceText = `Tăng ${formatPercent(deltaPct)} so với kỳ trước, nên thiết lập hạn mức`;
        adviceType = 'warning';
      } else {
        adviceText = 'Nên đặt hạn mức ngân sách để kiểm soát dòng tiền tốt hơn';
        adviceType = 'neutral';
      }

      return {
        name: catName,
        icon: getCategoryIcon(catName, 'expense'),
        spentCur,
        spentPrev,
        countCur,
        countPrev,
        deltaAmt,
        deltaPct,
        isNewInPeriod,
        isEliminated,
        deltaBadgeType,
        deltaBadgeText,
        pctOfTotal,
        limit,
        budgetStatus,
        adviceText,
        adviceType
      };
    })
    .filter((row) => row.spentCur > 0 || row.spentPrev > 0 || (row.limit && row.limit > 0))
    .sort((a, b) => b.spentCur - a.spentCur);

    // Smart overall insights list
    const insights = [];
    const overList = categoryRows.filter((r) => r.limit && r.budgetStatus.isOver);
    const warnList = categoryRows.filter((r) => r.limit && r.budgetStatus.status === 'warning');
    const hasCurrentData = curTxns.length > 0;

    if (!hasCurrentData) {
      insights.push({
        type: 'info',
        text: 'Chưa đủ dữ liệu trong kỳ này để đưa ra nhận định tài chính. Hãy ghi nhận giao dịch trước khi đánh giá xu hướng.'
      });
    } else if (curStats.net > 0 && curStats.savingsRate >= 20) {
      insights.push({
        type: 'accolade',
        text: `Quản lý tài chính xuất sắc! Dòng tiền thặng dư ${formatCurrency(curStats.net)} và bạn đã tiết kiệm được ${formatPercent(curStats.savingsRate)} tổng thu nhập trong kỳ này.`
      });
    } else if (curStats.net > 0) {
      insights.push({
        type: 'accolade',
        text: `Dòng tiền dương thặng dư ${formatCurrency(curStats.net)}. Thu nhập đang kiểm soát tốt hơn tổng chi tiêu.`
      });
    } else if (curStats.net < 0) {
      insights.push({
        type: 'warning',
        text: `Dòng tiền đang thâm hụt ${formatCurrency(Math.abs(curStats.net))}. Chi tiêu vượt tổng thu nhập trong kỳ, cần hạn chế các khoản chi không cấp thiết.`
      });
    }

    if (overList.length > 0) {
      insights.push({
        type: 'warning',
        text: `Cảnh báo vượt ngân sách: Có ${overList.length} nhóm chi phí đã vượt hạn mức (${overList.map(o => o.name).join(', ')}). Hãy rà soát lại các khoản chi lớn.`
      });
    } else if (warnList.length > 0) {
      insights.push({
        type: 'info',
        text: `Có ${warnList.length} nhóm chi phí đang tiệm cận trần ngân sách (${warnList.map(w => w.name).join(', ')}). Chú ý thắt chặt trong các ngày còn lại.`
      });
    } else if (hasCurrentData && curStats.expense > 0 && categoryRows.some(r => r.limit)) {
      insights.push({
        type: 'accolade',
        text: `Tất cả các nhóm có thiết lập ngân sách đều nằm trong vùng kiểm soát an toàn! Tiếp tục phát huy kỷ luật tài chính.`
      });
    }

    if (hasCurrentData && curStats.expense < prevStats.expense && prevStats.expense > 0) {
      insights.push({
        type: 'accolade',
        text: `Tổng chi tiêu giảm ${formatCurrency(prevStats.expense - curStats.expense)} (${formatPercent(Math.abs(expenseDeltaPct))}) so với kỳ trước. Bạn đang tối ưu ngân sách rất hiệu quả!`
      });
    }

    return {
      isQuarter,
      curLabel,
      prevLabel,
      curStats,
      prevStats,
      curTxns,
      incomeDelta,
      incomeDeltaPct,
      expenseDelta,
      expenseDeltaPct,
      netDelta,
      savingsRateDelta,
      categoryRows,
      insights
    };
  }, [reportPeriodType, quarterLabel, prevQuarterLabel, monthLabel, prevMonthStr, activeMonth, curQuarterMonths, prevQuarterMonths, transactions, budgets, lang]);

  // Handle CSV Export with UTF-8 BOM
  const handleExportCSV = () => {
    const { curLabel, prevLabel, curStats, prevStats, categoryRows, curTxns, incomeDelta, incomeDeltaPct, expenseDelta, expenseDeltaPct, netDelta, savingsRateDelta } = reportData;
    
    let csv = '\uFEFF'; // UTF-8 BOM for Excel Vietnamese compatibility
    csv += `${t('analytics.csvTitle')}\n`;
    csv += `${t('analytics.csvPeriod')}:,"${translateLegacyText(lang, curLabel)}"\n`;
    csv += `${t('analytics.csvComparison')}:,"${translateLegacyText(lang, prevLabel)}"\n`;
    csv += `${t('analytics.csvExportedAt')}:,"${formatDateTime(new Date())}"\n\n`;

    // 1. Chỉ số tài chính
    csv += `${t('analytics.csvSummary')}\n`;
    csv += `${t('analytics.csvSummaryHeaders')}\n`;
    csv += `${t('analytics.totalIncome')},"${curStats.income}","${prevStats.income}","${incomeDelta}","${incomeDeltaPct.toFixed(1)}%"\n`;
    csv += `${t('analytics.totalExpense')},"${curStats.expense}","${prevStats.expense}","${expenseDelta}","${expenseDeltaPct.toFixed(1)}%"\n`;
    csv += `${t('analytics.net')},"${curStats.net}","${prevStats.net}","${netDelta}",""\n`;
    csv += `${t('analytics.savingsRate')},"${curStats.savingsRate.toFixed(1)}%","${prevStats.savingsRate.toFixed(1)}%","${savingsRateDelta.toFixed(1)}%",""\n\n`;

    // 2. Phân tích chi tiết danh mục
    csv += `${t('analytics.csvCategorySection')}\n`;
    csv += `${t('analytics.csvCategoryHeaders')}\n`;
    categoryRows.forEach((r) => {
      const statusText = r.limit 
        ? t(r.budgetStatus.isOver ? 'analytics.overBudget' : r.budgetStatus.status === 'warning' ? 'analytics.warningBudget' : 'analytics.safeBudget', { percent: r.budgetStatus.percent })
        : t('transaction.limitUnset');
      const advice = translateLegacyText(lang, r.adviceText);
      csv += csvRow([label(r.name), r.spentCur, r.spentPrev, r.deltaAmt,
        `${r.deltaPct.toFixed(1)}%`, `${r.pctOfTotal.toFixed(1)}%`, r.countCur,
        r.limit || 0, statusText, advice]);
    });
    csv += '\n';

    // 3. Danh sách giao dịch trong kỳ
    csv += `${t('analytics.csvTransactions')}\n`;
    csv += `${t('analytics.csvTransactionHeaders')}\n`;
    curTxns.forEach((tx) => {
      csv += csvRow([tx.date || '', t(`type.${tx.type === 'income' ? 'income' : 'expense'}`),
        label(tx.category || ''), tx.amount || 0, tx.fee || 0, tx.note || '']);
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanPeriod = curLabel.replace(/[\s,/()]/g, '_');
    a.download = `Bao_Cao_Tai_Chinh_CaltDHy_${cleanPeriod}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle Print
  const handlePrint = () => {
    window.print();
  };

  const handleActiveAnalyticsSection = useCallback((activeTab) => {
    const currentTab = useSpendingStore.getState().analyticsSubTab;
    // A queued scroll/layout callback may run while the history chunk loads.
    if (currentTab === 'transactions' || window.location.pathname.endsWith('/transactions')) return;
    if (activeTab && currentTab !== activeTab) {
      setAnalyticsSubTab(activeTab, { syncRoute: false });
    }
  }, [setAnalyticsSubTab]);

  useSectionScrollSpy({
    disabled: isMobile || analyticsSubTab === 'transactions',
    sections: ANALYTICS_SCROLL_SECTIONS,
    onActiveChange: handleActiveAnalyticsSection,
  });

  return (
    <div className="analytics-feature-view" role="region" aria-label="Báo cáo phân tích thu chi">
      {(!isMobile || analyticsSubTab === 'overview') && (
        <>
      {/* ── 1. Page Header & Comparison Segmented / Month Selector ── */}
      <div className="analytics-header-bar" id="analytics-overview">
        <div className="analytics-title-group">
          <h2 className="analytics-view-title">Phân tích tài chính</h2>
          <p className="analytics-view-subtitle">
            Nhìn rõ dòng tiền theo thời gian
          </p>
        </div>

        <div className="analytics-header-controls">
          {/* Segmented Comparison: Tháng này | Tháng trước */}
          <div className="analytics-segmented-switch" role="tablist" aria-label="Khoảng thời gian so sánh">
            <button
              type="button"
              role="tab"
              aria-selected={isCurrentMonth}
              className={`analytics-segment-btn ${isCurrentMonth ? 'active' : ''}`}
              onClick={handleSetThisMonth}
            >
              Tháng này
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isCurrentMonth}
              className={`analytics-segment-btn ${!isCurrentMonth ? 'active' : ''}`}
              onClick={handleSetLastMonth}
            >
              Tháng trước
            </button>
          </div>

          {/* Month Stepper Control */}
          <div className="analytics-month-stepper" role="group" aria-label="Chuyển tháng">
            <button
              type="button"
              className="month-nav-btn"
              onClick={handlePrevMonth}
              title="Tháng trước"
              aria-label="Xem tháng trước"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <span className="month-current-display" aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              <span>{monthLabel}</span>
            </span>

            <button
              type="button"
              className="month-nav-btn"
              onClick={handleNextMonth}
              title="Tháng sau"
              aria-label="Xem tháng sau"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. 4 KPI Grid Cards ── */}
      <div className="analytics-kpi-grid">
        {/* Card 1: Tổng thu nhập */}
        <div className="analytics-kpi-card card-income">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Tổng thu nhập</span>
            <div className="kpi-icon-badge badge-income" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
          </div>
          <div className="kpi-card-amount text-success">
            {formatCurrency(monthData.income)}
          </div>
          <div className="kpi-card-meta">
            <span>{monthData.incomeCount} giao dịch thu nhập</span>
          </div>
        </div>

        {/* Card 2: Tổng chi tiêu */}
        <div className="analytics-kpi-card card-expense">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Tổng chi tiêu</span>
            <div className="kpi-icon-badge badge-expense" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
                <polyline points="16 17 22 17 22 11" />
              </svg>
            </div>
          </div>
          <div className={`kpi-card-amount ${monthData.expense > 0 ? 'text-danger' : 'text-muted'}`}>
            {formatCurrency(monthData.expense)}
          </div>
          <div className="kpi-card-meta">
            <span>{monthData.expenseCount} giao dịch chi tiêu</span>
          </div>
        </div>

        {/* Card 3: Dòng tiền thuần (Net) */}
        <div className="analytics-kpi-card card-net">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Dòng tiền thuần (Net)</span>
            <div className="kpi-icon-badge badge-net" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" x2="12" y1="20" y2="4" />
                <line x1="6" x2="18" y1="4" y2="4" />
                <line x1="6" x2="18" y1="20" y2="20" />
              </svg>
            </div>
          </div>
          <div className={`kpi-card-amount ${monthData.net > 0 ? 'text-success' : (monthData.net < 0 ? 'text-danger' : 'text-muted')}`}>
            {formatCurrency(monthData.net)}
          </div>
          <div className="kpi-card-meta">
            <span className={`kpi-status-pill ${monthData.net > 0 ? 'pill-positive' : (monthData.net < 0 ? 'pill-danger' : 'pill-neutral')}`}>
              {monthData.net > 0 ? 'Thặng dư dòng tiền' : (monthData.net < 0 ? 'Thâm hụt dòng tiền' : 'Cân bằng thu chi')}
            </span>
          </div>
        </div>

        {/* Card 4: Tỷ lệ tiết kiệm */}
        <div className="analytics-kpi-card card-savings">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Tỷ lệ tiết kiệm</span>
            <div className="kpi-icon-badge badge-savings" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </div>
          </div>
          <div className={`kpi-card-amount ${
            monthData.income <= 0
              ? 'text-muted'
              : monthData.savingsRate >= 20
              ? 'text-success'
              : monthData.savingsRate >= 0
              ? 'text-warning'
              : 'text-danger'
          }`}>
            {monthData.income > 0 ? formatPercent(monthData.savingsRate) : '0%'}
          </div>
          <div className="kpi-card-meta">
            <span className={`kpi-status-pill ${
              monthData.income <= 0
                ? 'pill-neutral'
                : monthData.savingsRate >= 20
                ? 'pill-positive'
                : monthData.savingsRate >= 0
                ? 'pill-warning'
                : 'pill-danger'
            }`}>
              {monthData.income <= 0
                ? 'Chưa có dữ liệu'
                : monthData.savingsRate >= 20
                ? `Tiết kiệm ${formatPercent(monthData.savingsRate)} (Mục tiêu ≥ 20%)`
                : monthData.savingsRate >= 0
                ? `Tiết kiệm ${formatPercent(monthData.savingsRate)} (Dưới mục tiêu 20%)`
                : `Thâm hụt ${formatPercent(Math.abs(monthData.savingsRate))} thu nhập`}
            </span>
          </div>
        </div>
      </div>

        </>
      )}

      {/* ── 3. Spending By Category Section ── */}
      {(!isMobile || analyticsSubTab === 'spending') && (
      <>
      <div className="analytics-section-panel" id="analytics-spending">
        <div className="panel-header">
          <div className="panel-titles">
            <h3 className="panel-main-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <ChartOutlineIcon size={18} /> Chi tiêu theo danh mục
            </h3>
            <p className="panel-subtitle">
              {monthData.categories.length > 0
                ? `${monthData.categories.length} danh mục có phát sinh chi tiêu trong ${monthLabel}`
                : 'Chưa có khoản chi nào trong tháng'}
            </p>
          </div>
        </div>

        {monthData.categories.length === 0 ? (
          /* Empty state: Bordered/dashed area, min-height 310px */
          <div className="analytics-empty-dashed-box">
            <div className="empty-pie-icon-tile" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                <path d="M22 12A10 10 0 0 0 12 2v10z" />
              </svg>
            </div>
            <strong className="empty-heading-caps">
              CHƯA CÓ DỮ LIỆU CHI TIÊU TRONG {monthLabel.toUpperCase()}
            </strong>
            <p className="empty-body-desc">
              Thêm các giao dịch chi tiêu mới để hệ thống tự động phân loại và trực quan hóa tỷ trọng từng nhóm chi phí.
            </p>
            <button
              type="button"
              className="btn-add-txn-empty"
              onClick={openAddTxnModal}
            >
              + Thêm giao dịch ngay
            </button>
          </div>
        ) : (
          /* Data state: Doughnut Chart on Left, Ranked Category List on Right */
          <div className="analytics-category-data-grid">
            <div className="category-chart-wrapper">
              <div className="doughnut-canvas-box">
                {doughnutChartData && <Doughnut data={doughnutChartData} options={doughnutOptions} />}
                <div className="doughnut-center-metric">
                  <span className="doughnut-center-label">Tổng chi</span>
                  <strong className="doughnut-center-val">{formatCurrency(monthData.expense)}</strong>
                </div>
              </div>
            </div>

            <div className="category-ranked-list">
              {monthData.categories.map((cat) => (
                <div key={cat.name} className="analytics-cat-item-row">
                  <div className="cat-item-top">
                    <div className="cat-item-lead">
                      <span className="cat-avatar-tile" style={{ backgroundColor: `${cat.color}16`, color: cat.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CategoryOutlineIcon name={cat.name} size={16} />
                      </span>
                      <div className="cat-text-info">
                        <span className="cat-title-text">{cat.name}</span>
                        <span className="cat-pct-badge">{formatPercent(cat.percent)}</span>
                      </div>
                    </div>

                    <strong className="cat-amount-text">{formatCurrency(cat.amount)}</strong>
                  </div>

                  <div className="cat-progress-track" aria-hidden="true">
                    <div
                      className="cat-progress-fill"
                      style={{
                        width: `${Math.max(3, cat.percent)}%`,
                        backgroundColor: cat.color
                      }}
                    />
                  </div>
                  <button type="button" className="category-history-link"
                    onClick={() => viewCategoryHistory(cat.name)}>{t('history.viewCategory')}</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* Cash-flow controls and layout adapt to the available content width. */}
      {cashFlowActive && <CashFlowPanel
        t={t} lang={lang} intlLocale={intlLocale}
        periodMode={trendMode} series={trendSeries} excludeRecurring={excludeRecurring}
        activeMonth={activeMonth} periodLabel={periodLabel}
        summary={trendSummary} topDays={highestSpendingDays} hasData={hasTrendData}
        emptyMessage={trendMode === 'daily' && visibleDailyDays[0]?.date > today
          ? t('analytics.cashflow.futureDays')
          : isCompactChart && trendMode === 'daily' && dailyTrend.hasAnyData
            ? t('analytics.noDataForRange') : t('analytics.noChartData')}
        currentMonth={getLocalMonthString()} latestMonth={getLocalMonthString()}
        savingPreferences={savingCashFlowPreferences} pinnedDefault={pinnedDefault}
        onPeriodModeChange={changeCashFlowPeriod}
        onSeriesChange={(series) => saveCashFlowChoice({ series })}
        onExcludeRecurringChange={(excludeRecurring) => saveCashFlowChoice({ excludeRecurring })}
        onMonthChange={changeCashFlowMonth} onOpenDay={openDay}
        onViewHistory={viewCashFlowHistory}
        onPinDefault={() => saveCashFlowDefault(false)} onClearDefault={() => saveCashFlowDefault(true)}
        drilldownOrigin={drilldown} onBackToPeriod={backToCashFlowPeriod}
        chart={<Bar ref={barChartRef} data={barChartData} options={barOptions} plugins={[chartContext]}
          data-testid="cashflow-chart" data-series={trendSeries} data-mode={trendMode}
          role="img" aria-label={t(trendSeries === 'expense' ? 'analytics.cashFlowExpenseChartAria'
            : trendSeries === 'income' ? 'analytics.cashFlowIncomeChartAria' : 'analytics.cashFlowChartAria')} />}
        weekNavigation={isCompactChart && trendMode === 'daily' &&
          <div className="trend-week-nav" role="group" aria-label={t('analytics.weekNavigation')}>
            <button type="button" className="trend-week-nav__button" disabled={selectedWeekIndex === 0}
              aria-label={t('analytics.previousWeek')}
              onClick={() => setMobileWeek({ month: activeMonth, index: selectedWeekIndex - 1 })}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="trend-week-nav__range" aria-live="polite">
              {t('analytics.weekRange', { start: weekStart, end: weekEnd, month: currentMonthNum })}
            </span>
            <button type="button" className="trend-week-nav__button" disabled={selectedWeekIndex >= weekCount - 1}
              aria-label={t('analytics.nextWeek')}
              onClick={() => setMobileWeek({ month: activeMonth, index: selectedWeekIndex + 1 })}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>}
        unusualContent={trendMode === 'daily' && trendSeries !== 'income' && unusualDays.length > 0 &&
          <div className="analytics-unusual-days">
            <div><strong>{t('analytics.unusualTitle')}</strong><p>{t('analytics.unusualExplanation')}</p>
              <small>{t('analytics.cashflow.recurringExcluded')}</small></div>
            {unusualDays.map((day) => <div className="analytics-unusual-row" key={day.date}>
              <button type="button" onClick={() => openDay(day.date, 'expense', true)}>
                <strong>{formatDate(day.date, 'short', { locale: lang })}</strong>
                <span>{formatCurrency(day.amount)} · {t('analytics.unusualRatio', {
                  ratio: day.ratio.toLocaleString(intlLocale, { maximumFractionDigits: 1 }),
                })}</span>
              </button>
              <button type="button" disabled={savingExpectedDay === day.date}
                onClick={() => toggleExpectedDay(day.date, true)}>{t('analytics.unusualMarkExpected')}</button>
            </div>)}
          </div>}
      />}

      {/* ── 5. Detailed Financial Report Section (Báo cáo tài chính chuyên sâu) ── */}
      {(!isMobile || analyticsSubTab === 'reports') && (
      <>
      <div className="analytics-section-panel analytics-report-section" id="analytics-reports">
        {/* Header & Controls */}
        <div className="panel-header">
          <div className="panel-titles">
            <h3 className="panel-main-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <ClipboardOutlineIcon size={18} /> Báo cáo tổng hợp tài chính
            </h3>
          </div>

          <div className="report-action-bar">
            {/* Period Mode Selector: Tháng | Quý */}
            <div className="analytics-segmented-switch" role="radiogroup" aria-label="Chế độ báo cáo">
              <button
                type="button"
                role="radio"
                aria-checked={reportPeriodType === 'monthly'}
                className={`analytics-segment-btn ${reportPeriodType === 'monthly' ? 'active' : ''}`}
                onClick={() => setReportPeriodType('monthly')}
              >
                Theo Tháng
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={reportPeriodType === 'quarterly'}
                className={`analytics-segment-btn ${reportPeriodType === 'quarterly' ? 'active' : ''}`}
                onClick={() => setReportPeriodType('quarterly')}
              >
                Theo Quý
              </button>
            </div>

            {/* Print & Export Buttons */}
            <button
              type="button"
              className="btn-report-action"
              onClick={handlePrint}
              title="In hoặc Lưu thành file PDF"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect width="12" height="8" x="6" y="14" />
              </svg>
              <span>In báo cáo</span>
            </button>

            <button
              type="button"
              className="btn-report-action btn-report-action--primary"
              onClick={handleExportCSV}
              title="Tải bảng tính sao kê chi tiết dạng CSV (tương thích Excel)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              <span>Xuất CSV</span>
            </button>
          </div>
        </div>

        {/* Period info pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="report-period-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
            <span>Kỳ báo cáo: <strong>{reportData.curLabel}</strong></span>
          </span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary, #607086)' }}>
            (Đối chiếu với kỳ liền kề: <strong>{reportData.prevLabel}</strong>)
          </span>
        </div>

        {/* Executive Summary Cards */}
        <div className="report-summary-grid">
          {/* Summary 1: Thu nhập */}
          <div className="report-summary-card">
            <div className="report-summary-card__header">
              <span className="report-summary-card__title">Tổng thu nhập</span>
              <span className={`delta-badge ${
                reportData.prevStats.income === 0 && reportData.curStats.income > 0
                  ? 'delta-badge--up-good'
                  : reportData.incomeDelta > 0
                  ? 'delta-badge--up-good'
                  : reportData.incomeDelta < 0
                  ? 'delta-badge--down-bad'
                  : 'delta-badge--neutral'
              }`}>
                {reportData.prevStats.income === 0 && reportData.curStats.income > 0
                  ? `↑ +${formatPercent(100, { fractionDigits: 1 })}`
                  : reportData.incomeDelta > 0
                  ? `↑ +${formatPercent(Math.abs(reportData.incomeDeltaPct), { fractionDigits: 1 })}`
                  : reportData.incomeDelta < 0
                  ? `↓ -${formatPercent(Math.abs(reportData.incomeDeltaPct), { fractionDigits: 1 })}`
                  : `~ ${formatPercent(0, { fractionDigits: 1 })}`}
              </span>
            </div>
            <strong className="report-summary-card__amount text-success">
              {formatCurrency(reportData.curStats.income)}
            </strong>
            <div className="report-summary-card__meta">
              <span>Kỳ trước: {formatCurrency(reportData.prevStats.income)}</span>
              <span>{reportData.curStats.incomeCount} GD</span>
            </div>
          </div>

          {/* Summary 2: Chi tiêu */}
          <div className="report-summary-card">
            <div className="report-summary-card__header">
              <span className="report-summary-card__title">Tổng chi tiêu</span>
              <span className={`delta-badge ${
                reportData.prevStats.expense === 0 && reportData.curStats.expense > 0
                  ? 'delta-badge--new'
                  : reportData.prevStats.expense > 0 && reportData.curStats.expense === 0
                  ? 'delta-badge--down-good'
                  : reportData.expenseDelta < 0
                  ? 'delta-badge--down-good'
                  : reportData.curStats.net < 0 || reportData.expenseDeltaPct > 30
                  ? 'delta-badge--up-bad'
                  : reportData.expenseDelta > 0
                  ? 'delta-badge--up-warn'
                  : 'delta-badge--neutral'
              }`}>
                {reportData.prevStats.expense === 0 && reportData.curStats.expense > 0
                  ? 'Mới ghi nhận'
                  : reportData.prevStats.expense > 0 && reportData.curStats.expense === 0
                  ? `↓ -${formatPercent(100, { fractionDigits: 1 })}`
                  : reportData.expenseDelta > 0
                  ? `↑ +${formatPercent(Math.abs(reportData.expenseDeltaPct), { fractionDigits: 1 })}`
                  : reportData.expenseDelta < 0
                  ? `↓ -${formatPercent(Math.abs(reportData.expenseDeltaPct), { fractionDigits: 1 })}`
                  : `~ ${formatPercent(0, { fractionDigits: 1 })}`}
              </span>
            </div>
            <strong className={`report-summary-card__amount ${reportData.curStats.expense > 0 ? 'text-danger' : 'text-muted'}`}>
              {formatCurrency(reportData.curStats.expense)}
            </strong>
            <div className="report-summary-card__meta">
              <span>Kỳ trước: {formatCurrency(reportData.prevStats.expense)}</span>
              <span>{reportData.curStats.expenseCount} GD</span>
            </div>
          </div>

          {/* Summary 3: Dòng tiền thuần */}
          <div className="report-summary-card">
            <div className="report-summary-card__header">
              <span className="report-summary-card__title">Dòng tiền thuần (Net)</span>
              <span className={`delta-badge ${
                reportData.curStats.net > 0
                  ? 'delta-badge--up-good'
                  : reportData.curStats.net < 0
                  ? 'delta-badge--down-bad'
                  : 'delta-badge--neutral'
              }`}>
                {reportData.curStats.net > 0 ? 'Thặng dư' : (reportData.curStats.net < 0 ? 'Thâm hụt' : 'Cân bằng')}
              </span>
            </div>
            <strong className={`report-summary-card__amount ${
              reportData.curStats.net > 0 ? 'text-success' : (reportData.curStats.net < 0 ? 'text-danger' : 'text-muted')
            }`}>
              {formatCurrency(reportData.curStats.net)}
            </strong>
            <div className="report-summary-card__meta">
              <span>Kỳ trước: {formatCurrency(reportData.prevStats.net)}</span>
              <span>{reportData.netDelta >= 0 ? `+${formatCurrency(reportData.netDelta)}` : formatCurrency(reportData.netDelta)}</span>
            </div>
          </div>

          {/* Summary 4: Tỷ lệ tiết kiệm */}
          <div className="report-summary-card">
            <div className="report-summary-card__header">
              <span className="report-summary-card__title">Tỷ lệ tiết kiệm</span>
              <span className={`delta-badge ${
                reportData.curStats.income <= 0
                  ? 'delta-badge--neutral'
                  : reportData.curStats.savingsRate < 0
                  ? 'delta-badge--down-bad'
                  : reportData.savingsRateDelta >= 0
                  ? 'delta-badge--up-good'
                  : 'delta-badge--down-warn'
              }`}>
                {reportData.curStats.income <= 0
                  ? '—'
                  : reportData.savingsRateDelta >= 0
                  ? `↑ +${formatPercent(reportData.savingsRateDelta, { fractionDigits: 1 })}`
                  : `↓ ${formatPercent(reportData.savingsRateDelta, { fractionDigits: 1 })}`}
              </span>
            </div>
            <strong className={`report-summary-card__amount ${
              reportData.curStats.income <= 0
                ? 'text-muted'
                : reportData.curStats.savingsRate >= 20
                ? 'text-success'
                : reportData.curStats.savingsRate >= 0
                ? 'text-warning'
                : 'text-danger'
            }`}>
              {formatPercent(reportData.curStats.savingsRate)}
            </strong>
            <div className="report-summary-card__meta">
              <span>Kỳ trước: {formatPercent(reportData.prevStats.savingsRate)}</span>
              <span>Mục tiêu: ≥ 20%</span>
            </div>
          </div>
        </div>

        {/* Smart Financial Insights & Advice Banner */}
        {reportData.insights.length > 0 && (
          <div className="report-insights-banner">
            <div className="report-insights-banner__head">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <BulbOutlineIcon size={16} /> Nhận định & Khuyến nghị tài chính kỳ này
              </span>
            </div>
            <div className="report-insights-list">
              {reportData.insights.map((item, idx) => (
                <div key={idx} className="report-insight-item">
                  <span className={`insight-icon-pill insight-icon-pill--${item.type}`}>
                    {item.type === 'accolade' ? (
                      <StarOutlineIcon size={14} />
                    ) : item.type === 'warning' ? (
                      <AlertTriangleOutlineIcon size={14} />
                    ) : (
                      <InfoOutlineIcon size={14} />
                    )}
                  </span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Category Table */}
        <div className="report-table-wrapper">
          <table className="report-table" aria-label="Bảng phân tích chi tiết chi phí theo danh mục">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Nhóm chi phí</th>
                <th style={{ width: '13%' }}>Chi tiêu kỳ này</th>
                <th style={{ width: '13%' }}>So với kỳ trước</th>
                <th style={{ width: '12%' }}>Tỷ trọng</th>
                <th style={{ width: '8%', textAlign: 'center' }}>Số GD</th>
                <th style={{ width: '12%' }}>Hạn mức</th>
                <th style={{ width: '10%' }}>Ngân sách</th>
                <th style={{ width: '20%' }}>Đánh giá & Khuyến nghị</th>
              </tr>
            </thead>
            <tbody>
              {reportData.categoryRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)' }}>
                    Chưa phát sinh giao dịch chi tiêu nào trong kỳ này.
                  </td>
                </tr>
              ) : (
                reportData.categoryRows.map((cat) => {
                  const isOver = cat.limit && (cat.budgetStatus.isOver || cat.budgetStatus.percent > 100);
                  const isMaxed = cat.limit && cat.budgetStatus.percent === 100;
                  const isWarning = cat.limit && (cat.budgetStatus.status === 'warning' || isMaxed);

                  return (
                    <tr key={cat.name}>
                      {/* 1. Category */}
                      <td>
                        <div className="table-cat-cell">
                          <span className="table-cat-icon" style={{ backgroundColor: 'var(--color-success-bg, rgba(0, 139, 87, 0.08))', color: 'var(--color-brand, #008B57)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CategoryOutlineIcon name={cat.name} size={15} />
                          </span>
                          <span className="table-cat-name">{cat.name}</span>
                        </div>
                        {cat.spentCur > 0 && <button type="button" className="category-history-link"
                          onClick={() => viewCategoryHistory(cat.name,
                            reportPeriodType === 'quarterly' ? curQuarterMonths : [activeMonth])}>
                          {t('history.viewCategory')}
                        </button>}
                      </td>

                      {/* 2. Current Spent */}
                      <td>
                        <strong className="table-num-cell table-num-cell--bold">
                          {formatCurrency(cat.spentCur)}
                        </strong>
                      </td>

                      {/* 3. Delta vs Previous */}
                      <td>
                        <div className="table-delta-cell">
                          <span className={`delta-badge ${
                            cat.deltaBadgeType === 'good'
                              ? 'delta-badge--down-good'
                              : cat.deltaBadgeType === 'bad'
                              ? 'delta-badge--up-bad'
                              : cat.deltaBadgeType === 'warn'
                              ? 'delta-badge--up-warn'
                              : cat.deltaBadgeType === 'new'
                              ? 'delta-badge--new'
                              : 'delta-badge--neutral'
                          }`}>
                            {cat.deltaBadgeText}
                          </span>
                          <span className="table-delta-sub">
                            Kỳ trước: {formatCurrency(cat.spentPrev)}
                          </span>
                        </div>
                      </td>

                      {/* 4. Percentage of total */}
                      <td className="table-pct-cell">
                        <div className="table-pct-bar-wrap">
                          <div className="table-pct-track">
                            <div
                              className="table-pct-fill"
                              style={{
                                width: `${Math.max(2, cat.pctOfTotal)}%`,
                                backgroundColor: isOver
                                  ? 'var(--color-danger)'
                                  : isWarning
                                  ? 'var(--color-warning)'
                                  : 'var(--color-success)'
                              }}
                            />
                          </div>
                          <span className="table-pct-val">{formatPercent(cat.pctOfTotal)}</span>
                        </div>
                      </td>

                      {/* 5. Count */}
                      <td style={{ textAlign: 'center' }}>
                        <span className="delta-badge delta-badge--neutral">
                          {cat.countCur}
                        </span>
                      </td>

                      {/* 6. Budget Limit */}
                      <td>
                        <span className="table-num-cell">
                          {cat.limit ? formatCurrency(cat.limit) : '—'}
                        </span>
                      </td>

                      {/* 7. Budget Status */}
                      <td>
                        {cat.limit ? (
                          isOver ? (
                            <span className="budget-status-pill budget-status-pill--danger">
                              <AlertTriangleOutlineIcon size={12} style={{ marginRight: 4, verticalAlign: '-1px' }} />
                              Vượt ({cat.budgetStatus.percent}%)
                            </span>
                          ) : isMaxed ? (
                            <span className="budget-status-pill budget-status-pill--warning">
                              <ZapOutlineIcon size={12} style={{ marginRight: 4, verticalAlign: '-1px' }} />
                              Chạm ({cat.budgetStatus.percent}%)
                            </span>
                          ) : isWarning ? (
                            <span className="budget-status-pill budget-status-pill--warning">
                              <ZapOutlineIcon size={12} style={{ marginRight: 4, verticalAlign: '-1px' }} />
                              Cận trần ({cat.budgetStatus.percent}%)
                            </span>
                          ) : (
                            <span className="budget-status-pill budget-status-pill--safe">
                              <CheckOutlineIcon size={12} style={{ marginRight: 4, verticalAlign: '-1px' }} />
                              An toàn ({cat.budgetStatus.percent}%)
                            </span>
                          )
                        ) : (
                          <span className="budget-status-pill budget-status-pill--unset">
                            Chưa đặt
                          </span>
                        )}
                      </td>

                      {/* 8. Advice & Accolades */}
                      <td className="table-advice-cell">
                        <span className={`table-advice-text--${cat.adviceType}`}>
                          {cat.adviceText}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
      {selectedDay && <DailyTransactionsDrawer key={`${selectedDay.date}:${selectedDay.type}:${selectedDay.excludeRecurring}`}
        date={selectedDay.date} initialType={selectedDay.type} transactions={transactions}
        excludeRecurring={selectedDay.excludeRecurring} expected={expectedDays.includes(selectedDay.date)}
        savingExpected={savingExpectedDay === selectedDay.date} onToggleExpected={toggleExpectedDay}
        onClose={() => setSelectedDay(null)}
        onEdit={(transaction) => { setSelectedDay(null); openEditTransaction(transaction); }}
        onManage={manageTransactionSource}
        onViewHistory={(date, type) => viewDayHistory(date, type, selectedDay.excludeRecurring)} />}
    </div>
  );
}
