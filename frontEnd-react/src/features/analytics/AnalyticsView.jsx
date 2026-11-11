import { getUserErrorMessage } from '../../utils/userErrors.js';
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
import { useNavigate } from 'react-router';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useToastStore } from '../../stores/useToastStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { formatDate, getLocalMonthString } from '../../utils/formatters';
import { BREAKPOINTS, useIsMobile } from '../../hooks/useMediaQuery';
import { useSectionScrollSpy } from '../../hooks/useSectionScrollSpy';
import { useTranslation } from '../../i18n/useTranslation';
import { spendingService } from '../../services/spendingService';
import { DailyTransactionsDrawer } from './DailyTransactionsDrawer';
import { useCashFlowPreferences } from '../../hooks/useCashFlowPreferences';

import { FinancialReportSection } from './analytics/FinancialReportSection';
import { AnalyticsCashFlowSection } from './analytics/AnalyticsCashFlowSection';
import { AnalyticsCategorySection } from './analytics/AnalyticsCategorySection';
import { AnalyticsKpiGrid } from './analytics/AnalyticsKpiGrid';
import { AnalyticsHeader } from './analytics/AnalyticsHeader';
import { useFinancialReport } from './analytics/useFinancialReport';
import { useAnalyticsCharts } from './analytics/useAnalyticsCharts';
import { useCashFlowTrend } from './analytics/useCashFlowTrend';
import { useMonthStats } from './analytics/useMonthStats';
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
  const isMobile = useIsMobile();
  const isCompactChart = useIsMobile(BREAKPOINTS.phone);
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
      if (active) addToast({ type: 'error', message: getUserErrorMessage(error, 'analytics.unusualLoadFailed') });
    });
    return () => { active = false; };
  }, [activeMonth, financialResetVersion, addToast, t]);

  const toggleExpectedDay = useCallback(async (date, expected) => {
    setSavingExpectedDay(date);
    try {
      await spendingService.setExpectedDay(date, expected);
      setExpectedDays((days) => expected ? [...new Set([...days, date])] : days.filter((day) => day !== date));
    } catch (error) {
      addToast({ type: 'error', message: getUserErrorMessage(error, 'analytics.unusualSaveFailed') });
    } finally {
      setSavingExpectedDay('');
    }
  }, [addToast]);

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
  const { monthData } = useMonthStats({ activeMonth, transactions });

  const { backToCashFlowPeriod, changeCashFlowMonth, changeCashFlowPeriod, dailyTrend, hasTrendData, highestSpendingDays, manageTransactionSource, monthlyTrend, openDay, periodLabel, saveCashFlowChoice, saveCashFlowDefault, selectedWeekIndex, trendSummary, unusualDays, viewCashFlowHistory, viewCategoryHistory, viewDayHistory, visibleDailyDays, weekCount, weekEnd, weekStart } = useCashFlowTrend({ activeMonth, addToast, barChartRef, clearDefault, drilldown, drilldownRevision, excludeRecurring, expectedDays, intlLocale, isCompactChart, lang, mobileWeek, monthLabel, navigate, navigateTo, pinDefault, setCashFlowView, setDrilldown, setMobileWeek, setSelectedDay, setSelectedMonth, t, transactions, trendMode, trendSeries });

  // Resolve semantic tokens for canvas, which cannot interpret CSS variables.
  const { barChartData, barOptions, chartContext, doughnutChartData, doughnutOptions, today } = useAnalyticsCharts({ activeMonth, drilldownRevision, isCompactChart, label, lang, monthData, monthlyTrend, openDay, prefersReducedMotion, setDrilldown, setMobileWeek, setSelectedMonth, t, theme, trendMode, trendSeries, viewCategoryHistory, visibleDailyDays });

  // ── Financial Report Statistics & Comparison ──
  const { handleExportCSV, handlePrint, reportData } = useFinancialReport({ activeMonth, addToast, budgets, curQuarterMonths, label, lang, monthLabel, prevMonthStr, prevQuarterLabel, prevQuarterMonths, quarterLabel, reportPeriodType, t, transactions });

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
      <AnalyticsHeader handleNextMonth={handleNextMonth} handlePrevMonth={handlePrevMonth} handleSetLastMonth={handleSetLastMonth} handleSetThisMonth={handleSetThisMonth} isCurrentMonth={isCurrentMonth} monthLabel={monthLabel} />

      {/* ── 2. 4 KPI Grid Cards ── */}
      <AnalyticsKpiGrid monthData={monthData} />

        </>
      )}

      {/* ── 3. Spending By Category Section ── */}
      {<AnalyticsCategorySection analyticsSubTab={analyticsSubTab} doughnutChartData={doughnutChartData} doughnutOptions={doughnutOptions} isMobile={isMobile} monthData={monthData} monthLabel={monthLabel} openAddTxnModal={openAddTxnModal} viewCategoryHistory={viewCategoryHistory} />}

      {/* Cash-flow controls and layout adapt to the available content width. */}
      {<AnalyticsCashFlowSection activeMonth={activeMonth} backToCashFlowPeriod={backToCashFlowPeriod} barChartData={barChartData} barChartRef={barChartRef} barOptions={barOptions} cashFlowActive={cashFlowActive} changeCashFlowMonth={changeCashFlowMonth} changeCashFlowPeriod={changeCashFlowPeriod} chartContext={chartContext} currentMonthNum={currentMonthNum} dailyTrend={dailyTrend} drilldown={drilldown} excludeRecurring={excludeRecurring} hasTrendData={hasTrendData} highestSpendingDays={highestSpendingDays} isCompactChart={isCompactChart} openDay={openDay} periodLabel={periodLabel} pinnedDefault={pinnedDefault} saveCashFlowChoice={saveCashFlowChoice} saveCashFlowDefault={saveCashFlowDefault} savingCashFlowPreferences={savingCashFlowPreferences} savingExpectedDay={savingExpectedDay} selectedWeekIndex={selectedWeekIndex} setMobileWeek={setMobileWeek} today={today} toggleExpectedDay={toggleExpectedDay} trendMode={trendMode} trendSeries={trendSeries} trendSummary={trendSummary} unusualDays={unusualDays} viewCashFlowHistory={viewCashFlowHistory} visibleDailyDays={visibleDailyDays} weekCount={weekCount} weekEnd={weekEnd} weekStart={weekStart} />}

      {/* ── 5. Detailed Financial Report Section (Báo cáo tài chính chuyên sâu) ── */}
      {<FinancialReportSection activeMonth={activeMonth} analyticsSubTab={analyticsSubTab} curQuarterMonths={curQuarterMonths} handleExportCSV={handleExportCSV} handlePrint={handlePrint} isMobile={isMobile} reportData={reportData} reportPeriodType={reportPeriodType} setReportPeriodType={setReportPeriodType} viewCategoryHistory={viewCategoryHistory} />}
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
