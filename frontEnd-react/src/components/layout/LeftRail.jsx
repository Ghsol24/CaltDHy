import React from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';

export function LeftRail() {
  const {
    totalBalance,
    monthlyIncome,
    monthlyExpense,
    openAddTxnModal,
    openNumpadModal
  } = useSpendingStore();

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(val);
  };

  const now = new Date();
  const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthLabel = `${MONTHS_EN[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <aside className="rail" aria-label="Financial overview">
      {/* 1. HERO METRICS DISPLAY */}
      <section className="rail-section" aria-labelledby="metrics-heading">
        <h2 className="section-label" id="metrics-heading">
          Financial Overview
        </h2>

        <div className="metrics-stack">
          <div className="metric-card metric-card--balance">
            <div className="metric-card__screw mc-screw--tl" aria-hidden="true"></div>
            <div className="metric-card__screw mc-screw--tr" aria-hidden="true"></div>
            <p className="metric-card__label">Total Balance</p>
            <p className="metric-card__value metric-card__value--balance" id="metricBalance">
              {formatCurrency(totalBalance)}
            </p>
            <p className="metric-card__sub">All-time net</p>
            <button
              className="btn-quick-deposit"
              id="btnQuickDeposit"
              onClick={openNumpadModal}
              aria-label="Quick Deposit"
              aria-haspopup="dialog"
            >
              +
            </button>
          </div>

          <div className="metric-card metric-card--income">
            <p className="metric-card__label">Monthly Income</p>
            <p className="metric-card__value metric-card__value--income" id="metricIncome">
              +{formatCurrency(monthlyIncome)}
            </p>
            <p className="metric-card__sub" id="metricMonthLabel">
              {monthLabel}
            </p>
          </div>

          <div className="metric-card metric-card--expense">
            <p className="metric-card__label">Monthly Expense</p>
            <p className="metric-card__value metric-card__value--expense" id="metricExpense">
              -{formatCurrency(monthlyExpense)}
            </p>
            <p className="metric-card__sub">This month</p>
          </div>
        </div>
      </section>

      {/* 2. PRIMARY ACTION */}
      <section className="rail-section">
        <button
          className="btn-add-txn"
          id="btnAddTxn"
          onClick={openAddTxnModal}
          aria-haspopup="dialog"
        >
          <span className="btn-add-txn__icon" aria-hidden="true">
            +
          </span>
          <span>ADD TRANSACTION</span>
        </button>
      </section>

      {/* 3. CATEGORY BREAKDOWN */}
      <section className="rail-section rail-section--grow" aria-labelledby="cat-heading">
        <div className="cat-heading-row">
          <h2 className="section-label" id="cat-heading">
            Category Breakdown
          </h2>
        </div>

        <div className="chassis-frame chassis-frame--chart" aria-label="Category breakdown chart">
          <div className="chassis-frame__screw cf-screw--tl" aria-hidden="true"></div>
          <div className="chassis-frame__screw cf-screw--tr" aria-hidden="true"></div>
          <div className="chassis-frame__screw cf-screw--bl" aria-hidden="true"></div>
          <div className="chassis-frame__screw cf-screw--br" aria-hidden="true"></div>

          <div className="chart-panel">
            <div className="chart-canvas-wrap">
              <canvas id="categoryChart" aria-label="Category Breakdown Doughnut Chart" role="img"></canvas>
            </div>
            <div className="chart-legend" id="chartLegend" aria-label="Chart legend"></div>
            <p className="chart-empty" id="chartEmpty">
              // CHƯA CÓ DỮ LIỆU CHI TIÊU
            </p>
          </div>
        </div>
      </section>
    </aside>
  );
}
