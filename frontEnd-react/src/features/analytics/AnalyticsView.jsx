import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { formatCurrency, formatPercent, getLocalMonthString } from '../../utils/formatters';
import { getCategoryIcon } from '../../utils/categories';
import { getBudgetStatus } from '../../utils/financeMath';

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

export function AnalyticsView() {
  const transactions = useTransactionStore((s) => s.transactions);
  const budgets = useTransactionStore((s) => s.budgets);
  const selectedMonth = useSpendingStore((s) => s.selectedMonth);
  const setSelectedMonth = useSpendingStore((s) => s.setSelectedMonth);
  const openAddTxnModal = useSpendingStore((s) => s.openAddTxnModal);
  const analyticsSubTab = useSpendingStore((s) => s.analyticsSubTab);
  const setAnalyticsSubTab = useSpendingStore((s) => s.setAnalyticsSubTab);
  const theme = useThemeStore((s) => s.theme);

  const [trendMode, setTrendMode] = useState('daily'); // 'daily' | '3months' | '6months'
  const [reportPeriodType, setReportPeriodType] = useState('monthly'); // 'monthly' | 'quarterly'

  // Current active month in 'YYYY-MM' format
  const activeMonth = selectedMonth || getLocalMonthString();

  // Month & Quarter navigation helpers
  const {
    currentYear,
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
      monthLabel: `Tháng ${month}, ${year}`,
      prevMonthStr: `${prevYear}-${prevM}`,
      nextMonthStr: `${nextYear}-${nextM}`,
      isCurrentMonth: activeMonth === nowMonthStr,
      currentQuarter: cQuarter,
      prevQuarter: pQuarter,
      prevQuarterYear: pQuarterYear,
      quarterLabel: `Quý ${cQuarter}/${year} (T${(cQuarter - 1) * 3 + 1} - T${cQuarter * 3})`,
      prevQuarterLabel: `Quý ${pQuarter}/${pQuarterYear} (T${(pQuarter - 1) * 3 + 1} - T${pQuarter * 3})`,
      curQuarterMonths: curQMonths,
      prevQuarterMonths: prevQMonths
    };
  }, [activeMonth]);

  const handlePrevMonth = () => setSelectedMonth(prevMonthStr);
  const handleNextMonth = () => setSelectedMonth(nextMonthStr);
  const handleSetThisMonth = () => {
    setSelectedMonth(getLocalMonthString());
  };
  const handleSetLastMonth = () => {
    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    setSelectedMonth(getLocalMonthString(lastMonthDate));
  };

  // 1. Current Month Stats & Breakdown
  const monthData = useMemo(() => {
    const filtered = transactions.filter((t) => t.date && t.date.startsWith(activeMonth));
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    const catMap = {};

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

  // 2. Multi-Month Trend calculation helper (Last N months based on activeMonth)
  const getMultiMonthTrend = useCallback(
    (numMonths) => {
      const months = [];
      let hasAnyData = false;

      for (let i = numMonths - 1; i >= 0; i--) {
        const d = new Date(currentYear, currentMonthNum - 1 - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const prefix = `${y}-${m}`;
        const label = `T${d.getMonth() + 1}/${String(y).slice(2)}`;

        let inc = 0;
        let exp = 0;
        transactions.forEach((t) => {
          if (t.date && t.date.startsWith(prefix)) {
            const amt = Number(t.amount) || 0;
            const fee = Number(t.fee) || 0;
            if (t.type === 'income') inc += amt;
            else if (t.type === 'expense') exp += amt + fee;
          }
        });

        if (inc > 0 || exp > 0) hasAnyData = true;
        months.push({ prefix, label, income: inc, expense: exp });
      }
      return { months, hasAnyData };
    },
    [transactions, currentYear, currentMonthNum]
  );

  const trend3Months = useMemo(() => getMultiMonthTrend(3), [getMultiMonthTrend]);
  const trend6Months = useMemo(() => getMultiMonthTrend(6), [getMultiMonthTrend]);

  // 3. Daily Trend in current activeMonth
  const dailyTrend = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonthNum, 0).getDate();
    const days = [];
    let hasAnyData = false;

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${activeMonth}-${String(day).padStart(2, '0')}`;
      let inc = 0;
      let exp = 0;

      transactions.forEach((t) => {
        if (t.date === dayStr) {
          const amt = Number(t.amount) || 0;
          const fee = Number(t.fee) || 0;
          if (t.type === 'income') inc += amt;
          else if (t.type === 'expense') exp += amt + fee;
        }
      });

      if (inc > 0 || exp > 0) hasAnyData = true;
      days.push({
        day,
        label: `${day}`,
        income: inc,
        expense: exp
      });
    }

    return { days, hasAnyData };
  }, [transactions, currentYear, currentMonthNum, activeMonth]);

  const hasTrendData = useMemo(() => {
    if (trendMode === 'daily') return dailyTrend.hasAnyData;
    if (trendMode === '3months') return trend3Months.hasAnyData;
    if (trendMode === '6months') return trend6Months.hasAnyData;
    return false;
  }, [trendMode, dailyTrend, trend3Months, trend6Months]);

  // Dynamic Chart Theme Tokens tailored for dark, cream, green, and light themes
  const chartThemeTokens = useMemo(() => {
    switch (theme) {
      case 'dark':
        return {
          income: '#10B981',
          expense: '#FF5B69',
          tick: '#8B949E',
          grid: 'rgba(255, 255, 255, 0.08)',
          legend: '#C9D1D9',
          tooltipBg: '#1F242C',
          sliceBorder: '#12131C'
        };
      case 'cream':
        return {
          income: '#1E7E34',
          expense: '#C53030',
          tick: '#8C7564',
          grid: 'rgba(140, 117, 100, 0.16)',
          legend: '#584133',
          tooltipBg: '#2C1D10',
          sliceBorder: '#FDF8F2'
        };
      case 'green':
        return {
          income: '#047857',
          expense: '#DC2626',
          tick: '#6B9582',
          grid: 'rgba(75, 114, 96, 0.16)',
          legend: '#3D6A56',
          tooltipBg: '#0E2E1E',
          sliceBorder: '#FFFFFF'
        };
      case 'light':
      default:
        return {
          income: '#059669',
          expense: '#DC2626',
          tick: '#64748B',
          grid: 'rgba(100, 116, 139, 0.12)',
          legend: '#475569',
          tooltipBg: '#0F172A',
          sliceBorder: '#FFFFFF'
        };
    }
  }, [theme]);

  // Doughnut Chart Configuration
  const doughnutChartData = useMemo(() => {
    if (monthData.categories.length === 0) return null;

    return {
      labels: monthData.categories.map((c) => c.name),
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
  }, [monthData.categories, chartThemeTokens]);

  const doughnutOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: chartThemeTokens.tooltipBg,
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
  }, [monthData.expense, chartThemeTokens]);

  // Bar Chart Configuration
  const barChartData = useMemo(() => {
    if (trendMode === 'daily') {
      return {
        labels: dailyTrend.days.map((d) => d.label),
        datasets: [
          {
            label: 'Thu nhập',
            data: dailyTrend.days.map((d) => d.income),
            backgroundColor: chartThemeTokens.income,
            borderRadius: 4,
            barPercentage: 0.7,
            categoryPercentage: 0.8
          },
          {
            label: 'Chi tiêu',
            data: dailyTrend.days.map((d) => d.expense),
            backgroundColor: chartThemeTokens.expense,
            borderRadius: 4,
            barPercentage: 0.7,
            categoryPercentage: 0.8
          }
        ]
      };
    }

    const currentMultiTrend = trendMode === '3months' ? trend3Months : trend6Months;
    const barPercentage = trendMode === '3months' ? 0.45 : 0.6;
    const categoryPercentage = trendMode === '3months' ? 0.55 : 0.7;

    return {
      labels: currentMultiTrend.months.map((m) => m.label),
      datasets: [
        {
          label: 'Thu nhập',
          data: currentMultiTrend.months.map((m) => m.income),
          backgroundColor: chartThemeTokens.income,
          borderRadius: 6,
          barPercentage,
          categoryPercentage
        },
        {
          label: 'Chi tiêu',
          data: currentMultiTrend.months.map((m) => m.expense),
          backgroundColor: chartThemeTokens.expense,
          borderRadius: 6,
          barPercentage,
          categoryPercentage
        }
      ]
    };
  }, [trendMode, dailyTrend, trend3Months, trend6Months, chartThemeTokens]);

  const barOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { family: 'Inter, sans-serif', size: 12, weight: '500' },
            color: chartThemeTokens.legend
          }
        },
        tooltip: {
          backgroundColor: chartThemeTokens.tooltipBg,
          titleFont: { family: 'Inter, sans-serif', size: 12, weight: '600' },
          bodyFont: { family: 'Inter, sans-serif', size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            title: (items) => {
              if (!items.length) return '';
              const item = items[0];
              if (trendMode === 'daily') {
                return `Ngày ${item.label}/${currentMonthNum}/${currentYear}`;
              }
              return item.label;
            },
            label: (context) => {
              const label = context.dataset.label || '';
              const val = context.parsed.y || 0;
              return ` ${label}: ${formatCurrency(val)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: chartThemeTokens.tick,
            font: { family: 'Inter, sans-serif', size: 11 }
          }
        },
        y: {
          min: 0,
          grid: { color: chartThemeTokens.grid },
          ticks: {
            color: chartThemeTokens.tick,
            font: { family: 'Inter, sans-serif', size: 11 },
            callback: (value) => {
              if (value >= 1000000) return `${(value / 1000000).toFixed(0)}tr`;
              if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
              return value;
            }
          }
        }
      }
    };
  }, [trendMode, currentMonthNum, currentYear, chartThemeTokens]);

  // ── Financial Report Statistics & Comparison ──
  const reportData = useMemo(() => {
    const isQuarter = reportPeriodType === 'quarterly';
    const curLabel = isQuarter ? quarterLabel : monthLabel;
    const prevLabel = isQuarter ? prevQuarterLabel : `Tháng ${parseInt(prevMonthStr.split('-')[1], 10)}, ${prevMonthStr.split('-')[0]}`;

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
      const catMap = {};

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
        deltaBadgeText = '0 đ';
      } else if (isNewInPeriod) {
        if (limit && budgetStatus.isOver) {
          deltaBadgeType = 'bad';
          deltaBadgeText = 'Mới (Vượt trần)';
        } else if (limit && (budgetStatus.status === 'warning' || budgetStatus.percent >= 100)) {
          deltaBadgeType = 'warn';
          deltaBadgeText = 'Mới (Cận trần)';
        } else {
          deltaBadgeType = 'new';
          deltaBadgeText = '✨ Mới trong kỳ';
        }
      } else if (isEliminated) {
        deltaBadgeType = 'good';
        deltaBadgeText = '↓ -100%';
      } else if (deltaAmt < 0) {
        deltaBadgeType = 'good';
        deltaBadgeText = `↓ -${Math.abs(deltaPct).toFixed(1)}%`;
      } else if (deltaAmt === 0 || Math.abs(deltaPct) < 0.5) {
        deltaBadgeType = 'neutral';
        deltaBadgeText = '~ 0.0%';
      } else {
        // deltaAmt > 0 (Chi tiêu tăng so với kỳ trước)
        if (limit && budgetStatus.isOver) {
          deltaBadgeType = 'bad';
          deltaBadgeText = `↑ +${deltaPct.toFixed(1)}%`;
        } else if (limit && (budgetStatus.status === 'warning' || budgetStatus.percent >= 100)) {
          deltaBadgeType = 'warn';
          deltaBadgeText = `↑ +${deltaPct.toFixed(1)}%`;
        } else if (limit && spentCur <= limit * 0.75) {
          // Tăng nhưng an toàn dưới 75% hạn mức
          if (deltaPct > 30) {
            deltaBadgeType = 'warn';
          } else {
            deltaBadgeType = 'neutral';
          }
          deltaBadgeText = `↑ +${deltaPct.toFixed(1)}%`;
        } else {
          // Chưa đặt hạn mức
          if (deltaPct > 50) {
            deltaBadgeType = 'bad';
          } else if (deltaPct > 20) {
            deltaBadgeType = 'warn';
          } else {
            deltaBadgeType = 'neutral';
          }
          deltaBadgeText = `↑ +${deltaPct.toFixed(1)}%`;
        }
      }

      let adviceText = '';
      let adviceType = 'neutral';

      if (spentCur === 0 && spentPrev === 0) {
        adviceText = 'Không phát sinh chi tiêu trong kỳ';
        adviceType = 'neutral';
      } else if (spentCur === 0 && spentPrev > 0) {
        adviceText = 'Không phát sinh chi tiêu (tiết kiệm 100% so với kỳ trước) 👏';
        adviceType = 'good';
      } else if (limit && budgetStatus.isOver) {
        const overPct = budgetStatus.percent - 100;
        adviceText = `Vượt ${formatPercent(overPct)} ngân sách! Cần thắt chặt chi tiêu ⚠️`;
        adviceType = 'danger';
      } else if (limit && budgetStatus.percent === 100) {
        adviceText = `Đã chạm 100% hạn mức trần! Hạn chế phát sinh thêm chi phí ⚡`;
        adviceType = 'warning';
      } else if (limit && budgetStatus.status === 'warning') {
        adviceText = `Đã chạm ${budgetStatus.percent}% hạn mức, còn ${formatCurrency(budgetStatus.remaining)} ⚡`;
        adviceType = 'warning';
      } else if (limit && spentCur < limit * 0.75 && deltaAmt < 0) {
        adviceText = `Tiết kiệm tốt (giảm ${formatPercent(Math.abs(deltaPct))}), an toàn dưới ngân sách 👏`;
        adviceType = 'good';
      } else if (limit && spentCur < limit * 0.75) {
        adviceText = `Kiểm soát tốt dưới hạn mức ngân sách (${budgetStatus.percent}%) ✓`;
        adviceType = 'good';
      } else if (!limit && deltaAmt < 0) {
        adviceText = `Chi tiêu giảm ${formatPercent(Math.abs(deltaPct))} so với kỳ trước 👍`;
        adviceType = 'good';
      } else if (!limit && deltaPct > 30) {
        adviceText = `Tăng ${formatPercent(deltaPct)} so với kỳ trước, nên thiết lập hạn mức 💡`;
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

    if (curStats.net > 0 && curStats.savingsRate >= 20) {
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
    } else if (categoryRows.some(r => r.limit)) {
      insights.push({
        type: 'accolade',
        text: `Tất cả các nhóm có thiết lập ngân sách đều nằm trong vùng kiểm soát an toàn! Tiếp tục phát huy kỷ luật tài chính.`
      });
    }

    if (curStats.expense < prevStats.expense && prevStats.expense > 0) {
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
  }, [reportPeriodType, quarterLabel, prevQuarterLabel, monthLabel, prevMonthStr, activeMonth, curQuarterMonths, prevQuarterMonths, transactions, budgets]);

  // Handle CSV Export with UTF-8 BOM
  const handleExportCSV = () => {
    const { curLabel, prevLabel, curStats, prevStats, categoryRows, curTxns, incomeDelta, incomeDeltaPct, expenseDelta, expenseDeltaPct, netDelta, savingsRateDelta } = reportData;
    
    let csv = '\uFEFF'; // UTF-8 BOM for Excel Vietnamese compatibility
    csv += `BÁO CÁO TÀI CHÍNH CHI TIẾT - CALTDHY\n`;
    csv += `Kỳ báo cáo:,"${curLabel}"\n`;
    csv += `Kỳ so sánh đối chiếu:,"${prevLabel}"\n`;
    csv += `Thời gian xuất báo cáo:,"${new Date().toLocaleString('vi-VN')}"\n\n`;

    // 1. Chỉ số tài chính
    csv += `1. TỔNG KẾT CHỈ SỐ TÀI CHÍNH\n`;
    csv += `Chỉ số,Kỳ này,Kỳ trước,Chênh lệch (VND),% Thay đổi\n`;
    csv += `Tổng thu nhập,"${curStats.income}","${prevStats.income}","${incomeDelta}","${incomeDeltaPct.toFixed(1)}%"\n`;
    csv += `Tổng chi tiêu,"${curStats.expense}","${prevStats.expense}","${expenseDelta}","${expenseDeltaPct.toFixed(1)}%"\n`;
    csv += `Dòng tiền thuần (Net),"${curStats.net}","${prevStats.net}","${netDelta}",""\n`;
    csv += `Tỷ lệ tiết kiệm,"${curStats.savingsRate.toFixed(1)}%","${prevStats.savingsRate.toFixed(1)}%","${savingsRateDelta.toFixed(1)}%",""\n\n`;

    // 2. Phân tích chi tiết danh mục
    csv += `2. PHÂN TÍCH CHI TIẾT THEO NHÓM CHI PHÍ\n`;
    csv += `Danh mục,Chi tiêu kỳ này,Chi tiêu kỳ trước,Chênh lệch (VND),% Biến động,Tỷ trọng chi tiêu,Số giao dịch,Hạn mức ngân sách,Trạng thái ngân sách,Đánh giá & Khuyến nghị\n`;
    categoryRows.forEach((r) => {
      const statusText = r.limit 
        ? (r.budgetStatus.isOver ? `Vượt ngân sách (${r.budgetStatus.percent}%)` : (r.budgetStatus.status === 'warning' ? `Chạm ngưỡng (${r.budgetStatus.percent}%)` : `An toàn (${r.budgetStatus.percent}%)`))
        : 'Chưa đặt hạn mức';
      csv += `"${r.name}","${r.spentCur}","${r.spentPrev}","${r.deltaAmt}","${r.deltaPct.toFixed(1)}%","${r.pctOfTotal.toFixed(1)}%","${r.countCur}","${r.limit || 0}","${statusText}","${r.adviceText.replace(/"/g, '""')}"\n`;
    });
    csv += '\n';

    // 3. Danh sách giao dịch trong kỳ
    csv += `3. DANH SÁCH GIAO DỊCH PHÁT SINH TRONG KỲ\n`;
    csv += `Ngày,Loại,Danh mục,Số tiền,Phí,Ghi chú\n`;
    curTxns.forEach((tx) => {
      csv += `"${tx.date || ''}","${tx.type === 'income' ? 'Thu nhập' : 'Chi tiêu'}","${tx.category || ''}","${tx.amount || 0}","${tx.fee || 0}","${(tx.note || '').replace(/"/g, '""')}"\n`;
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

  // ── ScrollSpy (IntersectionObserver) to sync active sidebar item ──
  useEffect(() => {
    const sectionIds = [
      'analytics-overview',
      'analytics-spending',
      'analytics-cashflow',
      'analytics-reports'
    ];

    const subTabMap = {
      'analytics-overview': 'overview',
      'analytics-spending': 'spending',
      'analytics-cashflow': 'cash-flow',
      'analytics-reports': 'reports'
    };

    const elements = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (window.__caltdhy_programmatic_scroll) return;

        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length > 0) {
          visibleEntries.sort((a, b) => {
            const rectA = a.boundingClientRect;
            const rectB = b.boundingClientRect;
            return Math.abs(rectA.top - 80) - Math.abs(rectB.top - 80);
          });
          const activeEntry = visibleEntries[0];
          const subTab = subTabMap[activeEntry.target.id];
          const currentTab = useSpendingStore.getState().analyticsSubTab;
          if (subTab && subTab !== currentTab) {
            setAnalyticsSubTab(subTab);
          }
        }
      },
      {
        root: null,
        rootMargin: '-80px 0px -40% 0px',
        threshold: [0.1, 0.3, 0.6]
      }
    );

    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [setAnalyticsSubTab]);

  // Initial scroll if subTab was clicked from outside
  const hasInitialScrolledRef = useRef(false);
  useEffect(() => {
    if (!hasInitialScrolledRef.current && analyticsSubTab && analyticsSubTab !== 'overview') {
      hasInitialScrolledRef.current = true;
      const targetMap = {
        spending: 'analytics-spending',
        'cash-flow': 'analytics-cashflow',
        reports: 'analytics-reports'
      };
      const targetId = targetMap[analyticsSubTab];
      if (targetId) {
        setTimeout(() => {
          document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      }
    }
  }, [analyticsSubTab]);

  return (
    <div className="analytics-feature-view" role="region" aria-label="Báo cáo phân tích thu chi">
      {/* ── 1. Page Header & Comparison Segmented / Month Selector ── */}
      <div className="analytics-header-bar" id="analytics-overview">
        <div className="analytics-title-group">
          <h2 className="analytics-view-title">Phân tích tài chính</h2>
          <p className="analytics-view-subtitle">
            Cơ cấu thu chi, dòng tiền thuần và xu hướng tài chính của bạn
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
              {monthData.net > 0 ? '✓ Thặng dư dòng tiền' : (monthData.net < 0 ? '⚠ Thâm hụt dòng tiền' : 'Cân bằng thu chi')}
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
                ? `Tiết kiệm ${formatPercent(monthData.savingsRate)} (Mục tiêu ≥ 20% ✓)`
                : monthData.savingsRate >= 0
                ? `Tiết kiệm ${formatPercent(monthData.savingsRate)} (Dưới mục tiêu 20%)`
                : `Thâm hụt ${formatPercent(Math.abs(monthData.savingsRate))} thu nhập ⚠️`}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. Spending By Category Section ── */}
      <div className="analytics-section-panel" id="analytics-spending">
        <div className="panel-header">
          <div className="panel-titles">
            <h3 className="panel-main-title">📊 Chi tiêu theo danh mục</h3>
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
                      <span className="cat-avatar-tile" style={{ backgroundColor: `${cat.color}16` }}>
                        {cat.icon}
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
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Cash-flow Trend Section ── */}
      <div className="analytics-section-panel" id="analytics-cashflow">
        <div className="panel-header">
          <div className="panel-titles">
            <h3 className="panel-main-title">📈 Xu hướng dòng tiền</h3>
            <p className="panel-subtitle">
              So sánh tương quan giữa Tổng thu nhập và Tổng chi tiêu
            </p>
          </div>

          <div className="trend-controls-wrap">
            <div className="trend-legend">
              <span className="legend-item"><span className="legend-dot dot-income" /> Thu nhập</span>
              <span className="legend-item"><span className="legend-dot dot-expense" /> Chi tiêu</span>
            </div>

            <div className="trend-segmented-group" role="radiogroup" aria-label="Chế độ biểu đồ xu hướng">
              <button
                type="button"
                role="radio"
                aria-checked={trendMode === 'daily'}
                className={`trend-seg-btn ${trendMode === 'daily' ? 'active' : ''}`}
                onClick={() => setTrendMode('daily')}
              >
                Theo ngày trong tháng
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={trendMode === '3months'}
                className={`trend-seg-btn ${trendMode === '3months' ? 'active' : ''}`}
                onClick={() => setTrendMode('3months')}
              >
                3 tháng gần đây
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={trendMode === '6months'}
                className={`trend-seg-btn ${trendMode === '6months' ? 'active' : ''}`}
                onClick={() => setTrendMode('6months')}
              >
                6 tháng gần đây
              </button>
            </div>
          </div>
        </div>

        {!hasTrendData ? (
          /* Empty state: Low-emphasis grid + clean central message (NO fake axis) */
          <div className="trend-empty-chart-box">
            <div className="trend-empty-grid-lines" aria-hidden="true">
              <div className="grid-line" />
              <div className="grid-line" />
              <div className="grid-line" />
            </div>
            <span className="trend-empty-center-text">
              Chưa có dữ liệu để hiển thị biểu đồ
            </span>
          </div>
        ) : (
          /* Data state: Bar Chart */
          <div className="trend-chart-box">
            <Bar data={barChartData} options={barOptions} />
          </div>
        )}
      </div>

      {/* ── 5. Detailed Financial Report Section (Báo cáo tài chính chuyên sâu) ── */}
      <div className="analytics-section-panel analytics-report-section" id="analytics-reports">
        {/* Header & Controls */}
        <div className="panel-header">
          <div className="panel-titles">
            <h3 className="panel-main-title">📋 Báo cáo tổng hợp tài chính</h3>
            <p className="panel-subtitle">
              Đối chiếu chi tiết chỉ số tài chính, nhóm chi phí và tình trạng ngân sách giữa các kỳ
            </p>
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
                  ? '↑ +100.0%'
                  : reportData.incomeDelta > 0
                  ? `↑ +${Math.abs(reportData.incomeDeltaPct).toFixed(1)}%`
                  : reportData.incomeDelta < 0
                  ? `↓ -${Math.abs(reportData.incomeDeltaPct).toFixed(1)}%`
                  : '~ 0.0%'}
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
                  ? '↓ -100.0%'
                  : reportData.expenseDelta > 0
                  ? `↑ +${Math.abs(reportData.expenseDeltaPct).toFixed(1)}%`
                  : reportData.expenseDelta < 0
                  ? `↓ -${Math.abs(reportData.expenseDeltaPct).toFixed(1)}%`
                  : '~ 0.0%'}
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
                {reportData.curStats.net > 0 ? '✓ Thặng dư' : (reportData.curStats.net < 0 ? '⚠ Thâm hụt' : 'Cân bằng')}
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
                  ? `↑ +${reportData.savingsRateDelta.toFixed(1)}%`
                  : `↓ ${reportData.savingsRateDelta.toFixed(1)}%`}
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
              <span>💡 Nhận định & Khuyến nghị tài chính kỳ này</span>
            </div>
            <div className="report-insights-list">
              {reportData.insights.map((item, idx) => (
                <div key={idx} className="report-insight-item">
                  <span className={`insight-icon-pill insight-icon-pill--${item.type}`}>
                    {item.type === 'accolade' ? '🌟' : (item.type === 'warning' ? '⚠️' : 'ℹ️')}
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
                          <span className="table-cat-icon" style={{ backgroundColor: 'var(--color-success-bg, rgba(0, 139, 87, 0.08))' }}>
                            {cat.icon}
                          </span>
                          <span className="table-cat-name">{cat.name}</span>
                        </div>
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
                          <span className="table-pct-val">{cat.pctOfTotal.toFixed(0)}%</span>
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
                              ⚠️ Vượt ({cat.budgetStatus.percent}%)
                            </span>
                          ) : isMaxed ? (
                            <span className="budget-status-pill budget-status-pill--warning">
                              ⚡ Chạm ({cat.budgetStatus.percent}%)
                            </span>
                          ) : isWarning ? (
                            <span className="budget-status-pill budget-status-pill--warning">
                              ⚡ Cận trần ({cat.budgetStatus.percent}%)
                            </span>
                          ) : (
                            <span className="budget-status-pill budget-status-pill--safe">
                              ✓ An toàn ({cat.budgetStatus.percent}%)
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
    </div>
  );
}
