import { useMemo, useRef } from 'react';
import { formatCurrency, formatDate, getLocalDateString } from '../../../utils/formatters'
import { formatCompactCurrency } from '../../../utils/compactFormatters';
import { cashFlowSeriesTypes } from '../../../utils/cashFlowData';
import { cashFlowChartContext } from '../cashFlowChartContext';

// Hover shade for a bar: 20% darker. Canvas colours are resolved here because
// not every browser accepts color-mix() as a canvas fill.
function darken(color) {
  const match = /^#([\da-f]{6})$/i.exec(String(color).trim());
  if (!match) return color;
  const n = parseInt(match[1], 16);
  const part = (shift) => Math.round(((n >> shift) & 255) * 0.8).toString(16).padStart(2, '0');
  return `#${part(16)}${part(8)}${part(0)}`;
}

export function useAnalyticsCharts({ activeMonth, drilldownRevision, isCompactChart, label, lang, monthData, monthlyTrend, openDay, prefersReducedMotion, setDrilldown, setMobileWeek, setSelectedMonth, t, theme, trendMode, trendSeries, unusualDays = [], viewCategoryHistory, visibleDailyDays }) {
  const chartThemeTokens = useMemo(() => {
    const styles = getComputedStyle(document.documentElement);
    const read = (name) => styles.getPropertyValue(name).trim();
    return {
      theme,
      // Ordinary spending bars are neutral; red marks only unusually high days (CF-05).
      income: read('--color-success'), expense: read('--color-text-muted'), expenseHover: read('--color-text-secondary'),
      unusual: read('--color-danger'),
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
  const unusualDates = useMemo(() => new Set(unusualDays.map((day) => day.date)), [unusualDays]);
  // Unusual days are always highlighted (touch screens have no hover); hovering
  // any bar only deepens its colour.
  const isUnusualBar = (type, index) => trendMode === 'daily' && type === 'expense' && unusualDates.has(chartRows[index]?.date);
  const barChartData = useMemo(() => ({
    labels: chartRows.map((row) => row.label),
    datasets: cashFlowSeriesTypes(trendSeries).map((type) => ({
      cashFlowType: type,
      label: t(`type.${type}`),
      data: chartRows.map((row) => row[type]),
      backgroundColor: chartRows.map((_row, index) => (isUnusualBar(type, index) ? chartThemeTokens.unusual : chartThemeTokens[type])),
      hoverBackgroundColor: chartRows.map((_row, index) => {
        if (isUnusualBar(type, index)) return darken(chartThemeTokens.unusual);
        return type === 'expense' ? chartThemeTokens.expenseHover : darken(chartThemeTokens[type]);
      }),
      borderRadius: trendMode === 'daily' ? 4 : 6,
      barPercentage: trendMode === 'daily' ? 0.7 : 0.65,
      categoryPercentage: trendMode === 'daily' ? 0.8 : 0.65,
    })),
  }), [chartRows, trendSeries, trendMode, chartThemeTokens, t, unusualDates]);

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
    animation: prefersReducedMotion ? false : { duration: 550, easing: 'easeOutQuart' },
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
          afterLabel: (context) => (isUnusualBar(context.dataset.cashFlowType, context.dataIndex) ? ` ${t('analytics.unusualTitle')}` : ''),
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
  }), [setDrilldown, setMobileWeek, drilldownRevision, trendMode, visibleDailyDays, monthlyTrend, chartRows, barChartData, activeMonth,
    chartThemeTokens, prefersReducedMotion, isCompactChart, openDay, setSelectedMonth, today, t, lang, unusualDates]);
  return { barChartData, barOptions, chartContext, doughnutChartData, doughnutOptions, today };
}
