/* ============================================================
   CaltDHy — views/AnalyticsView.jsx
   Analytics view: Cash Flow Trends & Daily Spending.
   Khôi phục 100% config biểu đồ nguyên bản:
   - averageLine plugin (đường nét đứt + nhãn AVG)
   - Theme-based chart colors (dark/light/cream/green)
   - Cash Flow 1 Month → Weekly breakdown (Tuần 1–4)
   - Daily Spending → Bar chart, borderRadius, autoSkip axes
   - Phông chữ 'JetBrains Mono' trên cả hai trục
   ============================================================ */

import { useState, useMemo } from 'react';
import { t } from '../utils/i18n';


import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  Tooltip, Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

// ── Bảng màu theo theme — nguyên bản từ spending.js getThemeChartColors() ──
function getThemeColors(theme) {
  switch (theme) {
    case 'light': return {
      income: '#4F46E5', incomeGlow: 'rgba(79,70,229,0.2)', incomeMuted: 'rgba(79,70,229,0.25)',
      expense: '#FF6B81', expenseGlow: 'rgba(255,107,129,0.2)', expenseMuted: 'rgba(255,107,129,0.25)',
      grid: 'rgba(0,0,0,0.05)', text: '#64748B',
    };
    case 'cream': return {
      income: '#2D7A3E', incomeGlow: 'rgba(45,122,62,0.2)', incomeMuted: 'rgba(45,122,62,0.25)',
      expense: '#C0531E', expenseGlow: 'rgba(192,83,30,0.2)', expenseMuted: 'rgba(192,83,30,0.25)',
      grid: 'rgba(44,29,16,0.08)', text: '#8A7060',
    };
    case 'green': return {
      income: '#059669', incomeGlow: 'rgba(5,150,105,0.35)', incomeMuted: 'rgba(5,150,105,0.2)',
      expense: '#D63E3E', expenseGlow: 'rgba(214,62,62,0.3)', expenseMuted: 'rgba(214,62,62,0.18)',
      grid: 'rgba(16,120,80,0.08)', text: '#4D7A68',
    };
    case 'dark':
    default: return {
      income: '#10B981', incomeGlow: 'rgba(16,185,129,0.35)', incomeMuted: 'rgba(16,185,129,0.2)',
      expense: '#FF4B72', expenseGlow: 'rgba(255,75,114,0.35)', expenseMuted: 'rgba(255,75,114,0.2)',
      grid: 'rgba(255,255,255,0.05)', text: '#8F9CAE',
    };
  }
}

// ── averageLine Plugin — nguyên bản từ spending.js ──
const averageLinePlugin = {
  id: 'averageLine',
  afterDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;
    chart.data.datasets.forEach(dataset => {
      const data = dataset.data;
      if (!data || data.length === 0) return;
      const sum = data.reduce((a, b) => a + b, 0);
      const avg = sum / data.length;
      if (avg <= 0) return;

      const yVal = scales.y.getPixelForValue(avg);
      const color = typeof dataset.borderColor === 'string' ? dataset.borderColor : '#ffffff';

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.4;
      ctx.moveTo(chartArea.left, yVal);
      ctx.lineTo(chartArea.right, yVal);
      ctx.stroke();

      // Nhãn AVG căn phải
      ctx.fillStyle = color;
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = 'right';
      ctx.globalAlpha = 0.9;
      const avgLabel = avg >= 1000000
        ? `AVG ${dataset.label}: ${(avg / 1000000).toFixed(1)}M`
        : avg >= 1000
          ? `AVG ${dataset.label}: ${(avg / 1000).toFixed(0)}k`
          : `AVG ${dataset.label}: ${Math.round(avg)}`;
      ctx.fillText(avgLabel, chartArea.right - 8, yVal - 5);
      ctx.restore();
    });
  }
};

// ── Callback rút gọn trục Y ──
function yAxisFormatter(val) {
  if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
  if (val >= 1000)    return (val / 1000).toFixed(0) + 'k';
  return val;
}

// ── Lấy 6 tháng gần nhất (cho select month) ──
function getLast6Months(lang = 'vi') {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const label = lang === 'vi'
      ? `Tháng ${d.getMonth() + 1} ${d.getFullYear()}`
      : `${d.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${d.getFullYear()}`;
    months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: label,
    });
  }
  return months;
}

