import React, { useState, useMemo } from 'react';
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
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { getCategoryIcon } from '../../utils/categories';

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
  const { transactions } = useTransactionStore();
  const { selectedMonth, setSelectedMonth, openAddTxnModal } = useSpendingStore();
  const { theme } = useThemeStore();

  const [trendMode, setTrendMode] = useState('monthly'); // 'monthly' | 'daily'

  // Current active month in 'YYYY-MM' format
  const activeMonth = selectedMonth || new Date().toISOString().slice(0, 7);

  // Month navigation helpers
  const { currentYear, currentMonthNum, monthLabel, prevMonthStr, nextMonthStr, isCurrentMonth } = useMemo(() => {
    const [yStr, mStr] = activeMonth.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10); // 1-12

    const prevDate = new Date(year, month - 2, 1);
    const prevYear = prevDate.getFullYear();
    const prevM = String(prevDate.getMonth() + 1).padStart(2, '0');

    const nextDate = new Date(year, month, 1);
    const nextYear = nextDate.getFullYear();
    const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');

    const now = new Date();
    const nowMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return {
      currentYear: year,
      currentMonthNum: month,
      monthLabel: `Tháng ${month}, ${year}`,
      prevMonthStr: `${prevYear}-${prevM}`,
      nextMonthStr: `${nextYear}-${nextM}`,
      isCurrentMonth: activeMonth === nowMonthStr
    };
  }, [activeMonth]);

  const handlePrevMonth = () => setSelectedMonth(prevMonthStr);
  const handleNextMonth = () => setSelectedMonth(nextMonthStr);
  const handleSetThisMonth = () => {
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  };
  const handleSetLastMonth = () => {
    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    setSelectedMonth(`${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`);
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

  // 2. Multi-Month Trend (Last 6 months)
  const multiMonthTrend = useMemo(() => {
    const months = [];
    let hasAnyData = false;

    for (let i = 5; i >= 0; i--) {
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
          else if (t.type === 'expense') exp += (amt + fee);
        }
      });

      if (inc > 0 || exp > 0) hasAnyData = true;
      months.push({ prefix, label, income: inc, expense: exp });
    }
    return { months, hasAnyData };
  }, [transactions, currentYear, currentMonthNum]);

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
          else if (t.type === 'expense') exp += (amt + fee);
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

  const hasTrendData = trendMode === 'monthly' ? multiMonthTrend.hasAnyData : dailyTrend.hasAnyData;

  // Doughnut Chart Configuration
  const doughnutChartData = useMemo(() => {
    if (monthData.categories.length === 0) return null;

    const sliceBorderColor = theme === 'dark' ? '#12131C' : '#FFFFFF';

    return {
      labels: monthData.categories.map((c) => c.name),
      datasets: [
        {
          data: monthData.categories.map((c) => c.amount),
          backgroundColor: monthData.categories.map((c) => c.color),
          borderColor: sliceBorderColor,
          borderWidth: 2,
          hoverOffset: 6
        }
      ]
    };
  }, [monthData.categories, theme]);

  const doughnutOptions = useMemo(() => {
    const isDark = theme === 'dark';
    const tooltipBg = isDark ? '#1A1C29' : '#101B36';

    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
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
  }, [monthData.expense, theme]);

  // Bar Chart Configuration
  const barChartData = useMemo(() => {
    if (trendMode === 'monthly') {
      return {
        labels: multiMonthTrend.months.map((m) => m.label),
        datasets: [
          {
            label: 'Thu nhập',
            data: multiMonthTrend.months.map((m) => m.income),
            backgroundColor: '#008B57',
            borderRadius: 6,
            barPercentage: 0.6,
            categoryPercentage: 0.7
          },
          {
            label: 'Chi tiêu',
            data: multiMonthTrend.months.map((m) => m.expense),
            backgroundColor: '#E34B45',
            borderRadius: 6,
            barPercentage: 0.6,
            categoryPercentage: 0.7
          }
        ]
      };
    }

    return {
      labels: dailyTrend.days.map((d) => d.label),
      datasets: [
        {
          label: 'Thu nhập',
          data: dailyTrend.days.map((d) => d.income),
          backgroundColor: '#008B57',
          borderRadius: 4,
          barPercentage: 0.7,
          categoryPercentage: 0.8
        },
        {
          label: 'Chi tiêu',
          data: dailyTrend.days.map((d) => d.expense),
          backgroundColor: '#E34B45',
          borderRadius: 4,
          barPercentage: 0.7,
          categoryPercentage: 0.8
        }
      ]
    };
  }, [trendMode, multiMonthTrend, dailyTrend]);

  const barOptions = useMemo(() => {
    const isDark = theme === 'dark';
    const tickColor = isDark ? '#8B949E' : '#8A98A9';
    const gridLineColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#E3ECE7';
    const legendColor = isDark ? '#C9D1D9' : '#607086';
    const tooltipBg = isDark ? '#1F242C' : '#101B36';

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
            color: legendColor
          }
        },
        tooltip: {
          backgroundColor: tooltipBg,
          titleFont: { family: 'Inter, sans-serif', size: 12, weight: '600' },
          bodyFont: { family: 'Inter, sans-serif', size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
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
            color: tickColor,
            font: { family: 'Inter, sans-serif', size: 11 }
          }
        },
        y: {
          min: 0,
          grid: { color: gridLineColor },
          ticks: {
            color: tickColor,
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
  }, [theme]);

  return (
    <div className="analytics-feature-view" role="region" aria-label="Báo cáo phân tích thu chi">
      {/* ── 1. Page Header & Comparison Segmented / Month Selector ── */}
      <div className="analytics-header-bar">
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

            <span className="month-current-display" aria-live="polite">
              📅 {monthLabel}
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
          <div className="kpi-card-amount text-brand">
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
          <div className="kpi-card-amount text-danger">
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
          <div className={`kpi-card-amount ${monthData.net >= 0 ? 'text-brand' : 'text-danger'}`}>
            {formatCurrency(monthData.net)}
          </div>
          <div className="kpi-card-meta">
            <span className={`kpi-status-pill ${monthData.net >= 0 ? 'pill-positive' : 'pill-danger'}`}>
              {monthData.net >= 0 ? '✓ Thặng dư dòng tiền' : '⚠ Thâm hụt dòng tiền'}
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
          <div className="kpi-card-amount text-brand">
            {monthData.income > 0 ? formatPercent(Math.max(0, monthData.savingsRate)) : '0%'}
          </div>
          <div className="kpi-card-meta">
            <span className="kpi-status-pill pill-neutral">
              {monthData.income > 0 ? `Tiết kiệm ${formatPercent(monthData.savingsRate)} thu nhập` : 'Chưa có dữ liệu'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. Spending By Category Section ── */}
      <div className="analytics-section-panel">
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
      <div className="analytics-section-panel">
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
                aria-checked={trendMode === 'monthly'}
                className={`trend-seg-btn ${trendMode === 'monthly' ? 'active' : ''}`}
                onClick={() => setTrendMode('monthly')}
              >
                6 tháng gần đây
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={trendMode === 'daily'}
                className={`trend-seg-btn ${trendMode === 'daily' ? 'active' : ''}`}
                onClick={() => setTrendMode('daily')}
              >
                Theo ngày trong tháng
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
    </div>
  );
}