export default function AnalyticsView({ txState, formatCurrency, theme = 'dark', lang = 'vi' }) {
  const { transactions } = txState;
  const [trendType, setTrendType]               = useState('bar');
  const [trendRange, setTrendRange]             = useState(1);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(5);

  const monthsList  = useMemo(() => getLast6Months(lang), [lang]);
  const activeMonth = monthsList[selectedMonthIndex] || monthsList[5];
  const colors      = useMemo(() => getThemeColors(theme), [theme]);

  // ── Cash Flow Trend Data ──
  const trendData = useMemo(() => {
    const now = new Date();
    const isCurrentMonth = (activeMonth.month === now.getMonth() && activeMonth.year === now.getFullYear());

    // 1 Month → chia theo 4 Tuần (như bản gốc spending.js)
    if (trendRange === 1) {
      const weeks = [
        { label: lang === 'vi' ? 'Tuần 1' : 'Week 1', start: 1,  end: 7  },
        { label: lang === 'vi' ? 'Tuần 2' : 'Week 2', start: 8,  end: 14 },
        { label: lang === 'vi' ? 'Tuần 3' : 'Week 3', start: 15, end: 21 },
        { label: lang === 'vi' ? 'Tuần 4+' : 'Week 4+', start: 22, end: 31 },
      ];
      const incomeData  = [0, 0, 0, 0];
      const expenseData = [0, 0, 0, 0];

      // Chỉ đánh dấu tuần hiện tại nếu đang ở tháng hiện tại
      let currentWeekIdx = -1;
      if (isCurrentMonth) {
        const d = now.getDate();
        if (d <= 7) currentWeekIdx = 0;
        else if (d <= 14) currentWeekIdx = 1;
        else if (d <= 21) currentWeekIdx = 2;
        else currentWeekIdx = 3;
      }

      transactions.forEach(t => {
        const d = new Date(t.date + 'T00:00:00');
        if (d.getMonth() !== activeMonth.month || d.getFullYear() !== activeMonth.year) return;
        const day = d.getDate();
        let idx = -1;
        if (day <= 7) idx = 0;
        else if (day <= 14) idx = 1;
        else if (day <= 21) idx = 2;
        else idx = 3;
        if (t.type === 'income') incomeData[idx] += t.amount;
        else expenseData[idx] += t.amount;
      });

      const labels = weeks.map((w, i) =>
        (isCurrentMonth && i === currentWeekIdx) ? [w.label, lang === 'vi' ? '(hiện tại)' : '(current)'] : w.label
      );

      return {
        labels,
        datasets: [
          {
            label: t('incomeLabel', lang).toUpperCase(),
            data: incomeData,
            backgroundColor: trendType === 'bar' ? colors.incomeGlow : 'rgba(0,0,0,0)',
            borderColor: colors.income,
            borderWidth: 2,
            borderRadius: 6,
            barPercentage: 0.55,
            categoryPercentage: 0.75,
            fill: trendType === 'line',
            tension: 0.35,
          },
          {
            label: t('expenseLabel', lang).toUpperCase(),
            data: expenseData,
            backgroundColor: trendType === 'bar' ? colors.expenseGlow : 'rgba(0,0,0,0)',
            borderColor: colors.expense,
            borderWidth: 2,
            borderRadius: 6,
            barPercentage: 0.55,
            categoryPercentage: 0.75,
            fill: trendType === 'line',
            tension: 0.35,
          },
        ],
      };
    }

    // 3 / 6 / 12 tháng → monthly grouping
    const subMonths = [];
    for (let i = trendRange - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = lang === 'vi'
        ? `T${d.getMonth() + 1}/${d.getFullYear()}`
        : `${d.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${d.getFullYear()}`;
      subMonths.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: label,
      });
    }

    const incomeData  = new Array(trendRange).fill(0);
    const expenseData = new Array(trendRange).fill(0);

    transactions.forEach(t => {
      const d = new Date(t.date + 'T00:00:00');
      const idx = subMonths.findIndex(m => m.month === d.getMonth() && m.year === d.getFullYear());
      if (idx === -1) return;
      if (t.type === 'income') incomeData[idx] += t.amount;
      else expenseData[idx] += t.amount;
    });

    return {
      labels: subMonths.map(m => m.label),
      datasets: [
        {
          label: t('incomeLabel', lang).toUpperCase(),
          data: incomeData,
          backgroundColor: trendType === 'bar' ? colors.incomeGlow : 'rgba(0,0,0,0)',
          borderColor: colors.income,
          borderWidth: 2,
          borderRadius: 6,
          barPercentage: 0.55,
          categoryPercentage: 0.75,
          fill: trendType === 'line',
          tension: 0.35,
        },
        {
          label: t('expenseLabel', lang).toUpperCase(),
          data: expenseData,
          backgroundColor: trendType === 'bar' ? colors.expenseGlow : 'rgba(0,0,0,0)',
          borderColor: colors.expense,
          borderWidth: 2,
          borderRadius: 6,
          barPercentage: 0.55,
          categoryPercentage: 0.75,
          fill: trendType === 'line',
          tension: 0.35,
        },
      ],
    };
  }, [transactions, trendType, trendRange, activeMonth, colors, lang]);

  // ── Daily Spending Data (Bar chart với màu nguyên bản) ──
  const dailyData = useMemo(() => {
    const daysInMonth = new Date(activeMonth.year, activeMonth.month + 1, 0).getDate();
    const daysArr = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const dailyExpense = daysArr.map(day => {
      return transactions
        .filter(t => {
          const d = new Date(t.date + 'T00:00:00');
          return d.getFullYear() === activeMonth.year &&
            d.getMonth() === activeMonth.month &&
            d.getDate() === day &&
            t.type === 'expense';
        })
        .reduce((sum, t) => sum + t.amount, 0);
    });

    const total = dailyExpense.reduce((s, v) => s + v, 0);
    const maxVal = Math.max(...dailyExpense, 1);

    // Màu thanh cột: ngày có chi nhiều nhất → sáng hơn (semi-transparent fill + solid border)
    const bgColors = dailyExpense.map(v => {
      const ratio = v / maxVal;
      if (ratio >= 0.9) return colors.expenseGlow;
      if (ratio >= 0.5) return colors.expenseMuted;
      return 'rgba(255, 75, 114, 0.05)';
    });

    const borderColors = dailyExpense.map(v => {
      const ratio = v / maxVal;
      if (ratio >= 0.9) return colors.expense;
      if (ratio >= 0.5) return colors.expense;
      return colors.expenseMuted;
    });

    return {
      labels: daysArr.map(d => `${d}`),
      datasets: [{
        label: lang === 'vi' ? 'Chi tiêu hàng ngày' : 'Daily Expense',
        data: dailyExpense,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 1.5,
        borderRadius: 4,
        barPercentage: 0.6,
        categoryPercentage: 0.8,
      }],
      total,
    };
  }, [transactions, activeMonth, colors, lang]);

  // ── Trend chart options nguyên bản ──
  const trendOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 450, easing: 'easeInOutQuad' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#252a2b',
        titleColor: '#e0e5ec',
        bodyColor: '#8896a8',
        borderColor: 'rgba(255,255,255,.08)',
        borderWidth: 1,
        padding: 10,
        titleFont: { family: "'JetBrains Mono', monospace", size: 13, weight: '700' },
        bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
        callbacks: { label: ctx => ` ${formatCurrency(ctx.raw)}` },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: colors.text, font: { family: "'JetBrains Mono', monospace", size: 9 } },
      },
      y: {
        grid: { color: colors.grid, borderDash: [4, 4] },
        ticks: {
          color: colors.text,
          font: { family: "'JetBrains Mono', monospace", size: 9 },
          callback: yAxisFormatter,
        },
      },
    },
  }), [colors, formatCurrency]);

  // ── Daily chart options nguyên bản ──
  const dailyOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 450, easing: 'easeInOutQuad' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#252a2b',
        titleColor: '#e0e5ec',
        bodyColor: '#8896a8',
        borderColor: 'rgba(255,255,255,.08)',
        borderWidth: 1,
        padding: 10,
        titleFont: { family: "'JetBrains Mono', monospace", size: 13, weight: '700' },
        bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
        callbacks: {
          title: items => lang === 'vi' ? `Ngày ${items[0].label}` : `Day ${items[0].label}`,
          label: ctx => lang === 'vi' ? ` Chi tiêu: ${formatCurrency(ctx.raw)}` : ` Expense: ${formatCurrency(ctx.raw)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: colors.text,
          font: { family: "'JetBrains Mono', monospace", size: 9 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 16,
        },
      },
      y: {
        grid: { color: colors.grid, borderDash: [4, 4] },
        ticks: {
          color: colors.text,
          font: { family: "'JetBrains Mono', monospace", size: 9 },
          callback: yAxisFormatter,
        },
      },
    },
  }), [colors, formatCurrency]);

  const isEmpty = (trendData.datasets[0].data.every(v => v === 0) && trendData.datasets[1].data.every(v => v === 0));

  return (
    <div id="view-analytics" className="dashboard-view active">
      <div className="analytics-layout-wrapper">
        {/* Left Column: Charts */}
        <div className="analytics-main-pane">
          {/* Cash Flow Trend Chart */}
          <section className="trend-section" aria-labelledby="trend-heading">
            <div className="trend-section__header">
              <h2 className="section-label" id="trend-heading">{t('trendPanel', lang)}</h2>
            </div>

            <div className="chassis-frame chassis-frame--trend">
              <div className="chassis-frame__screw cf-screw--tl" aria-hidden="true"></div>
              <div className="chassis-frame__screw cf-screw--tr" aria-hidden="true"></div>
              <div className="chassis-frame__screw cf-screw--bl" aria-hidden="true"></div>
              <div className="chassis-frame__screw cf-screw--br" aria-hidden="true"></div>

              <div className="trend-panel">
                {isEmpty ? (
                  <p className="trend-empty">
                    // {lang === 'vi' ? 'CHƯA CÓ DỮ LIỆU TRONG KHOẢNG NÀY' : 'NO DATA FOR THIS PERIOD'}
                  </p>
                ) : (
                  <div className="trend-canvas-wrap" style={{ height: '240px' }}>
                    {trendType === 'line' ? (
                      <Line data={trendData} options={trendOptions} plugins={[averageLinePlugin]} />
                    ) : (
                      <Bar data={trendData} options={trendOptions} plugins={[averageLinePlugin]} />
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Daily Spending Chart */}
          <section className="daily-section" aria-labelledby="daily-heading">
            <div className="daily-section__header">
              <h2 className="section-label" id="daily-heading">
                {lang === 'vi' ? 'Chi Tiêu Hàng Ngày' : 'Daily Spending'}
              </h2>
              <span className="daily-section__badge" id="dailyMonthBadge">{activeMonth.label}</span>
            </div>

            <div className="chassis-frame chassis-frame--daily">
              <div className="chassis-frame__screw cf-screw--tl" aria-hidden="true"></div>
              <div className="chassis-frame__screw cf-screw--tr" aria-hidden="true"></div>
              <div className="chassis-frame__screw cf-screw--bl" aria-hidden="true"></div>
              <div className="chassis-frame__screw cf-screw--br" aria-hidden="true"></div>

              <div className="daily-panel">
                {dailyData.total === 0 ? (
                  <p className="daily-empty">
                    // {lang === 'vi' ? 'CHƯA CÓ DỮ LIỆU CHI TIÊU THÁNG NÀY' : 'NO EXPENSE DATA THIS MONTH'}
                  </p>
                ) : (
                  <div className="daily-canvas-wrap" style={{ height: '240px' }}>
                    <Bar data={dailyData} options={dailyOptions} />
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Controls & Summary */}
        <div className="analytics-side-pane">
          <div className="analytics-control-card">
            {/* Month Selection */}
            <div className="control-card-section">
              <h3 className="control-card-label">{t('analyticsMonth', lang)}</h3>
              <div className="month-navigation-wrapper">
                <button
                  className="month-nav-btn prev-month-btn"
                  onClick={() => setSelectedMonthIndex(p => Math.max(0, p - 1))}
                  disabled={selectedMonthIndex === 0}
                  aria-label="Tháng trước"
                  type="button"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>

                <div className="month-picker-wrapper">
                  <button className="month-picker-trigger" type="button">
                    <span className="month-picker-icon" aria-hidden="true">📅</span>
                    <span>{activeMonth.label}</span>
                  </button>
                </div>

                <button
                  className="month-nav-btn next-month-btn"
                  onClick={() => setSelectedMonthIndex(p => Math.min(5, p + 1))}
                  disabled={selectedMonthIndex === 5}
                  aria-label="Tháng sau"
                  type="button"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
            </div>

            <div className="control-card-divider"></div>

            {/* Options */}
            <div className="control-card-section">
              <h3 className="control-card-label">{t('trendControls', lang)}</h3>
              <div className="control-card-row" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={trendRange}
                  onChange={e => setTrendRange(Number(e.target.value))}
                  className="trend-select"
                  aria-label="Select trend range"
                >
                  <option value={1}>{t('range1M', lang)}</option>
                  <option value={3}>{t('range3M', lang)}</option>
                  <option value={6}>{t('range6M', lang)}</option>
                  <option value={12}>{t('range12M', lang)}</option>
                </select>

                <div className="trend-type-group" role="group" aria-label="Trend type">
                  <button
                    className={`trend-type-btn${trendType === 'bar' ? ' active' : ''}`}
                    onClick={() => setTrendType('bar')}
                    aria-label="Bar Chart"
                    type="button"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                    </svg>
                  </button>
                  <button
                    className={`trend-type-btn${trendType === 'line' ? ' active' : ''}`}
                    onClick={() => setTrendType('line')}
                    aria-label="Line Chart"
                    type="button"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Summary */}
          <section className="analytics-summary-section" aria-labelledby="analytics-summary-heading">
            <div className="analytics-summary-header">
              <h2 className="section-label" id="analytics-summary-heading">{t('analyticsSummary', lang)}</h2>
            </div>
            <div className="analytics-grid">
              <div className="analytics-card">
                <span className="analytics-card__title">
                  {lang === 'vi' ? 'TỔNG CHI TIÊU' : 'TOTAL EXPENSE'}
                </span>
                <span className="analytics-card__value" style={{ color: 'var(--accent)' }}>
                  {formatCurrency(dailyData.total)}
                </span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card__title">
                  {lang === 'vi' ? 'TRUNG BÌNH HÀNG NGÀY' : 'DAILY AVERAGE'}
                </span>
                <span className="analytics-card__value">
                  {formatCurrency(dailyData.total / new Date(activeMonth.year, activeMonth.month + 1, 0).getDate())}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
